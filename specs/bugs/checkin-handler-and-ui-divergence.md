# BUG-019 + BUG-020 — Check-in Handler and UI Divergence

**Filed:** 2026-04-10 by Tier 3.12 Analyst
**Severity:** **HIGH** — silent data loss across multiple downstream systems
**Discovered:** Tier 3.12 Analyst — during a code trace of the `/api/check-in` POST handler and the admin "Check In All" UI flow
**Status:** OPEN — documented, NOT fixed in Tier 3.12. Requires a dedicated follow-up tier or an Tier 8 audit remediation pass.

---

## Summary

Two related bugs that together make the admin check-in feature severely broken in production:

- **BUG-019** — `/api/check-in` POST handler has 4 layers of `activity_log` silent-swallow bugs that would prevent ANY check-in from being audited, even if the handler were called.
- **BUG-020** — The admin "Check In All" UI button in `schedule/page.tsx:648-673` does a **direct Supabase client UPDATE**, completely bypassing the `/api/check-in` handler. This means the handler's bugs don't affect the UI path — but the UI path also skips EVERY handler side effect:
  - No activity_log row
  - No `members.total_visits` increment
  - No `members.last_visit` update
  - No `members.engagement_status` recalculation
  - No trainer bonus threshold evaluation
  - No Glofox attendance write-back (via Inngest)

The admin user experience: "Check In All" button appears to work — the bookings table shows `status='checked_in'` — but no downstream system (audit log, engagement tracking, trainer compensation, Glofox sync) knows about it.

---

## BUG-019 — `/api/check-in` handler layers

### L1 — `type='member_checked_in'` not in enum

File: `apps/web/src/app/api/check-in/route.ts:109`

```ts
await supabase.from("activity_log").insert({
  studio_id: studioId,
  actor_id: user.id,
  type: "member_checked_in",   // NOT IN ENUM
  subject_type: "booking",
  subject_id: booking_id,
  metadata: { ... },
});
```

The canonical `activity_log.type` value for check-ins is `'check_in'` (present since the Tier 0 baseline enum). `'member_checked_in'` is NOT in the CHECK constraint enum.

### L2 — activity_log description omitted (NOT NULL silent swallow)

The same insert omits the `description` field. `activity_log.description` is `NOT NULL` with no default. The insert fails silently.

### L3 — `type='trainer_bonus_triggered'` not in enum

File: `apps/web/src/app/api/check-in/route.ts:171`

```ts
await supabase.from("activity_log").insert({
  studio_id: studioId,
  actor_id: user.id,
  type: "trainer_bonus_triggered",   // NOT IN ENUM
  subject_type: "class",
  subject_id: booking.class_id,
  metadata: { ... },
});
```

No `trainer_*` values exist in the enum. Either needs a migration to add `'trainer_bonus_triggered'` (and potentially related trainer lifecycle events) OR a reuse of an existing value (e.g., `'strike'` — semantically wrong) OR dropping the activity log entirely.

Recommended: **migration to add `'trainer_bonus_triggered'`** and possibly `'trainer_bonus_paid'` for future tier 4+ compensation tracking.

### L4 — trainer bonus log description omitted

Same silent swallow as L2.

### Fix plan for BUG-019

1. Migration: extend `activity_log.type` CHECK enum with `'trainer_bonus_triggered'` (and optionally `'trainer_bonus_paid'`).
2. Rewrite `/api/check-in/route.ts` activity_log inserts:
   - Change `type: 'member_checked_in'` → `type: 'check_in'`
   - Add `description: \`Member checked in: ${memberName}\``
   - Capture `{ error: activityError }` + `console.error` on failure (canonical capture-and-log pattern)
   - Trainer bonus insert: keep `type: 'trainer_bonus_triggered'` (after migration lands)
   - Add `description: \`Trainer bonus triggered: ${trainerName} @ ${checkInCount} check-ins\``
   - Capture the error + console.error

Rough diff size: ~25 lines in the handler + 1 small migration.

---

## BUG-020 — Check In All UI bypasses the API

### Code

File: `apps/web/src/app/(admin)/schedule/page.tsx:648-673`

```ts
const handleCheckInAll = useCallback(async () => {
  if (!selectedClass) return
  setCheckingInAll(true)
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'checked_in',
        attended: true,
        checked_in_at: new Date().toISOString(),
      })
      .eq('class_id', selectedClass.id)
      .in('status', ['booked', 'confirmed'])  // 'confirmed' is phantom

    if (error) throw error
    showToast(`All attendees checked in for ${selectedClass.name}`)
    fetchAttendees(selectedClass.id)
  } catch (err) { ... }
}, [supabase, selectedClass, fetchAttendees, showToast])
```

### Consequences

1. **No activity_log row** — audit trail is lost
2. **`members.total_visits` never increments** — member visit count is wrong
3. **`members.last_visit` is stale** — engagement status computations miss recent activity
4. **`members.engagement_status` is never recalculated** — members look stale even when they just attended
5. **Trainer bonus threshold never evaluated** — trainers don't earn their per-class bonus
6. **No Glofox attendance write-back** — Glofox-migrated classes become desynced
7. **Phantom `'confirmed'` status filter** — same root-cause as the Tier 3.9 DELETE handler filter bug (line 274 there)

### Why this slipped past every prior tier

- Tier 2.2 Schedule smoke doesn't test check-in behavior (page-mount only)
- Tier 3.8/3.9/3.10 test the class lifecycle but don't check the attendee panel's buttons
- No prior tier exercised the check-in API handler end-to-end

### Fix plan for BUG-020

Rewrite `handleCheckInAll` to iterate the current attendee list and call `/api/check-in` per-row:

```ts
const handleCheckInAll = useCallback(async () => {
  if (!selectedClass) return
  setCheckingInAll(true)
  let successCount = 0
  let failCount = 0
  try {
    // Fetch only the bookings that need checking in (not already checked in)
    const toCheckIn = attendees.filter((a) => a.status === 'booked')

    // Call the API in parallel (batch with limit) or sequentially
    const results = await Promise.allSettled(
      toCheckIn.map((attendee) =>
        fetch('/api/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: attendee.id }),
        })
      )
    )

    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value.ok) successCount++
      else failCount++
    })

    showToast(
      failCount === 0
        ? `Checked in ${successCount} attendees`
        : `Checked in ${successCount}, ${failCount} failed`
    )
    fetchAttendees(selectedClass.id)
  } finally {
    setCheckingInAll(false)
  }
}, [...])
```

Notes:
- `attendee.id` is the BOOKING id (not member id)
- `Promise.allSettled` handles partial failures cleanly
- Toast message reports success/failure counts
- Rate-limiting: for classes with 20+ attendees, the parallel `fetch` loop is fine (small batches on a typical class)

Rough diff size: ~30 lines in `handleCheckInAll` + potential error state rendering.

---

## Related findings

### Phantom `'confirmed'` status value

Both the `/api/classes/[id]` DELETE handler (Tier 3.9 finding) and the `handleCheckInAll` UI (Tier 3.12 finding) use `'confirmed'` as a booking status value. This is NOT a valid enum value — the bookings CHECK constraint is `['booked', 'checked_in', 'no_show', 'cancelled', 'late_cancelled', 'waitlisted']`.

**Recommend grep audit:** `grep -r "confirmed" apps/web/src --include="*.ts" --include="*.tsx" | grep -i booking` to find every instance.

---

## Disposition

**Open.** Both bugs should be fixed in a dedicated follow-up tier or a Tier 8 remediation pass. The fix touches:
- 1 migration (BUG-019 L3 enum extension)
- 2 production files (BUG-019 handler, BUG-020 UI)
- 1 POM extension (post-fix, to test the full flow end-to-end)
- 6 test scenarios (the original Tier 3.12 scope)

Estimated effort: moderate. Comparable to Tier 3.8 in scope.

Tier 3.12 ships a narrow-scope test suite (3 tests) that verifies the as-shipped UI behavior at the DB level. The tests pass and document the current (broken) state; the bugs are filed for future fix.
