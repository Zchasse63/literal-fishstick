#!/usr/bin/env python3
"""
Meridian Data Import: The Sauna Guys Glofox Export -> Supabase SQL
=================================================================
Reads members-2.csv from the TSG Data export, deduplicates, cleans,
maps membership types, determines status, and outputs seed-members.sql.

Usage:
    python3 scripts/import-members.py

Expects:
    ~/Desktop/TSG Data/members-2.csv

Outputs:
    scripts/seed-members.sql
"""

import csv
import os
import re
import uuid
import sys
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STUDIO_ID = "11111111-1111-1111-1111-111111111111"
ACQUISITION_DATE = datetime(2026, 2, 25, tzinfo=timezone.utc)
CURRENT_DATE = datetime(2026, 3, 20, tzinfo=timezone.utc)
ACTIVE_WINDOW_DAYS = 60  # days since last booking to count as "active"

CSV_PATH = os.path.expanduser("~/Desktop/TSG Data/members-2.csv")
SQL_OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed-members.sql")

# Existing Meridian membership_plan IDs (from Supabase)
PLAN_IDS = {
    "unlimited":  "5bc4ca38-7d6d-4f8a-bad8-4ebec1fea5e3",
    "10_class":   "9babaa3a-9681-4569-a23d-7a2c76521ae6",
    "6_class":    "a3585c66-92c8-4431-92d5-76ddd9c7791c",
    "drop_in":    "3336f7f4-c994-4e2b-bbf4-64de39e84cc1",
    "pilot":      "4a3c074b-e16c-4730-afff-6c2a955c0430",
}

# members table has a CHECK constraint: membership_tier IN ('unlimited', '10_class', '6_class')
# membership_status IN ('active', 'paused', 'cancelled', 'past_due', 'none')

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_iso(val: str):
    """Parse ISO timestamp string, return datetime or None."""
    if not val or not val.strip():
        return None
    try:
        # Handle formats: 2024-06-25T21:38:48.000Z
        val = val.strip().replace("Z", "+00:00")
        return datetime.fromisoformat(val)
    except ValueError:
        return None


def normalize_phone(phone: str) -> str:
    """Strip a phone to digits only for dedup matching."""
    if not phone:
        return ""
    return re.sub(r"[^\d]", "", phone.strip())


def clean_membership_name(name: str) -> str:
    """Strip leading asterisks and whitespace from Glofox membership names."""
    if not name:
        return ""
    return re.sub(r"^\*+\s*", "", name.strip())


def sql_str(val) -> str:
    """Escape a value for SQL string literal. Returns NULL for None/empty."""
    if val is None:
        return "NULL"
    s = str(val)
    if not s.strip():
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def sql_bool(val) -> str:
    """Convert to SQL boolean."""
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, str):
        return "TRUE" if val.strip().lower() in ("true", "1", "yes") else "FALSE"
    return "FALSE"


def sql_int(val, default=0) -> str:
    """Convert to SQL integer."""
    if val is None or str(val).strip() == "":
        return str(default)
    try:
        return str(int(val))
    except (ValueError, TypeError):
        return str(default)


def sql_date(val) -> str:
    """Format datetime as SQL date literal or NULL."""
    if val is None:
        return "NULL"
    if isinstance(val, datetime):
        return f"'{val.strftime('%Y-%m-%d')}'"
    return "NULL"


def sql_timestamp(val) -> str:
    """Format datetime as SQL timestamp literal or NULL."""
    if val is None:
        return "NULL"
    if isinstance(val, datetime):
        return f"'{val.strftime('%Y-%m-%dT%H:%M:%S+00:00')}'"
    return "NULL"


def deterministic_uuid(namespace: str, key: str) -> str:
    """Generate a deterministic UUID v5 from a namespace string and key."""
    ns_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, namespace)
    return str(uuid.uuid5(ns_uuid, key))


# ---------------------------------------------------------------------------
# Membership mapping
# ---------------------------------------------------------------------------

def map_membership(clean_name: str, plan_name: str, credits: int):
    """
    Map Glofox membership names to Meridian tier and plan_id.

    Returns (tier, plan_id, is_legacy_promo).
    tier can be None if no active membership (PAYG, expired promos).
    """
    name_lower = clean_name.lower() if clean_name else ""
    plan_lower = plan_name.lower() if plan_name else ""

    # Monthly Unlimited / Monthly Recurring -> unlimited tier
    if "monthly unlimited" in name_lower or "unlimited" in name_lower:
        return ("unlimited", PLAN_IDS["unlimited"], False)

    if "monthly recurring" in name_lower:
        # Monthly recurring is a class-pack style recurring membership
        # Map to 10_class tier as closest equivalent
        return ("10_class", PLAN_IDS["10_class"], False)

    # No Commitment Class Packs -> check plan name for size
    if "no commitment" in name_lower or "class pack" in name_lower:
        if "8" in plan_lower or "10" in plan_lower:
            return ("10_class", PLAN_IDS["10_class"], False)
        elif "4" in plan_lower or "6" in plan_lower:
            return ("6_class", PLAN_IDS["6_class"], False)
        else:
            # Default to 10_class for unknown pack sizes
            return ("10_class", PLAN_IDS["10_class"], False)

    # One-Time Drop-In -> drop_in (no tier, just a purchase)
    if "drop-in" in name_lower or "drop in" in name_lower:
        return (None, PLAN_IDS["drop_in"], False)

    # Sauna Sampler Three-Pack -> legacy promo (3-credit intro pack)
    if "sauna sampler" in name_lower or "three-pack" in name_lower:
        return (None, PLAN_IDS["6_class"], True)  # closest match: 6_class

    # First Class Free -> legacy promo (1 free credit)
    if "first class free" in name_lower:
        return (None, PLAN_IDS["drop_in"], True)

    # PAYG -> no membership
    if name_lower == "payg" or not name_lower:
        return (None, None, False)

    # Fallback
    return (None, None, False)


def determine_status(row: dict, tier, is_legacy_promo: bool, credits: int) -> str:
    """
    Determine member status:
      - 'active':  has a real membership tier, OR has credits > 0, OR booked within 60 days
      - 'none':    PAYG / legacy promo with 0 credits and no recent activity
      - 'cancelled': had a membership/credits but lapsed (no recent activity, 0 credits)

    Uses 'none' instead of 'inactive'/'churned' to match the DB check constraint.
    """
    join_date = parse_iso(row.get("Added", ""))
    last_booking = parse_iso(row.get("Last Booking", ""))

    # New member (joined after acquisition)
    is_new = join_date and join_date >= ACQUISITION_DATE

    # Recent activity
    cutoff = CURRENT_DATE - timedelta(days=ACTIVE_WINDOW_DAYS)
    has_recent_booking = last_booking and last_booking >= cutoff

    # Active recurring membership tier
    if tier in ("unlimited",):
        return "active"

    # Has credits remaining -> active
    if credits > 0:
        return "active"

    # Recent booking -> active
    if has_recent_booking:
        return "active"

    # Had a real tier but no activity -> cancelled
    if tier in ("10_class", "6_class"):
        return "cancelled"

    # Legacy promo / PAYG with no activity -> none
    return "none"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # -- Read CSV --
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: CSV not found at {CSV_PATH}")
        sys.exit(1)

    rows = []
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Read {len(rows)} rows from CSV")

    # -- Deduplicate by phone number --
    # Group by normalized phone; for groups > 1, keep the record with
    # the highest (Total Bookings + Total Attendances). Merge email consent
    # and SMS consent (keep True if any record has True).
    phone_groups = defaultdict(list)
    no_phone = []

    for row in rows:
        phone = normalize_phone(row.get("Phone", ""))
        if phone:
            phone_groups[phone].append(row)
        else:
            no_phone.append(row)

    deduped = []
    merge_count = 0
    merged_emails = []

    for phone, group in phone_groups.items():
        if len(group) == 1:
            deduped.append(group[0])
        else:
            # Sort by total activity descending to pick the primary record
            def activity_score(r):
                bookings = int(r.get("Total Bookings", 0) or 0)
                attendances = int(r.get("Total Attendances", 0) or 0)
                credits = int(r.get("Credits Remaining", 0) or 0)
                return bookings + attendances + credits

            group.sort(key=activity_score, reverse=True)
            primary = dict(group[0])  # copy

            # Merge consent flags: if ANY record has True, keep True
            for alt in group[1:]:
                if sql_bool(alt.get("Email Consent", "false")) == "TRUE":
                    primary["Email Consent"] = "true"
                if sql_bool(alt.get("SMS Consent", "false")) == "TRUE":
                    primary["SMS Consent"] = "true"
                # Take the most recent Last Booking
                primary_lb = parse_iso(primary.get("Last Booking", ""))
                alt_lb = parse_iso(alt.get("Last Booking", ""))
                if alt_lb and (not primary_lb or alt_lb > primary_lb):
                    primary["Last Booking"] = alt.get("Last Booking", "")
                # Sum credits
                primary_credits = int(primary.get("Credits Remaining", 0) or 0)
                alt_credits = int(alt.get("Credits Remaining", 0) or 0)
                primary["Credits Remaining"] = str(primary_credits + alt_credits)
                # Sum bookings and attendances
                primary["Total Bookings"] = str(
                    int(primary.get("Total Bookings", 0) or 0)
                    + int(alt.get("Total Bookings", 0) or 0)
                )
                primary["Total Attendances"] = str(
                    int(primary.get("Total Attendances", 0) or 0)
                    + int(alt.get("Total Attendances", 0) or 0)
                )

            deduped.append(primary)
            merge_count += len(group) - 1
            merged_emails.append([r.get("Email", "") for r in group])

    deduped.extend(no_phone)

    print(f"After dedup: {len(deduped)} unique members ({merge_count} duplicates merged)")

    # -- Process and build SQL --
    profile_inserts = []
    member_inserts = []
    credit_pack_inserts = []

    # Stats tracking
    stats = {
        "total": len(deduped),
        "status_counts": Counter(),
        "tier_counts": Counter(),
        "with_credits": 0,
        "total_credits": 0,
        "email_consent": 0,
        "sms_consent": 0,
        "waiver_signed": 0,
        "joined_pre_acquisition": 0,
        "joined_post_acquisition": 0,
        "legacy_promo": 0,
        "glofox_membership_counts": Counter(),
        "sources": Counter(),
    }

    for row in deduped:
        email = row.get("Email", "").strip().lower()
        if not email:
            continue

        first_name = row.get("First Name", "").strip()
        last_name = row.get("Last Name", "").strip()
        full_name = f"{first_name} {last_name}".strip()
        phone = row.get("Phone", "").strip()
        added = parse_iso(row.get("Added", ""))
        last_booking = parse_iso(row.get("Last Booking", ""))
        total_bookings = int(row.get("Total Bookings", 0) or 0)
        total_attendances = int(row.get("Total Attendances", 0) or 0)
        credits = int(row.get("Credits Remaining", 0) or 0)
        raw_membership = row.get("Membership Name", "").strip()
        clean_membership = clean_membership_name(raw_membership)
        plan_name = row.get("Membership Plan", "").strip()
        email_consent = row.get("Email Consent", "false")
        sms_consent = row.get("SMS Consent", "false")
        waiver = row.get("Studio Waiver", "").strip()
        waiver_signed = waiver.lower() == "accepted" if waiver else False
        source = row.get("Source", "").strip()

        # Stats: raw Glofox membership
        stats["glofox_membership_counts"][clean_membership or "PAYG"] += 1
        stats["sources"][source or "unknown"] += 1

        # Map membership
        tier, plan_id, is_legacy_promo = map_membership(clean_membership, plan_name, credits)

        # Determine status
        status = determine_status(row, tier, is_legacy_promo, credits)

        # Stats
        stats["status_counts"][status] += 1
        stats["tier_counts"][tier or "none"] += 1
        if credits > 0:
            stats["with_credits"] += 1
            stats["total_credits"] += credits
        if sql_bool(email_consent) == "TRUE":
            stats["email_consent"] += 1
        if sql_bool(sms_consent) == "TRUE":
            stats["sms_consent"] += 1
        if waiver_signed:
            stats["waiver_signed"] += 1
        if is_legacy_promo:
            stats["legacy_promo"] += 1
        if added and added < ACQUISITION_DATE:
            stats["joined_pre_acquisition"] += 1
        else:
            stats["joined_post_acquisition"] += 1

        # Generate deterministic UUIDs based on email
        profile_id = deterministic_uuid("meridian.profiles", email)
        member_id = deterministic_uuid("meridian.members", email)

        # -- Profile INSERT --
        profile_inserts.append(
            f"  ({sql_str(profile_id)}, {sql_str(STUDIO_ID)}, {sql_str(email)}, "
            f"{sql_str(full_name)}, {sql_str(phone)}, "
            f"'{{member}}', TRUE, FALSE, "
            f"{sql_timestamp(added) if added else 'now()'}, "
            f"{sql_timestamp(added) if added else 'now()'})"
        )

        # -- Member INSERT --
        # For tier: if it's a legacy promo or no tier, use NULL (but the column
        # has a CHECK constraint allowing only 'unlimited', '10_class', '6_class').
        # We'll set tier to NULL for non-tiered members.
        tier_sql = sql_str(tier) if tier else "NULL"

        # Waiver timestamp: use join date if signed
        waiver_at = sql_timestamp(added) if waiver_signed and added else "NULL"

        # Notes for legacy/migrated data
        notes_parts = []
        notes_parts.append(f"Imported from Glofox on 2026-03-20.")
        if raw_membership:
            notes_parts.append(f"Glofox membership: {raw_membership}")
        if plan_name:
            notes_parts.append(f"Glofox plan: {plan_name}")
        if is_legacy_promo:
            notes_parts.append("Legacy promotional membership.")
        notes = " | ".join(notes_parts)

        member_inserts.append(
            f"  ({sql_str(member_id)}, {sql_str(profile_id)}, {sql_str(STUDIO_ID)}, "
            f"{tier_sql}, {sql_str(status)}, "
            f"{sql_int(credits)}, 0, FALSE, 0, 0, "
            f"{sql_date(added) if added else 'CURRENT_DATE'}, "
            f"{sql_timestamp(last_booking)}, "
            f"{sql_int(total_attendances)}, 0, "
            f"NULL, NULL, "  # promo_code_used, referred_by_member_id
            f"0, FALSE, NULL, "  # strike_count, strike_penalty_exempt, strike_exempt_until
            f"{'TRUE' if waiver_signed else 'FALSE'}, {waiver_at}, "
            f"{sql_str(notes)}, "
            f"{sql_timestamp(added) if added else 'now()'}, "
            f"{sql_timestamp(added) if added else 'now()'})"
        )

        # -- Credit Pack INSERT (if member has remaining credits) --
        if credits > 0:
            pack_id = deterministic_uuid("meridian.credit_packs", email)

            # Determine pack type from membership
            if "sampler" in clean_membership.lower() or "three-pack" in clean_membership.lower():
                pack_type = "sauna_sampler_3"
                total_credits = 3
            elif "first class" in clean_membership.lower():
                pack_type = "first_class_free"
                total_credits = 1
            elif "8 class" in plan_name.lower():
                pack_type = "8_class_pack"
                total_credits = 8
            elif "4 class" in plan_name.lower():
                pack_type = "4_class_pack"
                total_credits = 4
            elif "drop" in clean_membership.lower():
                pack_type = "drop_in"
                total_credits = 1
            else:
                pack_type = "imported_credits"
                total_credits = credits  # unknown original size

            credit_pack_inserts.append(
                f"  ({sql_str(pack_id)}, {sql_str(member_id)}, {sql_str(STUDIO_ID)}, "
                f"{sql_str(pack_type)}, {sql_int(total_credits)}, {sql_int(credits)}, "
                f"NULL, NULL, "  # expires_at, grace_period_ends_at
                f"{sql_timestamp(added) if added else 'now()'}, "
                f"0, NULL, "  # price_paid, stripe_payment_intent_id
                f"{sql_timestamp(added) if added else 'now()'})"
            )

    # ---------------------------------------------------------------------------
    # Write SQL file
    # ---------------------------------------------------------------------------
    with open(SQL_OUTPUT, "w", encoding="utf-8") as f:
        f.write("-- =============================================================================\n")
        f.write("-- Meridian: The Sauna Guys Member Import from Glofox\n")
        f.write(f"-- Generated: {CURRENT_DATE.strftime('%Y-%m-%d')}\n")
        f.write(f"-- Source: members-2.csv ({len(rows)} raw rows -> {len(deduped)} deduplicated)\n")
        f.write(f"-- Studio: {STUDIO_ID}\n")
        f.write("-- =============================================================================\n\n")

        f.write("BEGIN;\n\n")

        # -- Profiles --
        f.write("-- ---------------------------------------------------------------------------\n")
        f.write(f"-- Profiles ({len(profile_inserts)} rows)\n")
        f.write("-- ---------------------------------------------------------------------------\n\n")
        f.write("INSERT INTO profiles (\n")
        f.write("  id, studio_id, email, full_name, phone,\n")
        f.write("  roles, is_active, exclude_from_analytics,\n")
        f.write("  created_at, updated_at\n")
        f.write(") VALUES\n")
        f.write(",\n".join(profile_inserts))
        f.write("\nON CONFLICT (id) DO UPDATE SET\n")
        f.write("  full_name = EXCLUDED.full_name,\n")
        f.write("  phone = EXCLUDED.phone,\n")
        f.write("  updated_at = now();\n\n")

        # -- Members --
        f.write("-- ---------------------------------------------------------------------------\n")
        f.write(f"-- Members ({len(member_inserts)} rows)\n")
        f.write("-- ---------------------------------------------------------------------------\n\n")
        f.write("INSERT INTO members (\n")
        f.write("  id, profile_id, studio_id,\n")
        f.write("  membership_tier, membership_status,\n")
        f.write("  credits_remaining, wallet_balance, member_discount_active,\n")
        f.write("  guest_passes_remaining, guest_passes_per_cycle,\n")
        f.write("  join_date, last_visit, total_visits, lifetime_value,\n")
        f.write("  promo_code_used, referred_by_member_id,\n")
        f.write("  strike_count, strike_penalty_exempt, strike_exempt_until,\n")
        f.write("  waiver_signed, waiver_signed_at,\n")
        f.write("  notes,\n")
        f.write("  created_at, updated_at\n")
        f.write(") VALUES\n")
        f.write(",\n".join(member_inserts))
        f.write("\nON CONFLICT (id) DO UPDATE SET\n")
        f.write("  membership_tier = EXCLUDED.membership_tier,\n")
        f.write("  membership_status = EXCLUDED.membership_status,\n")
        f.write("  credits_remaining = EXCLUDED.credits_remaining,\n")
        f.write("  total_visits = EXCLUDED.total_visits,\n")
        f.write("  notes = EXCLUDED.notes,\n")
        f.write("  updated_at = now();\n\n")

        # -- Credit Packs --
        if credit_pack_inserts:
            f.write("-- ---------------------------------------------------------------------------\n")
            f.write(f"-- Credit Packs ({len(credit_pack_inserts)} rows)\n")
            f.write("-- ---------------------------------------------------------------------------\n\n")
            f.write("INSERT INTO credit_packs (\n")
            f.write("  id, member_id, studio_id,\n")
            f.write("  pack_type, credits_total, credits_remaining,\n")
            f.write("  expires_at, grace_period_ends_at,\n")
            f.write("  purchased_at, price_paid, stripe_payment_intent_id,\n")
            f.write("  created_at\n")
            f.write(") VALUES\n")
            f.write(",\n".join(credit_pack_inserts))
            f.write("\nON CONFLICT (id) DO NOTHING;\n\n")

        f.write("COMMIT;\n")

    print(f"\nSQL written to: {SQL_OUTPUT}")
    print(f"  File size: {os.path.getsize(SQL_OUTPUT):,} bytes")

    # ---------------------------------------------------------------------------
    # Print summary / stats
    # ---------------------------------------------------------------------------
    print("\n" + "=" * 72)
    print("  IMPORT SUMMARY")
    print("=" * 72)

    print(f"\n  Raw CSV rows:              {len(rows):>6}")
    print(f"  After dedup (by phone):    {len(deduped):>6}")
    print(f"  Duplicates merged:         {merge_count:>6}")

    print(f"\n  --- Membership Status ---")
    for status in ["active", "cancelled", "paused", "past_due", "none"]:
        count = stats["status_counts"].get(status, 0)
        pct = (count / stats["total"] * 100) if stats["total"] else 0
        print(f"  {status:<20s}  {count:>6}  ({pct:5.1f}%)")

    print(f"\n  --- Membership Tier ---")
    for tier in ["unlimited", "10_class", "6_class", "none"]:
        count = stats["tier_counts"].get(tier, 0)
        pct = (count / stats["total"] * 100) if stats["total"] else 0
        print(f"  {tier:<20s}  {count:>6}  ({pct:5.1f}%)")

    print(f"\n  --- Credits ---")
    print(f"  Members with credits:      {stats['with_credits']:>6}")
    print(f"  Total credits remaining:   {stats['total_credits']:>6}")
    print(f"  Credit packs created:      {len(credit_pack_inserts):>6}")

    print(f"\n  --- Consent & Waivers ---")
    print(f"  Email consent:             {stats['email_consent']:>6}")
    print(f"  SMS consent:               {stats['sms_consent']:>6}")
    print(f"  Waiver signed:             {stats['waiver_signed']:>6}")

    print(f"\n  --- Timeline ---")
    print(f"  Pre-acquisition members:   {stats['joined_pre_acquisition']:>6}")
    print(f"  Post-acquisition members:  {stats['joined_post_acquisition']:>6}")
    print(f"  Legacy promo members:      {stats['legacy_promo']:>6}")

    print(f"\n  --- Glofox Membership Types (cleaned) ---")
    for name, count in stats["glofox_membership_counts"].most_common():
        print(f"  {name:<45s}  {count:>5}")

    print(f"\n  --- Sources ---")
    for name, count in stats["sources"].most_common():
        print(f"  {name:<30s}  {count:>5}")

    # Print merged duplicates detail
    if merged_emails:
        print(f"\n  --- Merged Duplicate Accounts ({len(merged_emails)} groups) ---")
        for group in merged_emails[:10]:
            print(f"    {' + '.join(group)}")
        if len(merged_emails) > 10:
            print(f"    ... and {len(merged_emails) - 10} more groups")

    print("\n" + "=" * 72)
    print("  SQL TABLES POPULATED")
    print("=" * 72)
    print(f"  profiles:      {len(profile_inserts):>6} rows")
    print(f"  members:       {len(member_inserts):>6} rows")
    print(f"  credit_packs:  {len(credit_pack_inserts):>6} rows")
    print("=" * 72)

    print("\nNext steps:")
    print("  1. Review seed-members.sql")
    print("  2. Run against Supabase:  psql <connection_string> -f scripts/seed-members.sql")
    print("  3. Or paste into Supabase SQL Editor")
    print()


if __name__ == "__main__":
    main()
