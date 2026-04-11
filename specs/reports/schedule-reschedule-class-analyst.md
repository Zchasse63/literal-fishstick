# Tier 3.10 — Schedule: Reschedule Class — Analyst Report

**Run date:** 2026-04-10
**Phase:** 1 (Analyst)
**Status:** 🔴 **BUG-018 filed** — Edit modal uses phantom `description` field, wipes notes on save. Must be fixed for Tier 3.10 tests to pass.

---

## Feature scope

Admin changes a scheduled class's start time, end time, or date via the Edit Class modal (opened from the ClassDetailPanel's Edit button). The modal pre-populates with current values, user changes the time fields, submits → PUT `/api/classes/[id]` with new `start_time`/`end_time` → DB row updates → activity_log gets `class_updated` row.

Business context: rescheduling is a core admin operation. Trainers fall ill, facilities have issues, weather-affected outdoor classes need to move. The admin needs to change the time without:
- Losing the class identity (same ID, same type, same booked members)
- Losing the class's notes or other metadata
- Breaking existing bookings

---

## State on entry

### Backend (already fixed by Tier 3.9)

- `PUT /api/classes/[id]` is correctly implemented:
  - Role check ✓ (L5 fix from Tier 3.9)
  - `description → notes` remap ✓ (L1 fix)
  - Activity log with non-null description + capture-and-log ✓ (L3 fix)
  - `class_updated` type is the default for non-cancel status updates ✓
  - `start_time → starts_at` and `end_time → ends_at` remap ✓ (pre-existing, correct)
  - Time validation: date parsing ✓ (pre-existing)
  - BUT: no explicit end-after-start validation on PUT (only POST has it). Reschedule to end ≤ start would be accepted at the API level.

### UI (already in place)

- ClassFormModal (Tier 3.8) supports edit mode via `editData` prop
- ClassDetailPanel (Tier 3.9) has Edit Class button wired to opening the modal in edit mode
- schedule/page.tsx:862-876 constructs `editData` from the raw class row

### UI — BROKEN: BUG-018 phantom description reference

The existing edit flow in `schedule/page.tsx:862-876` populates `editData.description` from `(raw as any).description ?? null`. Since `classes.description` doesn't exist (the column is `notes`), `raw.description` is always `undefined` → `editData.description` is always `null`.

The ClassFormModal then does `setDescription(editData.description ?? '')` which sets the description textarea to `''`.

When the user clicks Save, the modal's `handleSubmit` sends `description: description || null` → `description: null` in the body → the PUT handler remaps to `updates.notes = null` → **the existing notes value is wiped on every edit.**

**Impact:** Any edit of a class — change time, change trainer, change capacity, anything — clears the class's notes. This is pre-existing (it predates both Tier 3.8 and Tier 3.9) but it was never caught because no prior tier tested the edit path.

### POM + fixture support

- SchedulePage POM has Tier 3.8 Create Class section + Tier 3.9 Cancel Class section
- Tier 3.8's `openNewClassModal()` is CREATE-specific; we need an analogous `openEditClassModal` or reuse the existing flow
- `fillClassForm()` (Tier 3.8) works for both create and edit mode (it just fills whatever fields are passed)
- `submitClassForm()` (Tier 3.8) filters `method === 'POST'` — for edit we need `method === 'PUT'`. Either add a parameter or create `submitEditClassForm()`.
- `seedClass()` supports optional notes? Check.

---

## Probe results

### Probe 1 — `information_schema.columns` for classes (reuse)

Same 21 columns as Tier 3.8 / 3.9. Key facts for this tier:
- `starts_at`, `ends_at` are `timestamp with time zone` NOT NULL
- `updated_at` NOT NULL default `now()` — the PUT handler sets this explicitly
- `notes` text NULL — the ACTUAL column for "description" text (BUG-015 L1 + BUG-017 L1 addressed this at the handler level, but BUG-018 is the UI-side mirror)

### Probe 2 — `pg_constraint` for `classes` CHECK constraints

- `classes_status_check`: `['scheduled', 'in_progress', 'completed', 'cancelled']` — `'scheduled'` is the valid value for rescheduled classes (no change).
- No `classes_time_check` constraint that asserts `ends_at > starts_at`. The DB will accept `ends_at < starts_at`. Time validation is app-layer only.

### Probe 3 — `pg_policies` for `classes` (reuse)

`classes_update` RLS is studio-scoped with no role restriction (BUG-016 L7 — still out of scope). BUT now that Tier 3.9 added an app-layer PUT role check, L7 is mitigated at the app layer. Defense-in-depth failure only.

### Probe 4 — `seedClass` + fixtures

Checking `seedClass(opts)` signature:

Looking at `e2e/fixtures/db.ts:270-297`, `seedClass` does NOT accept a `notes` option. The insert at line 277-291 has `notes` not listed in the insert body — so `notes` is always `null` on seeded classes unless modified via a direct update afterwards.

**Tier 3.10 change:** Either extend `seedClass` to accept `notes: string | null`, or inline-update the notes after seeding. Extending the helper is cleaner.

### Probe 5 — Panel-button ID trace

`selectedClass.id → raw.id → editData.id → PUT /api/classes/${editData.id}`. Same `classes.id` pass-through as Tier 3.9. No BUG-013-style divergence.

### Probe 6 — Edit modal submit flow

The modal's `handleSubmit` at `ClassFormModal.tsx:106-145`:

```ts
const startIso = new Date(`${date}T${startTime}`).toISOString()
const endIso = new Date(`${date}T${endTime}`).toISOString()
const res = await fetch(url, {
  method: isEdit ? 'PUT' : 'POST',
  ...
  body: JSON.stringify({
    class_type_id: classTypeId,
    start_time: startIso,
    end_time: endIso,
    capacity,
    trainer_id: trainerId || null,
    title: title || null,
    description: description || null,  // ← BUG-018 wipe path
  }),
})
```

Notable: the modal sends ALL fields on every edit (not a delta payload like EditMemberModal). So every edit hits the PUT handler's full allowlist remap, including the phantom `description` flow.

---

## BUG-018 — Edit Class modal phantom description reference

### Root cause

`schedule/page.tsx:875` reads `(raw as any).description ?? null` from a class row. The `classes` table has no `description` column — the user-facing description field maps to `notes` at the DB layer (this was BUG-015 L1 / BUG-017 L1). The cast to `any` hides the missing property at TypeScript time.

### Symptoms

- Edit modal always opens with an empty description textarea (even if the class has notes)
- Submitting the modal sends `description: null` in the body
- The PUT handler's L1 remap: `if (body.description !== undefined) updates.notes = body.description ?? null`
- Result: `updates.notes = null` → the class's notes column is wiped on save

### Impact

- Every edit of a class (time, capacity, trainer, title) destroys its notes
- Silent data loss — the user doesn't see the old notes disappear until they reload the class or check the calendar detail
- Pre-existing since before Tier 3.8 — never tested because no prior tier exercised the edit path

### Fix plan

**3 changes in 2 files:**

1. `schedule/page.tsx:875` — change `(raw as any).description ?? null` to `raw.notes ?? null`
2. `ClassFormModal.tsx:36-43` — the `editData` interface has `description: string | null`. Change to `notes: string | null`. This is a breaking change for the `editData` prop shape, but there's only one call site.
3. `ClassFormModal.tsx:91` — `setDescription(editData.description ?? '')` → `setDescription(editData.notes ?? '')`. The internal `description` state variable is fine (it's still labeled "Description" in the UI); only the source is the `notes` column.

The internal `description` state in the modal can stay named `description` — it's the UI label, not a DB field name. Only the prop interface and the initial-seed line change.

---

## Test scenarios (5 total — 4 P0, 1 P1)

### Scenario 1 — P0 — Happy path: reschedule a class to a new time

**Proves:** The core reschedule flow — PUT with new times works, other fields preserved, activity_log lands.

```
GIVEN a seeded class at 17:00-18:00 tomorrow with title "E2E Test Reschedule_..."
WHEN admin navigates to /schedule, clicks the class, clicks Edit Class
AND changes the start time to 19:00 and end time to 20:00
AND clicks Save Changes
THEN the modal closes
AND DB: classes row has starts_at matching 19:00 (tomorrow) and ends_at matching 20:00
AND DB: title, capacity, status, class_type_id unchanged
AND DB: activity_log row with type='class_updated', description containing 'updated' + title
```

### Scenario 2 — P0 — Activity log explicit proof

**Proves:** Activity log type is `class_updated` (not `class_cancelled` or phantom type), description non-null, metadata captures the new start_time/end_time.

```
GIVEN a class was rescheduled in the previous step
WHEN we query activity_log by subject_id=<class.id> and type='class_updated'
THEN exactly one row exists
AND row.description contains 'Class updated'
AND row.description contains the class title
AND row.metadata contains starts_at and ends_at (the new times)
AND row.type is 'class_updated' (NOT 'class_cancelled' — this proves the wasCancelled conditional is correct)
```

### Scenario 3 — P0 — Notes preservation (BUG-018 regression guard)

**Proves:** The BUG-018 fix works — rescheduling a class with notes does NOT wipe the notes.

```
GIVEN a seeded class WITH notes 'Important: bring extra towels'
WHEN admin opens the edit modal, changes the start time, saves
THEN DB: classes.notes still equals 'Important: bring extra towels'
```

This is the most important scenario — it's the only explicit test of the BUG-018 fix. Without the fix, this test fails: notes become `null` after save.

### Scenario 4 — P0 — Other fields preserved

**Proves:** Only the fields the user edited are changed; everything else is preserved.

```
GIVEN a seeded class at 17:00-18:00 with capacity=8, trainer_id=X, title="Morning Flow"
WHEN admin edits only the start time (to 18:00) and end time (to 19:00)
THEN DB: capacity still 8, trainer_id still X, title still "Morning Flow", class_type_id unchanged
AND DB: only starts_at and ends_at differ from the seeded values
```

Note: trainer_id seeding requires a seeded trainer profile. For simplicity, seed with `trainer_id: null` and assert trainer_id is still null.

### Scenario 5 — P1 — Reschedule to end-before-start is rejected

**Proves:** The server-side validation (or client-side guard) rejects invalid time ranges.

```
GIVEN a seeded class
WHEN admin edits to start=19:00, end=18:00
AND clicks Save
THEN the modal stays open with an error
AND DB: class times are unchanged from the seeded values
```

**Note:** The PUT handler does NOT have an explicit "end must be after start" validation. Only the POST handler does (route.ts:148-152). This scenario will FAIL unless either:
(a) The PUT handler gets the same validation added (recommended)
(b) The modal's handleSubmit gets a client-side guard
(c) The test is rewritten to assert "no validation" (unexpected behavior)

**Recommendation:** Add the validation to the PUT handler (mirrors POST, 3 lines). This is a scope extension but tiny.

---

## Testids to seed

**Zero new testids needed.** The Edit Class flow reuses the ClassFormModal (Tier 3.8 testids) and the ClassDetailPanel's Edit Class button (Tier 3.9 testid). The new test can use `schedule-edit-class-btn` + `schedule-class-form-*` directly.

---

## POM extension

Small extension — 1 helper method and 1 adjustment to the existing `submitClassForm`:

### Option A: Parameterize `submitClassForm`

```ts
/**
 * Submit the class form modal. Waits for the matching API response.
 * @param method 'POST' for create (default), 'PUT' for edit
 */
async submitClassForm(method: 'POST' | 'PUT' = 'POST'): Promise<void> {
  const responsePromise = this.page.waitForResponse(
    (res) =>
      res.url().includes('/api/classes') &&
      res.request().method() === method,
    { timeout: 30_000 },
  )
  await this.submitClassBtn().click()
  await responsePromise
}
```

### Option B: Add `submitEditClassForm` helper

Alternative: leave `submitClassForm` as-is (POST) and add a new `submitEditClassForm` method for PUT. Less type pressure but more methods.

**Recommend Option A** — simpler, one method, backward compatible (default is 'POST'). Tier 3.8's callers don't break since they call it without arguments.

### New helper: `openEditClassModalFromPanel(classTitle: string)`

```ts
async openEditClassModalFromPanel(classTitle: string): Promise<void> {
  await this.openClassPanel(classTitle)
  await this.editClassBtn().click()  // Needs: editClassBtn() locator
  await expect(this.classFormModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
  await expect(this.submitClassBtn()).toBeEnabled({ timeout: ANIM_TIMEOUT })
}
```

Need to add `editClassBtn()` locator (targets `schedule-edit-class-btn` which was seeded in Tier 3.9).

---

## Fixture work

### seedClass extension

Current `seedClass` doesn't accept a `notes` option. Add it:

```ts
// In SeedClassOptions interface
notes?: string | null

// In seedClass body
const { error } = await testDb.from('classes').insert({
  ...existing fields...
  notes: opts.notes ?? null,
  ...
})
```

Minimal change — 2 lines in db.ts.

### resetStudioTestData

No changes. Existing cleanup handles classes by title prefix and activity_log by `type LIKE 'class_%'`. Both cover reschedule tests.

---

## Server-side time validation on PUT

The PUT handler currently validates date format but NOT that `end > start`. The POST handler has this at line 148-152. Mirror it to PUT in the same Tier 3.10 edit:

```ts
// In PUT handler, after the existing date validations
if (updates.starts_at && updates.ends_at) {
  const start = new Date(updates.starts_at as string)
  const end = new Date(updates.ends_at as string)
  if (end <= start) {
    return NextResponse.json(
      { error: "end_time must be after start_time" },
      { status: 400 }
    );
  }
}
```

Adding this requires Scenario 5 to use `submitClassForm('PUT')` which waits for the response, THEN asserts the error. Same pattern as Tier 3.8 Scenario 6.

Alternative: put the guard ONLY in the modal's `handleSubmit` (client-side). The API remains permissive but the UI prevents the bad state. Less defense-in-depth but sufficient for the test.

**Recommend API-layer guard** — the PUT handler already has some time validation (date format check), adding end-after-start is consistent.

---

## Scope summary

**Production changes:**
- `schedule/page.tsx`: 1 line change (`raw.notes` instead of phantom `raw.description`)
- `ClassFormModal.tsx`: 2 changes (editData interface field rename, useEffect seeding from notes)
- `api/classes/[id]/route.ts` PUT: 1 block added (end-after-start validation)

**Test infrastructure:**
- `db.ts` seedClass: add `notes?: string | null` option (2 lines)
- `SchedulePage.ts` POM: add `editClassBtn()` locator, add `openEditClassModalFromPanel()` helper, parameterize `submitClassForm(method)` to accept POST or PUT

**New spec:**
- `e2e/schedule-reschedule-class.spec.ts`: 5 tests (~300 lines)

**Testids:** ZERO new seeds needed.

**Migrations:** ZERO.

**Complexity:** Low-medium. Mostly test infrastructure and a handful of small production fixes. The BUG-018 fix is the most important production change — 3 small edits in 2 files.

---

## Handoff to Architect

- BUG-018 is blocking: Tier 3.10 Scenario 3 requires it fixed
- End-after-start validation on PUT is in-scope (Scenario 5 needs it)
- POM changes are small — parameterize one helper, add one locator, add one helper
- No new migrations, no new testids
- Test scenarios are straightforward — 4 P0 assertions on DB state after edit flow, 1 P1 on validation rejection
- Estimated Engineer time: moderate — the changes are small but spread across 4 files

**Risks:**

1. **`submitClassForm('POST')` vs `submitClassForm('PUT')` parameterization** — if any Tier 3.8 test calls it without an argument, the default must be 'POST' for backward compatibility. Verify all Tier 3.8 tests.
2. **The modal's `editData` interface rename (`description` → `notes`)** — touches the prop shape but there's only one call site (schedule/page.tsx:867-876). Both files must be updated in the same edit.
3. **End-after-start PUT validation** — must be placed AFTER the time remapping (starts_at/ends_at in `updates`) and BEFORE the UPDATE runs.
4. **Scenario 3's BUG-018 assertion** — if the fix isn't correctly applied, the test fails in a clean assertion. Good symptom for detecting regression.

---

## Out of scope

- Drag-and-drop rescheduling on the calendar (not built; will be a future UX tier)
- Recurring class reschedule (classes.is_recurring / recurrence_rule columns — Phase 2 feature)
- Conflict detection (trainer double-booking, sauna double-booking) — separate feature
- BUG-016 RLS fixes — still deferred
- The latent DELETE handler `['confirmed', 'checked_in']` filter bug — still deferred
