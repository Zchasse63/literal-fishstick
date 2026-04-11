# Tier 3.8 — Schedule: Create Class — Analyst Report

**Run date:** 2026-04-10
**Phase:** 1 (Analyst)
**Status:** 🔴 Multi-layer bug surfaced — BUG-015 filed with 4 blocking layers + 3 sub-findings

---

## Feature scope

The schedule module's "Create Class" flow. Admin clicks "New Class" on `/schedule` → `ClassFormModal` opens → user selects class type, date, times, capacity, optional trainer/title/description → submits → POST `/api/classes` → row lands in `classes` table + `activity_log` entry.

Business context: Per CLAUDE.md, the Sauna Guys operates a **group-class booking model** (not individual resource booking). Classes are hour-long time slots with a `class_type` (Open Sauna, Guided Session, Private Event). The directory has 3 active class_types seeded in the default test studio.

---

## State on entry

### UI exists
- `apps/web/src/app/(admin)/schedule/page.tsx` line 736: "New Class" button with `onClick={() => { setEditClassData(null); setClassFormOpen(true) }}`
- `apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` — 249-line modal with class type dropdown, title input, date, start/end time, capacity, trainer dropdown, description textarea
- **0 testids** on either surface (schedule page has `data-testid="schedule-page-root"` from Tier 2.2 smoke, but the New Class button + modal + form fields have NONE)

### API exists
- `apps/web/src/app/api/classes/route.ts` — GET + POST handlers
- POST handler at lines 102–220: validates required fields, verifies class_type exists, inserts into `classes`, inserts into `activity_log`

### Fixtures exist
- `seedClass(opts)` in `db.ts` (lines 270–297) — writes a classes row directly for booking flows
- `resetStudioTestData` already cleans up classes by `title LIKE 'E2E Test%'` prefix (line 443)

### POM absent
- **NO `SchedulePage` POM exists.** This is the first Schedule-module write tier — the POM will be built from scratch as called out in the roadmap.

---

## Probe results

### Probe 1 — `information_schema.columns` for `classes`

21 columns. Key findings:

| Column | Nullable | Default | Notes |
|---|---|---|---|
| `id` | NO | `gen_random_uuid()` | PK |
| `studio_id` | NO | — | FK |
| `class_type_id` | NO | — | FK — required |
| `trainer_id` | YES | — | Optional |
| **`title`** | **NO** | **—** | **⚠️ NOT NULL with NO default — BUG-015 Layer 2** |
| `starts_at` | NO | — | timestamptz, required |
| `ends_at` | NO | — | timestamptz, required |
| `capacity` | NO | `12` | Default 12 |
| **`notes`** | **YES** | — | **⚠️ The actual column for user-facing "Description" — BUG-015 Layer 1** |
| `status` | NO | `'scheduled'` | CHECK constraint |
| `booked_count` | NO | `0` | Auto-managed |
| `checked_in_count` | NO | `0` | Auto-managed |
| `is_recurring` | NO | `false` | Auto-managed |

**There is NO `description` column on `classes`.** The API route is writing to a phantom column.

### Probe 1b — `information_schema.columns` for `class_types`

11 columns. Relevant fields: `id`, `name` (NOT NULL), `type`, `default_capacity` (default 12), `default_duration_minutes` (default 60), `color` (default `#4F46E5`), `is_active` (default true).

### Probe 2 — `pg_constraint` for CHECK constraints

```sql
activity_log_type_check:
CHECK (type = ANY (ARRAY[
  'check_in', 'booking', 'cancellation', 'payment', 'failed_payment',
  'membership_change', 'walk_in', 'new_member', 'refund', 'strike',
  'clock_in', 'clock_out', 'product_created', 'product_updated', 'product_deleted',
  'member_created', 'member_updated', 'member_deleted'
]))

classes_status_check:
CHECK (status = ANY (ARRAY['scheduled', 'in_progress', 'completed', 'cancelled']))
```

**`class_created` is NOT in the activity_log.type enum** — BUG-015 Layer 4. `cancellation` exists but is ambiguous (could be booking OR class cancellation). No `class_*` type at all.

### Probe 3 — `pg_policies` for `classes` + `class_types`

**`classes`:**

```sql
classes_write (INSERT): WITH CHECK (
  ((studio_id = get_user_studio_id()) AND user_has_role('owner'))
  OR user_has_role('admin')
  OR user_has_role('manager')
)

classes_read (SELECT): USING (studio_id = get_user_studio_id())
classes_update (UPDATE): USING (studio_id = get_user_studio_id())
```

**`class_types`:**

```sql
class_types_studio_write (INSERT): WITH CHECK (studio_id = get_user_studio_id())
class_types_studio_read (SELECT): USING (studio_id = get_user_studio_id())
class_types_studio_update (UPDATE): USING (studio_id = get_user_studio_id())
```

⚠️ **Additional RLS findings (out of tier scope, filed as sub-findings):**

1. **classes_write operator precedence bug** — `A AND B OR C OR D` parses as `(A AND B) OR C OR D`, meaning admin/manager roles can INSERT classes into ANY studio (cross-tenant). The owner branch alone has the studio_id check. **Security sub-finding BUG-015.6** — mitigated in practice because the test admin user is 'owner' role and app-layer `studio_id` lookup uses `profile.studio_id`, but this is a defense-in-depth failure.

2. **classes_update has no role restriction** — any authenticated user in the studio can UPDATE classes (even regular members). **BUG-015.7.**

3. **class_types_studio_write has no role restriction** — any authenticated user in the studio can CREATE class_types (even regular members). **BUG-015.8.**

None of these block Tier 3.8 tests. Document and move on.

### Probe 4 — test data availability

DEFAULT_STUDIO_ID (`11111111-1111-1111-1111-111111111111`) has **3 active class_types**:

| ID | Name | Type | Capacity | Color |
|---|---|---|---|---|
| `314f0ddf-dc6d-4402-beaa-22ed19172b18` | Open Sauna | open | 12 | `#4F46E5` |
| `243a8f2d-2fbf-4cf0-868b-9968fc6ddfaf` | Guided Session | guided | 12 | `#8B5CF6` |
| `19ee6486-c3d7-4d85-9250-829c878f7d95` | Private Event | private | 20 | `#F59E0B` |

**No class_types need to be seeded.** The fixture can reference these by name or ID. The test will use "Open Sauna" as the primary test type (matches the business model per CLAUDE.md).

### Probe 5 — `activity_log.description` confirmation

`activity_log.description` is `text NOT NULL` with NO default — matches prior tiers. Required.

### Probe 6 — panel action button ID trace (standing checklist item)

N/A — "Create Class" is a pure create flow, no `${id}` in the button chain. The modal's edit mode (`editData!.id`) is out of scope for this tier (Tier 3.10 Reschedule Class will exercise it).

---

## BUG-015 — `/api/classes` POST handler divergence (4 blocking layers + 3 sub-findings)

### Layer 1 — Phantom `description` column write

The POST handler at `route.ts:179-193`:

```ts
.insert({
  class_type_id,
  starts_at: start.toISOString(),
  ends_at: end.toISOString(),
  capacity,
  trainer_id: trainer_id ?? null,
  title: title ?? null,
  description: description ?? null,  // ⚠️ PHANTOM COLUMN — actual is `notes`
  studio_id: studioId,
  status: 'scheduled',
})
```

**Failure mode:** Every class creation attempt 500s with `column "description" does not exist`. This IS captured in `insertError` (the handler correctly checks `if (insertError)` and returns 500 with `insertError.message`), so it's NOT a silent swallow — but it is a total feature failure.

**Fix:** Map the body's `description` field to the DB column `notes`.

```ts
notes: description ?? null,
```

### Layer 2 — `classes.title` NOT NULL with no default; handler accepts nullable

Two issues compound here:

1. The `classes.title` column is `NOT NULL` with no default.
2. The ClassFormModal sends `title: title || null` in the body — if the user leaves the title field blank (and the label explicitly says "Title (optional)"), the body has `title: null`.
3. The POST handler then does `title: title ?? null` — null passes through.
4. Postgres rejects the insert with a NOT NULL violation.

**Failure mode:** Every class creation with blank title → 500 "null value in column 'title' violates not-null constraint". The UX says title is optional; the schema says it's required. One of them is lying.

**Fix options:**

- **Option A (preferred):** Default title to `class_type.name` when blank. Matches existing data pattern (sampled classes have `title="Open Sauna"`, `title="Guided Sauna + Cold Plunge"` — titles are typically the class type name). Requires fetching the class_type row (already happens at line 165 for verification — trivially extended to `.select('id, name')` and reused).

- Option B: Require title at API layer, return 400 if missing.

- Option C: Migration to make `title` nullable.

### Layer 3 — `activity_log.description` omitted (NOT NULL silent swallow)

The POST handler at `route.ts:203-210`:

```ts
await supabase.from("activity_log").insert({
  studio_id: studioId,
  actor_id: user.id,
  type: "class_created",
  subject_type: "class",
  subject_id: newClass.id,
  metadata: { class_type_id, start_time, trainer_id },
})
```

**Failure modes:**

- `description` is NOT NULL with no default — insert fails silently.
- The result is discarded (`await ...insert(...)` with no error check).
- Same silent-swallow pattern as Tier 3.1/3.4/3.5/3.6/3.7 — the ledger row never lands, the class does, and nobody notices.

**Fix:** Add `description: \`Class created: ${classType.name}\`` + capture `{ error }` with `console.error` (no rollback — observability pattern).

### Layer 4 — `type = 'class_created'` not in CHECK enum

The enum has 18 values and `class_created` is not among them (see Probe 2 result above).

**Failure mode:** Even if Layer 3 were fixed, the insert would still fail because the CHECK constraint rejects `'class_created'`. Compounds the silent swallow — log rows never land.

**Fix:** Migration to extend `activity_log.type` CHECK. Add all four class lifecycle types in one migration since we'll need them for Tier 3.9 (Cancel), 3.10 (Reschedule), 3.11 (Waitlist):

```sql
ALTER TABLE activity_log DROP CONSTRAINT activity_log_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_type_check
CHECK (type = ANY (ARRAY[
  'check_in', 'booking', 'cancellation', 'payment', 'failed_payment',
  'membership_change', 'walk_in', 'new_member', 'refund', 'strike',
  'clock_in', 'clock_out', 'product_created', 'product_updated', 'product_deleted',
  'member_created', 'member_updated', 'member_deleted',
  'class_created', 'class_updated', 'class_cancelled', 'class_deleted'
]));
```

### Layer 5 — Missing POST-level role check (sub-finding, same tier fix)

The GET handler at `route.ts:34-50` has an explicit role check:

```ts
const roles: string[] = profile?.roles ?? []
if (!roles.some((r: string) => ['owner', 'manager'].includes(r))) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

The POST handler has NONE. A member could POST a class creation and hit the RLS policy, which would return a generic 500 "Internal server error" rather than a clean 403 "Forbidden". This is a UX bug (bad error messages) but not a security hole (RLS still rejects).

**Fix:** Add the same role check at the top of POST. 4 lines. Free improvement since the file is already being touched.

### Sub-findings 6–8 (documented, not fixed in this tier)

- **L6 — classes_write RLS precedence** — admin/manager roles bypass studio_id isolation due to `A AND B OR C OR D` operator precedence. Cross-tenant write possible for admin role. File BUG-016 separately. Mitigated in practice because test admin user is `['owner']` role.

- **L7 — classes_update RLS has no role restriction** — any studio member can update classes. Out of tier scope, will be exercised by Tier 3.10 (Reschedule).

- **L8 — class_types_studio_write RLS has no role restriction** — any studio member can create class_types. Out of tier scope.

---

## Test scenarios (7 total — 4 P0, 3 P1)

### Scenario 1 — P0 — Create class happy path (all fields filled)

**Proves:** L1 (description → notes), L3 (log description present), L4 (log type valid), happy path.

```
GIVEN admin is on /schedule
WHEN they click "New Class" and fill the form:
  - Class Type: Open Sauna
  - Title: E2E Test Class {uniqueSuffix}
  - Date: tomorrow
  - Start: 17:00
  - End: 18:00
  - Capacity: 12
  - Description: "Test description for Tier 3.8"
AND click "Create Class"
THEN modal closes
AND a classes row exists with:
  - class_type_id matching Open Sauna
  - title matching the input
  - notes = "Test description for Tier 3.8" (NOT null, written to notes NOT description)
  - capacity = 12
  - status = 'scheduled'
AND an activity_log row exists with:
  - type = 'class_created'
  - subject_id = the new class's id
  - subject_type = 'class'
  - description NOT NULL and contains 'Class created' + title
```

### Scenario 2 — P0 — Activity log explicit L3/L4 proof

**Proves:** Layers 3 + 4 explicitly (separate from the happy path so that a regression on only the log doesn't mask a regression on only the class insert).

```
GIVEN a class has just been created by this test
WHEN we query activity_log for type='class_created', subject_id=<newClass.id>
THEN exactly one row exists
AND row.description is NOT NULL
AND row.description contains 'Class created'
AND row.description contains the class title
AND row.type = 'class_created' (not 'class' or 'cancellation' or a phantom)
AND row.metadata.class_type_id equals the class's class_type_id
```

### Scenario 3 — P0 — Description field writes to classes.notes (L1 explicit proof)

**Proves:** Layer 1 explicitly — the UI field labeled "Description" persists to the DB column named `notes`.

```
GIVEN admin creates a class with description = "specific-L1-proof-string-{unique}"
WHEN the class is created
THEN SELECT notes FROM classes WHERE id = <newClass.id>
AND expect notes = "specific-L1-proof-string-{unique}"
AND NO "description" column exists on the row (regression guard if schema ever changes)
```

### Scenario 4 — P0 — Blank title defaults to class_type.name (L2 explicit proof)

**Proves:** Layer 2 explicitly — when the user leaves title blank, the handler defaults to the class type name rather than 500-ing on NOT NULL.

```
GIVEN admin creates a class with:
  - Class Type: Open Sauna
  - Title: (blank — field left empty)
  - (other fields filled normally)
WHEN the create submits
THEN the class lands with title = "Open Sauna"
AND no 500 error was thrown
AND activity_log row's description contains "Open Sauna"
```

### Scenario 5 — P1 — Missing class_type_id returns 400 with inline error

**Proves:** Client-side validation catches the missing selection AND the server enforces it even if bypassed.

```
GIVEN admin opens the New Class modal
WHEN they leave Class Type unselected and click Create
THEN the modal DOES NOT close
AND an inline error "Please select a class type" is visible
AND no classes row was inserted
AND no activity_log row was inserted
```

**Note:** The current ClassFormModal's `handleSubmit` has a client-side guard `if (!classTypeId) { setError(...) }`. The P1 version asserts that guard renders visibly. A variant via `page.request.post(...)` directly asserts the server returns 400 — but that's orthogonal. Keep this test UI-level.

### Scenario 6 — P1 — End time ≤ start time returns 400 with inline error

**Proves:** Server-side time validation.

```
GIVEN admin opens the New Class modal
WHEN they set start=18:00, end=17:00 (end before start)
AND click Create
THEN the modal does NOT close
AND an inline error visible (either client-side "end must be after start" or server 400 "end_time must be after start_time")
AND no classes row was inserted
```

### Scenario 7 — P1 — Cancel button closes modal without writing

**Proves:** State leak prevention.

```
GIVEN admin opens the New Class modal and partially fills the form
WHEN they click Cancel
THEN the modal closes
AND no classes row was inserted
AND reopening the modal shows fresh state (not pre-populated with the cancelled input)
```

---

## Testids that will need seeding

| ID | Location | Role |
|---|---|---|
| `schedule-new-class-btn` | `schedule/page.tsx:736` | Opens the create modal |
| `schedule-class-form-modal` | `ClassFormModal.tsx:149` | Dialog container |
| `schedule-class-form-type-select` | `ClassFormModal.tsx:165` | Class type dropdown |
| `schedule-class-form-title-input` | `ClassFormModal.tsx:179` | Title input |
| `schedule-class-form-date-input` | `ClassFormModal.tsx:185` | Date input |
| `schedule-class-form-start-time-input` | `ClassFormModal.tsx:189` | Start time input |
| `schedule-class-form-end-time-input` | `ClassFormModal.tsx:193` | End time input |
| `schedule-class-form-capacity-input` | `ClassFormModal.tsx:200` | Capacity input |
| `schedule-class-form-trainer-select` | `ClassFormModal.tsx:204` | Trainer dropdown |
| `schedule-class-form-description-textarea` | `ClassFormModal.tsx:219` | Description textarea |
| `schedule-class-form-error` | `ClassFormModal.tsx:229` | Inline error alert |
| `schedule-class-form-submit-btn` | `ClassFormModal.tsx:236` | Primary action |
| `schedule-class-form-cancel-btn` | `ClassFormModal.tsx:235` | Dismiss |

13 seeds. All in two files.

---

## Fixture work

### POM creation (from scratch)

New file `apps/web/e2e/pages/SchedulePage.ts`. Structure mirrors `MembersPage`:

```ts
export class SchedulePage extends BasePage {
  pageRoot(): Locator
  expectMounted()
  goto()

  // Tier 3.8: Create Class
  newClassBtn(): Locator
  classFormModal(): Locator
  classTypeSelect(): Locator
  titleInput(): Locator
  dateInput(): Locator
  startTimeInput(): Locator
  endTimeInput(): Locator
  capacityInput(): Locator
  trainerSelect(): Locator
  descriptionTextarea(): Locator
  classFormError(): Locator
  submitClassBtn(): Locator
  cancelClassBtn(): Locator

  async openNewClassModal()
  async fillClassForm(opts: {
    classTypeName?: string
    title?: string
    date?: string  // YYYY-MM-DD
    startTime?: string  // HH:MM
    endTime?: string
    capacity?: number
    description?: string
  })
  async submitClassForm()  // await POST response
  async cancelClassForm()
  async expectClassFormError(messageSubstring?: string)
}
```

Notes:
- `submitClassForm()` follows the Tier 3.7 canonical pattern: `page.waitForResponse((res) => res.url().includes('/api/classes') && res.request().method() === 'POST', { timeout: 30_000 })` before returning. Protects against Next.js cold-compile.
- `classTypeSelect()` targets the native `<select>` element. `page.selectOption` works on it.
- `dateInput` / `startTimeInput` / `endTimeInput` are native `<input type="date|time">`. Use `page.fill(isoDate)` for date, `page.fill('HH:MM')` for times.

### db.ts extension

No new helper needed. `seedClass()` and cleanup already cover this. One optional constant to add to `test-data.ts`:

```ts
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID = '314f0ddf-dc6d-4402-beaa-22ed19172b18'
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME = 'Open Sauna'
```

These are stable IDs from production-seeded class_types in the default studio. Not created by the test, just referenced.

### resetStudioTestData extension

Required. Current cleanup at line 443 only deletes classes by `title LIKE 'E2E Test%'` prefix. That's fine for Tier 3.8 tests that always use the prefix.

**Additional cleanup step needed:** delete `activity_log` rows with `type LIKE 'class_%'` that belong to the test studio. Mirror the Tier 3.5 cleanup addition for `type = 'member_created'`.

```ts
// 5c. Delete activity_log rows for test-created classes.
await testDb
  .from('activity_log')
  .delete()
  .eq('studio_id', studioId)
  .like('type', 'class_%')
```

Safe because class_* types are new (added by this tier's migration), and the only producers are the test suite.

---

## Migrations

**One migration required.** Pattern: one `ALTER ... DROP CONSTRAINT ... ADD CONSTRAINT` block extending `activity_log.type` enum with four new values.

```sql
BEGIN;
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_type_check
CHECK (type = ANY (ARRAY[
  'check_in', 'booking', 'cancellation', 'payment', 'failed_payment',
  'membership_change', 'walk_in', 'new_member', 'refund', 'strike',
  'clock_in', 'clock_out', 'product_created', 'product_updated', 'product_deleted',
  'member_created', 'member_updated', 'member_deleted',
  'class_created', 'class_updated', 'class_cancelled', 'class_deleted'
]));
COMMIT;
```

Applies via Supabase MCP `apply_migration`.

---

## Handoff to Architect

- 4 BUG-015 blocking layers must be fixed in one API route rewrite + one migration
- 1 sub-finding (L5 role check) fixed in same rewrite for free
- 13 testid seeds across 2 files
- New `SchedulePage` POM from scratch, ~13 locators + ~10 helpers
- 1 `test-data.ts` constant addition (class_type ID reference)
- 1 `db.ts` cleanup step addition (activity_log class_* cleanup)
- 7-test spec
- Three sub-findings (L6–L8) documented for future tiers, NOT fixed here

**Estimated complexity:** Medium. This is the first new POM since Tier 3.5 (which extended an existing POM). The Architect should explicitly call out "build from scratch" rather than "extend".

**Risk:** Medium-low. The bug is obvious (phantom column) and the fix is mechanical. The only risk is the `title` defaulting logic (L2) — Option A requires fetching class_type.name from the verification query, and the Architect needs to confirm the simplest way to thread that through the handler without adding extra round trips.
