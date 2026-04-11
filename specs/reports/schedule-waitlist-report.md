# Tier 3.11 — Schedule: Waitlist Add/Remove — 🚫 GAP-FILED

**Run date:** 2026-04-10
**Pipeline:** Analyst-only (evidence of absence)
**Status:** 🚫 GAP-FILED — user-facing waitlist operations are absent. BUG-008 GAP-3 continues to cover this.
**Tests written:** 0
**Tests specified for when the feature ships:** 5 (documented below)

---

## Scope

Per the Tier 3 roadmap, this tier was supposed to cover:

> **3.11 Schedule: Waitlist Add/Remove** — admin adds members to a class's waitlist, admin removes members from a waitlist, both with activity_log entries.

---

## Evidence of absence

### Backend — **partial**

The waitlist backend exists in fragments:

1. **Schema** — `bookings.status` CHECK enum includes `'waitlisted'`. Columns `waitlist_position`, `waitlist_promoted_at`, `waitlist_claim_expires_at` exist on `bookings` (confirmed by Tier 3.9 `information_schema.columns` probe on the bookings table).
2. **Display** — `apps/web/src/app/(admin)/schedule/page.tsx` renders waitlisted attendees with amber badges (lines 444, 456) and sorts them after checked-in/booked/no-show (line 617).
3. **Promotion cron** — `apps/web/src/app/api/cron/waitlist-promote/route.ts` exists, runs periodically to promote waitlisted members to booked when seats open up.
4. **AI helper** — `apps/web/src/app/api/ai/waitlist-message/route.ts` generates waitlist-related messages (Phase 1 AI feature).

### Backend — **MISSING**

1. **No `POST /api/classes/[id]/waitlist`** endpoint for adding a member to a class's waitlist.
2. **No `DELETE /api/classes/[id]/waitlist/[memberId]`** endpoint for removing a member from a waitlist.
3. **No `PUT /api/bookings/[id]/waitlist/position`** endpoint for reordering waitlist positions.

Searched via `grep -r "waitlist" apps/web/src/app/api/classes` → no matches. The `bookings` table has waitlist columns, and the cron promotes entries, but there's no admin CRUD surface to create or delete waitlist entries.

### UI — **MISSING**

1. **No "Add to Waitlist" button** on the ClassDetailPanel. The panel shows waitlisted attendees but has no affordance to add a new one.
2. **No "Remove from Waitlist" affordance** next to waitlisted attendees. The attendee list is read-only.
3. **No waitlist management interface** anywhere in the admin dashboard.

Searched `apps/web/src/app/(admin)/schedule/page.tsx` + `_components/ClassFormModal.tsx` for `addToWaitlist|removeFromWaitlist|waitlistAdd|waitlistRemove|Add to Waitlist|Remove from Waitlist` → no matches.

### Direct path from admin: impossible

An admin cannot currently add a member to a class's waitlist via:
- The schedule module (no button)
- The members module (no class-association UI)
- The class detail panel (read-only attendee list)
- Any API endpoint (none exist)

The only way a booking gets `status='waitlisted'` today is:
- A member-facing booking flow when a class is full (Phase 5 iOS app — not built)
- Direct Supabase row insert (bypassing the app)
- Migration of Glofox data (if Glofox exported waitlist entries)

---

## Relationship to BUG-008

This gap was already documented in BUG-008 (`specs/bugs/phase-1-revenue-schedule-gaps.md`) as **GAP-3 Schedule Waitlist Add/Remove MISSING**. This report is the Tier 3.11 gap-file confirming the gap still exists and documenting the scenarios for when the feature ships.

---

## Scenarios for when the feature ships (5)

When the waitlist Add/Remove feature is built, the `/qa-council` pipeline can be re-run against these scenarios without redesigning the test plan.

### Scenario 1 — P0 — Add member to a full class's waitlist

```
GIVEN a class with capacity=1 already has 1 confirmed booking
WHEN admin opens the class detail panel and clicks "Add to Waitlist"
AND selects a member from the search dialog
THEN DB: bookings row created with status='waitlisted', waitlist_position=1
AND DB: activity_log row with type='booking' (or a new 'waitlist_added' type) and non-null description
AND panel: waitlisted attendee is visible in the attendee list with amber badge
```

### Scenario 2 — P0 — Add second member to waitlist (position increments)

```
GIVEN a class already has 1 member on the waitlist at position 1
WHEN admin adds a second member to the waitlist
THEN DB: bookings row for member 2 has waitlist_position=2
AND DB: member 1's waitlist_position is still 1 (unchanged)
```

### Scenario 3 — P0 — Remove a waitlisted member

```
GIVEN a class has 2 waitlisted members at positions 1 and 2
WHEN admin clicks remove on the position-1 member
THEN DB: position-1 booking row is deleted (or status='cancelled')
AND DB: position-2 member's waitlist_position is now 1 (renumber on removal)
AND DB: activity_log row with type='cancellation' (or 'waitlist_removed')
```

### Scenario 4 — P1 — Duplicate add is rejected

```
GIVEN a member is already on a class's waitlist
WHEN admin tries to add the same member again
THEN the request returns 409 (or equivalent conflict error)
AND DB: no duplicate row is inserted
AND the waitlist count is unchanged
```

### Scenario 5 — P1 — Promotion cron converts waitlisted to booked when seat opens

```
GIVEN a class at capacity with 1 waitlisted member
WHEN a confirmed booking is cancelled (seat opens)
AND the waitlist-promote cron runs
THEN DB: the waitlisted member's status is now 'booked'
AND DB: waitlist_promoted_at is set to the cron run time
AND DB: activity_log has a promotion entry
```

**Note:** Scenario 5 exercises the existing cron (which already exists). It's worth testing when the CRUD ships to prove the full lifecycle works.

---

## What's needed to close this gap

### Backend (estimated 3-4 files)

1. `POST /api/classes/[id]/waitlist` — create a waitlisted booking. Validate: member isn't already booked or waitlisted. Determine next `waitlist_position` via `SELECT COALESCE(MAX(waitlist_position), 0) + 1`.
2. `DELETE /api/bookings/[id]` — remove a booking (or update to `status='cancelled'`). Renumber remaining waitlist positions if the deleted booking was waitlisted.
3. `activity_log.type` enum extension — consider adding `waitlist_added` and `waitlist_removed` for cleaner audit trail. Could reuse `booking` and `cancellation` but the separation is more informative.

### UI (estimated 3-4 components)

1. "Add to Waitlist" button on the ClassDetailPanel's attendee section, visible when `booked_count >= capacity`.
2. Member search dialog (similar to the booking dialog pattern — future admin UX decision).
3. Remove button next to each waitlisted attendee in the panel list.
4. Visual affordance for "Position X of N" on each waitlisted entry.

### Test infrastructure

1. Extend `seedClass` to accept `waitlisted: { memberId: string; position: number }[]` for pre-populating waitlist state (optional, scenarios can also create waitlisted rows directly).
2. `SchedulePage` POM additions: `addToWaitlistBtn()`, `removeFromWaitlistBtn(position)`, helper methods.
3. 5-test spec file (per scenarios above).

### Migrations

Possibly 1 (if we add `waitlist_added`/`waitlist_removed` enum values). Not strictly required — can reuse `booking` and `cancellation`.

---

## Disposition

**Gap-filed.** No code, no migrations, no UI. The scenarios above are preserved for re-running `/qa-council` when the feature ships.

**Tier 3 counter advances to 11/12** (8 full + 3 gap-filed).

**Next:** Tier 3.12 (Check-in QR + manual) — the final Tier 3 run.

---

## Design note — pattern observation

Tier 3.11 makes the third gap-file in Tier 3 alongside Tier 3.2 (Revenue Refund) and Tier 3.3 (Revenue Issue Credit). All three are covered by BUG-008 Phase 1 completeness audit. The pattern:

- **Tier 3 runs exist for 12 features** per the roadmap
- **BUG-008 identified 5 GAPs** at the Analyst level (GAP-1 Refund, GAP-2 Issue Credit, GAP-3 Waitlist, GAP-4 Cancel Class UI, GAP-5 Exclude from Analytics UI)
- **Tier 3.7 closed GAP-5** (Exclude from Analytics UI wired inline)
- **Tier 3.9 closed GAP-4** (Cancel Class UI built inline)
- **Tier 3.2 + 3.3 + 3.11 remain gap-filed** (Refund, Issue Credit, Waitlist)
- **The remaining 3 gap-filed features** are the ones where backend was ALSO missing, not just UI. Cancel Class and Exclude from Analytics had full backend support; Refund, Issue Credit, and Waitlist don't. Inline builds are cheap when backend is ready; expensive when backend is absent.

**Standing directive:** for future tiers, gap-file when BOTH backend and UI are absent. Inline-build when backend is ready and UI is missing. This heuristic has held for all 5 BUG-008 gaps.
