#!/usr/bin/env python3
"""
Meridian — Glofox Booking & Transaction Import Script
=====================================================
Parses The Sauna Guys' booking and transaction XLSX exports from Glofox
and generates SQL for Supabase import.

Input:  /Users/zach/Desktop/TSG Data/*.xlsx (4 booking files, 4 transaction files)
Output: /Users/zach/Desktop/literal-fishstick/scripts/seed-bookings-transactions.sql

Usage:  python3 scripts/import-bookings-transactions.py
"""

import os
import sys
import re
from datetime import datetime
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_DIR = Path("/Users/zach/Desktop/TSG Data")
OUTPUT_SQL = Path("/Users/zach/Desktop/literal-fishstick/scripts/seed-bookings-transactions.sql")
STUDIO_ID = "11111111-1111-1111-1111-111111111111"

BOOKING_FILES = [
    "All bookings_2026-03-13_065546.xlsx",   # Dec 2023
    "All bookings_2026-03-13_065529.xlsx",   # 2024
    "All bookings_2026-03-13_065512.xlsx",   # 2025
    "All bookings_2026-03-13_065440.xlsx",   # 2026 to Mar 17
]

TRANSACTION_FILES = [
    "Transactions_2026-03-13_084528.xlsx",   # Nov-Dec 2023
    "Transactions_2026-03-13_084521.xlsx",   # 2024
    "Transactions_2026-03-13_084456.xlsx",   # 2025
    "Transactions_2026-03-13_084431.xlsx",   # 2026 to Mar 13
]

# Glofox Event name -> Meridian class_type
CLASS_TYPE_MAP = {
    "Open Sauna": "open_sauna",
    "1 Hour Guided Nordic Sauna + Cold Plunge": "guided",
    "Hot x Yoga": "guided",
    "Sauna x Flow": "guided",
    "Free Promotional Class!": "open_sauna",
    "Class Leader Training Session": "guided",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sql_escape(val: str) -> str:
    """Escape a string for safe inclusion in a SQL literal."""
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def parse_booking_datetime(date_str: str, time_str: str) -> str:
    """
    Convert Glofox date (MM/DD/YYYY) + time (H:MM am/pm) to ISO-8601 timestamp.
    """
    combined = f"{date_str} {time_str}"
    try:
        dt = datetime.strptime(combined, "%m/%d/%Y %I:%M %p")
    except ValueError:
        # Fallback: try 24-hr
        dt = datetime.strptime(combined, "%m/%d/%Y %H:%M")
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def parse_time_24hr(time_str: str) -> str:
    """Convert '6:00 pm' -> '18:00'."""
    try:
        dt = datetime.strptime(time_str.strip(), "%I:%M %p")
        return dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return "00:00"


def parse_date_iso(date_str: str) -> str:
    """Convert MM/DD/YYYY -> YYYY-MM-DD."""
    try:
        dt = datetime.strptime(str(date_str).strip(), "%m/%d/%Y")
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return "1970-01-01"


def parse_amount(val) -> float:
    """Parse an amount value that could be a number, string, '-', or None."""
    if val is None or val == "-" or val == "":
        return 0.0
    try:
        return float(str(val).replace(",", "").replace("$", ""))
    except (ValueError, TypeError):
        return 0.0


def map_booking_status(attended: str) -> str:
    """Map Glofox 'Attended' (Yes/No) to Meridian BookingStatus."""
    if str(attended).strip().lower() == "yes":
        return "checked_in"
    return "confirmed"


def map_payment_status(status: str) -> str:
    """Map Glofox Status to Meridian PaymentStatus."""
    mapping = {
        "PAID": "succeeded",
        "FAILED": "failed",
        "REFUNDED": "refunded",
    }
    return mapping.get(str(status).strip().upper(), "succeeded")


def map_payment_method(method) -> str:
    """Map Glofox Method to a standard value."""
    if method is None or str(method).strip() == "":
        return "card"
    m = str(method).strip().lower()
    if m == "card":
        return "card"
    elif m == "cash":
        return "cash"
    elif m == "complimentary":
        return "complimentary"
    return "card"


def infer_payment_type(charge: str, plan: str) -> str:
    """Infer Meridian PaymentType from Glofox Charge/Plan description."""
    text = f"{charge or ''} {plan or ''}".lower()
    if "membership" in text or "recurring" in text:
        return "membership"
    elif "drop-in" in text or "drop in" in text:
        return "drop_in"
    elif "class pack" in text or "credit" in text or "pack" in text or "sampler" in text:
        return "credit_pack"
    elif "gift" in text:
        return "gift_card"
    elif "event" in text or "party" in text:
        return "event"
    elif "merch" in text or "merchandise" in text:
        return "merch"
    else:
        return "credit_pack"  # default for TSG data


# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------

def load_bookings() -> pd.DataFrame:
    """Load and concatenate all booking XLSX files."""
    frames = []
    for fname in BOOKING_FILES:
        path = DATA_DIR / fname
        if not path.exists():
            print(f"  WARNING: Booking file not found: {path}")
            continue
        df = pd.read_excel(path, engine="openpyxl")
        df["_source_file"] = fname
        frames.append(df)
        print(f"  Loaded {len(df)} rows from {fname}")
    if not frames:
        print("ERROR: No booking files loaded.")
        sys.exit(1)
    combined = pd.concat(frames, ignore_index=True)
    print(f"  Total bookings: {len(combined)}")
    return combined


def load_transactions() -> pd.DataFrame:
    """
    Load and concatenate all transaction XLSX files.
    Handles varying discount columns by reading by header name.
    """
    frames = []
    for fname in TRANSACTION_FILES:
        path = DATA_DIR / fname
        if not path.exists():
            print(f"  WARNING: Transaction file not found: {path}")
            continue
        df = pd.read_excel(path, engine="openpyxl")
        # Normalize to common columns only
        common_cols = [
            "Date", "Time", "Member", "Email address", "Sold By",
            "Charge", "Plan", "Method", "Amount (USD)",
            "Failed amount (USD)", "Fee (USD)", "Status",
            "Payout Date", "Payout ID", "Transaction ID",
        ]
        # Also grab Tax Total and Net amount if present
        optional_cols = ["Tax Total (USD)", "Fees & Tax",
                         "Net amount (Amount - Fees) (USD)"]
        keep = [c for c in common_cols + optional_cols if c in df.columns]
        df = df[keep].copy()
        df["_source_file"] = fname
        frames.append(df)
        print(f"  Loaded {len(df)} rows from {fname}")
    if not frames:
        print("ERROR: No transaction files loaded.")
        sys.exit(1)
    combined = pd.concat(frames, ignore_index=True)
    print(f"  Total transactions: {len(combined)}")
    return combined


# ---------------------------------------------------------------------------
# SQL generation
# ---------------------------------------------------------------------------

def generate_booking_sql(bookings: pd.DataFrame) -> list[str]:
    """
    Generate INSERT statements for the bookings table.
    Uses subqueries to resolve member_id from email and class_id from date+time.
    """
    statements = []
    skipped = 0

    for _, row in bookings.iterrows():
        email = row.get("Email")
        date_str = row.get("Date")
        time_str = row.get("Time")
        event_name = row.get("Event name", "")
        attended = row.get("Attended", "No")
        payment_method = row.get("Payment method")
        credits_used = row.get("Credits used", 0)
        guest_count = row.get("Guest booking count", 0)
        trainer_name = row.get("Trainer name", "")

        if pd.isna(email) or pd.isna(date_str) or pd.isna(time_str):
            skipped += 1
            continue

        email = str(email).strip().lower()
        date_iso = parse_date_iso(str(date_str))
        time_24 = parse_time_24hr(str(time_str))
        status = map_booking_status(attended)
        booked_at = parse_booking_datetime(str(date_str), str(time_str))

        checked_in_at = f"'{booked_at}'" if status == "checked_in" else "NULL"
        credits_deducted = int(credits_used) if not pd.isna(credits_used) else 1
        is_guest = "TRUE" if (not pd.isna(guest_count) and int(guest_count) > 0) else "FALSE"
        is_walk_in = "TRUE" if map_payment_method(payment_method) == "complimentary" else "FALSE"

        # Subquery: find member by email
        member_subq = (
            f"(SELECT id FROM profiles WHERE LOWER(email) = {sql_escape(email)} "
            f"AND studio_id = '{STUDIO_ID}' LIMIT 1)"
        )

        # Subquery: find class instance by date + start_time
        # Match on date and start_time; if multiple, take first
        class_subq = (
            f"(SELECT id FROM classes WHERE date = '{date_iso}' "
            f"AND start_time = '{time_24}' "
            f"AND studio_id = '{STUDIO_ID}' LIMIT 1)"
        )

        sql = (
            f"INSERT INTO bookings "
            f"(studio_id, class_id, member_id, status, credits_deducted, "
            f"checked_in_at, is_late_cancellation, is_walk_in, is_guest, "
            f"booked_by_user_id, created_at, updated_at) "
            f"SELECT "
            f"'{STUDIO_ID}', "
            f"{class_subq}, "
            f"{member_subq}, "
            f"'{status}', "
            f"{credits_deducted}, "
            f"{checked_in_at}, "
            f"FALSE, "
            f"{is_walk_in}, "
            f"{is_guest}, "
            f"{member_subq}, "
            f"'{booked_at}', "
            f"'{booked_at}' "
            f"WHERE {member_subq} IS NOT NULL "
            f"AND {class_subq} IS NOT NULL;"
        )

        statements.append(sql)

    if skipped > 0:
        print(f"  Skipped {skipped} booking rows (missing email/date/time)")

    return statements


def generate_transaction_sql(transactions: pd.DataFrame) -> list[str]:
    """
    Generate INSERT statements for the payments table.
    Uses subquery to resolve member_id from email.
    """
    statements = []
    skipped = 0

    for _, row in transactions.iterrows():
        email = row.get("Email address")
        date_str = row.get("Date")
        time_str = row.get("Time")
        member_name = row.get("Member", "")
        charge = row.get("Charge", "")
        plan = row.get("Plan", "")
        method = row.get("Method")
        amount_raw = row.get("Amount (USD)")
        failed_raw = row.get("Failed amount (USD)")
        fee_raw = row.get("Fee (USD)")
        status_raw = row.get("Status")
        transaction_id = row.get("Transaction ID")
        tax_raw = row.get("Tax Total (USD)")

        if pd.isna(email) or pd.isna(date_str):
            skipped += 1
            continue

        email = str(email).strip().lower()
        status = map_payment_status(str(status_raw) if not pd.isna(status_raw) else "PAID")
        payment_method = map_payment_method(method)
        payment_type = infer_payment_type(str(charge), str(plan))

        amount = parse_amount(amount_raw)
        failed_amount = parse_amount(failed_raw)
        fee = parse_amount(fee_raw)

        # For FAILED transactions, use the failed_amount as the amount
        if status == "failed" and amount == 0 and failed_amount > 0:
            amount = failed_amount

        # Convert to cents (Meridian stores in cents)
        amount_cents = int(round(amount * 100)) if not pd.isna(amount) else 0
        fee_cents = int(round(fee * 100)) if not pd.isna(fee) else 0

        # Build timestamp
        if pd.isna(time_str) or str(time_str).strip() == "":
            time_str = "12:00 am"
        created_at = parse_booking_datetime(str(date_str), str(time_str))

        # Build description from Charge + Plan
        description_parts = []
        if not pd.isna(charge) and str(charge).strip():
            description_parts.append(str(charge).strip())
        if not pd.isna(plan) and str(plan).strip():
            description_parts.append(str(plan).strip())
        description = " - ".join(description_parts) if description_parts else "Glofox import"

        # Stripe transaction ID (may be None)
        stripe_pi = "NULL"
        if not pd.isna(transaction_id) and str(transaction_id).strip() not in ("", "-"):
            stripe_pi = sql_escape(str(transaction_id).strip())

        # Refund handling
        refund_amount = amount_cents if status == "refunded" else 0
        refunded_at = f"'{created_at}'" if status == "refunded" else "NULL"

        # Member subquery
        member_subq = (
            f"(SELECT id FROM profiles WHERE LOWER(email) = {sql_escape(email)} "
            f"AND studio_id = '{STUDIO_ID}' LIMIT 1)"
        )

        sql = (
            f"INSERT INTO payments "
            f"(studio_id, member_id, amount, wallet_amount, card_amount, "
            f"payment_type, status, stripe_payment_intent_id, "
            f"description, member_discount_applied, discount_amount, "
            f"refund_amount, refunded_at, created_at) "
            f"SELECT "
            f"'{STUDIO_ID}', "
            f"{member_subq}, "
            f"{amount_cents}, "
            f"0, "  # wallet_amount
            f"{amount_cents}, "  # card_amount (all card for Glofox imports)
            f"'{payment_type}', "
            f"'{status}', "
            f"{stripe_pi}, "
            f"{sql_escape(description[:500])}, "
            f"FALSE, "
            f"0, "
            f"{refund_amount}, "
            f"{refunded_at}, "
            f"'{created_at}' "
            f"WHERE {member_subq} IS NOT NULL;"
        )

        statements.append(sql)

    if skipped > 0:
        print(f"  Skipped {skipped} transaction rows (missing email/date)")

    return statements


# ---------------------------------------------------------------------------
# Summary statistics
# ---------------------------------------------------------------------------

def print_summary(bookings: pd.DataFrame, transactions: pd.DataFrame):
    """Print summary statistics to stdout."""
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)

    # Bookings summary
    print(f"\nBOOKINGS: {len(bookings)} total")
    print(f"  Unique members (by email): {bookings['Email'].nunique()}")
    print(f"  Date range: {bookings['Date'].min()} to {bookings['Date'].max()}")
    print(f"  Events:")
    for event, count in bookings["Event name"].value_counts().items():
        print(f"    {event}: {count}")
    print(f"  Attended: {(bookings['Attended'] == 'Yes').sum()} / {len(bookings)}"
          f" ({(bookings['Attended'] == 'Yes').mean() * 100:.1f}%)")
    print(f"  Trainers:")
    for trainer, count in bookings["Trainer name"].value_counts().items():
        print(f"    {trainer}: {count}")

    # Transaction summary
    print(f"\nTRANSACTIONS: {len(transactions)} total")
    print(f"  Unique members (by email): {transactions['Email address'].nunique()}")

    # Parse amounts safely
    amounts = transactions["Amount (USD)"].apply(parse_amount)
    failed = transactions["Failed amount (USD)"].apply(parse_amount) if "Failed amount (USD)" in transactions.columns else pd.Series([0])

    status_col = transactions["Status"]
    paid_mask = status_col.astype(str).str.strip().str.upper() == "PAID"
    failed_mask = status_col.astype(str).str.strip().str.upper() == "FAILED"
    refunded_mask = status_col.astype(str).str.strip().str.upper() == "REFUNDED"

    print(f"  Status breakdown:")
    print(f"    PAID:     {paid_mask.sum()} (${amounts[paid_mask].sum():,.2f})")
    print(f"    FAILED:   {failed_mask.sum()} (${failed.sum():,.2f} failed amount)")
    print(f"    REFUNDED: {refunded_mask.sum()} (${amounts[refunded_mask].sum():,.2f})")
    print(f"  Total revenue (PAID): ${amounts[paid_mask].sum():,.2f}")

    print(f"\n  Payment methods:")
    for method, count in transactions["Method"].value_counts(dropna=False).items():
        label = method if pd.notna(method) else "(none)"
        print(f"    {label}: {count}")

    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Meridian — Glofox Booking & Transaction Importer")
    print("=" * 60)

    print("\nLoading booking files...")
    bookings = load_bookings()

    print("\nLoading transaction files...")
    transactions = load_transactions()

    print_summary(bookings, transactions)

    print("Generating SQL...")
    booking_stmts = generate_booking_sql(bookings)
    print(f"  Generated {len(booking_stmts)} booking INSERT statements")

    transaction_stmts = generate_transaction_sql(transactions)
    print(f"  Generated {len(transaction_stmts)} transaction INSERT statements")

    # Write SQL file
    OUTPUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_SQL, "w") as f:
        f.write("-- Meridian: Glofox Booking & Transaction Import\n")
        f.write(f"-- Generated: {datetime.now().isoformat()}\n")
        f.write(f"-- Studio ID: {STUDIO_ID}\n")
        f.write(f"-- Total bookings: {len(booking_stmts)}\n")
        f.write(f"-- Total transactions: {len(transaction_stmts)}\n")
        f.write("--\n")
        f.write("-- NOTE: This script uses subqueries to resolve member_id from email\n")
        f.write("-- and class_id from date+time. Members and classes must be imported first.\n")
        f.write("-- Rows where the member or class is not found will be silently skipped\n")
        f.write("-- (the WHERE clause filters them out).\n")
        f.write("--\n")
        f.write("-- Run with: psql $DATABASE_URL -f seed-bookings-transactions.sql\n")
        f.write("\n")

        f.write("BEGIN;\n\n")

        # Bookings
        f.write("-- " + "=" * 58 + "\n")
        f.write("-- BOOKINGS\n")
        f.write("-- " + "=" * 58 + "\n\n")
        for stmt in booking_stmts:
            f.write(stmt + "\n\n")

        # Transactions
        f.write("-- " + "=" * 58 + "\n")
        f.write("-- PAYMENTS (TRANSACTIONS)\n")
        f.write("-- " + "=" * 58 + "\n\n")
        for stmt in transaction_stmts:
            f.write(stmt + "\n\n")

        f.write("COMMIT;\n")

    file_size_kb = OUTPUT_SQL.stat().st_size / 1024
    print(f"\nSQL written to: {OUTPUT_SQL}")
    print(f"File size: {file_size_kb:.1f} KB")
    print(f"Total statements: {len(booking_stmts) + len(transaction_stmts)}")
    print("\nDone.")


if __name__ == "__main__":
    main()
