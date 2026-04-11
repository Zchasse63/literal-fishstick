# Tier 4.4 — Memberships: Cancel — 🚫 GAP-FILED

**Run date:** 2026-04-10
**Pipeline:** Analyst-only (feature absent)
**Status:** 🚫 GAP-FILED — no `/api/members/[id]/cancel` endpoint, no UI affordance, no membership_tier='none' transition path
**Tests written:** 0
**Tests specified for when feature ships:** 4 (documented below)

---

## Why this tier doesn't run

Tier 4.4 in the roadmap is "Memberships: Cancel" — semantically: end a recurring membership while preserving the member account/profile.

### State of cancellation in the codebase

The following routes exist on `/api/members/[id]`:
- `pause` — pauses membership (temporary suspension, can be reactivated)
- `upgrade` — changes tier (assign + upgrade combined per Tier 4.1)
- `downgrade` — schedules a downgrade for next cycle (Tier 4.3)
- `route.ts` DELETE — archives the entire member (Tier 3.7)

**No `/api/members/[id]/cancel` route exists.** No "cancel membership" route at all.

### Workarounds (none of which are "cancel")

1. **Pause** — temporary, not the same as cancel
2. **Downgrade to 6_class** — still has a paid plan, just cheaper
3. **Archive (DELETE)** — destructive, removes the entire member
4. **Direct DB UPDATE** to `members.membership_tier = null` and `members.membership_status = 'cancelled'` — bypasses every safeguard and audit trail

The `VALID_PLANS` constant in upgrade/downgrade is `['unlimited', '10_class', '6_class']` — `'none'` or `'cancelled'` is NOT in the list, so the upgrade/downgrade routes cannot be used to cancel.

The `members.membership_status` column likely has a CHECK constraint that includes `'cancelled'` (the field exists per Tier 3.6/3.7 reads), but no API exposes a transition to that status.

### UI

No "Cancel Membership" button anywhere in the admin panel. The MemberProfilePanel exposes Pause / Upgrade / Archive — none of which is "cancel".

---

## Disposition

**Gap-filed.** Feature is absent at both API and UI layers. Filed under BUG-008 as a new gap (GAP-6 Memberships Cancel Missing) and documented in this report.

This is the **5th gap-file in the pipeline** (3.2 Refund, 3.3 Issue Credit, 3.11 Waitlist, 4.2 Stripe-stub-covered, 4.4 Cancel) and the **3rd "feature absent" gap-file** alongside 3.2 and 3.11 (3.3 was also absent + 4.2 was covered-by-adjacent).

---

## Scenarios for when the feature ships (4)

### Scenario 1 — P0 — Cancel an active membership

```
GIVEN a member with membership_tier='unlimited' and membership_status='active'
WHEN admin POSTs to /api/members/[id]/cancel with body { effective: 'immediate' }
THEN DB: members.membership_tier = null
AND DB: members.membership_status = 'cancelled'
AND DB: members.cancelled_at is set to now
AND DB: activity_log row with type='membership_change' and action='cancelled' in metadata
```

### Scenario 2 — P0 — Cancel scheduled for end-of-cycle

```
GIVEN a member with membership_tier='unlimited'
WHEN admin POSTs to /api/members/[id]/cancel with body { effective: 'next_cycle' }
THEN DB: members.membership_tier is UNCHANGED (still unlimited)
AND DB: members.notes contains 'Pending cancellation at next billing cycle'
AND DB: activity_log row with action='cancellation_scheduled'
```

### Scenario 3 — P1 — Cancel rejects already-cancelled member

```
GIVEN a member with membership_status='cancelled'
WHEN admin POSTs to /api/members/[id]/cancel
THEN response is 400 with error 'Membership is already cancelled'
AND DB: no new activity_log row is written
```

### Scenario 4 — P1 — Cancel preserves the member profile

```
GIVEN an active member with bookings and transaction history
WHEN admin cancels their membership
THEN DB: profiles row is unchanged (member can still log in)
AND DB: bookings rows are unchanged (history preserved)
AND DB: transactions rows are unchanged (revenue history preserved)
AND only the members.membership_tier and membership_status fields change
```

---

## What's needed before this tier can run

### Backend

1. **New `members.membership_status` enum value** (or verify `'cancelled'` is already valid). If not, migration to add it.
2. **New endpoint:** `POST /api/members/[id]/cancel` — body `{ effective: 'immediate' | 'next_cycle' }`
3. **Idempotent guard** for already-cancelled members
4. **Activity log entry** with `type='membership_change'` (canonical now) and `metadata.action='cancelled'`
5. **Optional:** Stripe subscription.cancel call (out of tier scope unless Stripe is integrated)

### UI

1. **"Cancel Membership" button** on the MemberProfilePanel (next to Archive/Pause/Upgrade)
2. **Confirmation dialog** with effective-date selector (immediate vs next cycle)
3. **Visual indication** that the membership is cancelled (badge, banner, etc)

### Tests

1. POM extension: `cancelMembershipBtn()`, `cancelMembershipFromPanel(effective)`
2. Spec: 4 scenarios above

Estimated effort: medium. Mostly pattern reuse from Tier 4.1/4.3.

---

## Tier 4 status

**3/8 → 4/8** (2 narrow-scope + 2 gap-filed). Next: Tier 4.5 (Corporate: Create Account). Then 4.6 Corporate Event, 4.7 Operations Waiver, 4.8 Smart Segments.
