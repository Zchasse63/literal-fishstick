# QA Council — Schedule: Create Class (Tier 3.8) — ARCHITECT

**Pipeline ID:** `schedule-create-class`
**Tier:** 3.8 (Core Writes — 8 of 12)
**Project:** `admin`
**Phase:** 2 — Architect
**Date:** 2026-04-10
**Input:** `specs/reports/schedule-create-class-analyst.md`
**Status:** 8-step blueprint. Execution order is load-bearing — do not re-order without re-reviewing dependencies.

---

## Scope affirmation

Re-read the Analyst report. All four BUG-015 blocking layers are in play, plus L5 (missing POST role check fixed for free). One migration. Thirteen testid seeds across two files. New `SchedulePage` POM built from scratch (first Schedule-module write tier). Seven tests (4 P0 + 3 P1). Ten files total.

**Test scenarios 1:1 match the Analyst's listing:**

| # | Priority | Title |
|---|---|---|
| 1 | P0 | Create class happy path — all fields filled |
| 2 | P0 | Activity log explicit proof — description + type |
| 3 | P0 | Description field writes to classes.notes (L1 explicit proof) |
| 4 | P0 | Blank title defaults to class_type.name (L2 explicit proof) |
| 5 | P1 | Missing class_type_id returns inline error |
| 6 | P1 | End time before start time returns inline error |
| 7 | P1 | Cancel closes modal without writing |

**POM section header:** `// ─── Tier 3.8: Create Class ───`

**Fixture note:** `seedClass()` in `e2e/fixtures/db.ts` already exists (lines 270–297) and cleans up by `title LIKE 'E2E Test%'`. No class-seeding changes needed. One new cleanup step (5c) for `activity_log` rows with `type LIKE 'class_%'`. Two new constants in `test-data.ts`.

---

## Critical file paths (complete list — inspect before writing)

| File | Action | Step |
|---|---|---|
| `apps/web/src/app/api/classes/route.ts` | Modify — POST handler rewrite (L1–L5) | 1 |
| `supabase/migrations/` | Create — enum extension migration | 2 |
| `apps/web/src/app/(admin)/schedule/page.tsx` | Modify — add testid to "New Class" button (line 736) | 3 |
| `apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` | Modify — add 12 testids to form elements | 3 |
| `apps/web/e2e/fixtures/test-data.ts` | Modify — add 2 class_type constants | 4 |
| `apps/web/e2e/fixtures/db.ts` | Modify — add step 5c cleanup block | 4 |
| `apps/web/e2e/pages/SchedulePage.ts` | Modify — extend existing POM from scratch (Tier 3.8 section) | 5 |
| `apps/web/e2e/schedule-create-class.spec.ts` | Create — 7-test spec | 6 |

Eight files. No new API routes. No new UI components. One migration. The existing `SchedulePage.ts` stub (30 lines) will be extended in place — not replaced.

---

## Execution order (load-bearing)

```
Step 1 (Migration) → Step 2 (POST handler) — migration MUST land before the handler runs in tests
Step 3 (Testid seeds) — both files seeded before the POM references them
Step 4 (Fixture constants + cleanup) — constants referenced by the spec; cleanup added before any test runs
Step 5 (POM extension) — spec imports SchedulePage; POM must exist first
Step 6 (Spec) — last, depends on all prior steps
```

- **Step 1 must precede Step 2.** The `activity_log` CHECK constraint rejects `'class_created'` at the DB layer. If the migration is not applied first, even a correctly-written POST handler will fail its activity_log insert. The Engineer must apply the migration via Supabase MCP (`apply_migration`) and verify it landed before editing the route.
- **Step 2 is the core bug fix.** Once the migration is live, the route rewrite (L1–L5) makes the feature functional end-to-end. Steps 3–6 are all test infrastructure.
- **Steps 1 and 2 are the only production-code steps.** Steps 3–6 are test infrastructure and do not affect the running app.
- **Step 3 must precede Step 5.** The POM references testids that must exist in source. TypeScript compilation does not enforce this, but tests will silently time out on missing elements if the attributes were not seeded.
- **Step 4 must precede Step 6.** The spec imports `DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID` from `test-data.ts`. The spec also relies on `resetStudioTestData` running the 5c cleanup block or activity_log rows will accumulate across test runs.
- **Step 5 must precede Step 6.** The spec imports `SchedulePage`.
- **Steps 3 and 4 are independent of each other** and can run in either order, but both must be done before Step 5.

---

## Step 1 — Migration: extend `activity_log.type` CHECK constraint

**File:** New migration file in `supabase/migrations/` (name: `<timestamp>_extend_activity_log_class_types.sql`)
**Estimated diff:** 1 new file, ~15 lines of SQL
**Why first:** The POST handler uses `type: 'class_created'`. Without this migration, that insert fails with a CHECK violation regardless of all other fixes. This is the hardest blocker — it cannot be worked around in application code.

### What the migration must do

Drop the existing `activity_log_type_check` constraint (using `DROP CONSTRAINT IF EXISTS` for idempotency) and re-add it with four new values appended to the array: `'class_created'`, `'class_updated'`, `'class_cancelled'`, `'class_deleted'`. The full 22-value array is specified in the Analyst report (Probe 2 section + Layer 4 fix). Do NOT omit any of the existing 18 values — a partial array will break existing activity_log inserts.

Apply via Supabase MCP `apply_migration` (not `db push`). Confirm by querying `pg_constraint` after apply:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'activity_log_type_check';
```

The result must contain all four new values in the ARRAY literal.

### Acceptance criteria for Step 1

- Migration applies without error.
- `pg_constraint` query returns a definition that includes `'class_created'`, `'class_updated'`, `'class_cancelled'`, `'class_deleted'`.
- All 18 original values are still present (no regression on existing log types).
- A test insert of `type = 'class_created'` into `activity_log` succeeds (can verify via Supabase MCP `execute_sql`).

---

## Step 2 — POST handler rewrite (BUG-015 L1–L5)

**File:** `apps/web/src/app/api/classes/route.ts`
**Function:** `export async function POST(...)` — lines 102–220
**Estimated diff:** ~25 lines changed within the existing handler body; 0 lines added outside it
**Why second:** The migration (Step 1) must be live. Then this single handler rewrite fixes all five issues. Do NOT touch the GET handler.

### Five discrete changes inside the POST handler body

**L5 — Add role check immediately after the `profile` fetch (lines 155–163)**

Currently the POST handler fetches `profile` for `studio_id` but never checks `roles`. Add the same 4-line role check that the GET handler already has (lines 44–50). Insert it between the `const studioId = ...` assignment (line 162) and the class_type verification query (line 165). Reject with 403 if the user lacks `owner` or `manager` role.

**L2 — Extend the class_type verification query to also fetch `name`**

The existing query at line 165–170 selects only `"id"`. Change to `.select("id, name")`. This is one character change in the string literal. The `classType` variable now has both `classType.id` and `classType.name`. No new query, no extra round trip. The verification query was already happening; we are just asking for one more column.

**L1 — Fix phantom `description` column write (line 188)**

In the `.insert({...})` block at lines 179–193, change `description: description ?? null` to `notes: description ?? null`. One line change. The `description` variable from the request body is preserved — it is only the DB column name that changes.

**L2 (continued) — Apply title default when blank**

In the same `.insert({...})` block, change `title: title ?? null` to `title: title || classType.name`. This uses `||` (not `??`) because the modal sends `title: '' || null` which evaluates to `null` in JavaScript before the network call — the body will have `title: null`. But it also handles the empty-string edge case if the modal is ever changed. `classType.name` is always non-null (it is `NOT NULL` in the schema per Analyst Probe 1b). No additional query needed — `classType` is already available from the verification fetch above.

**L3 + L4 — Fix the activity_log insert**

The existing insert at lines 203–210 is missing `description` and will now pass the CHECK constraint (Step 1 fixed L4). Apply two changes:

1. Add `description: \`Class created: ${classType.name}\`` to the insert object. Use `classType.name` — it is the resolved name from the verification query, not the user-supplied title. This matches the pattern described in the Analyst report and is consistent regardless of whether the user provided a custom title.
2. Capture the error: change `await supabase.from("activity_log").insert({...})` to `const { error: activityError } = await supabase.from("activity_log").insert({...})`. Add `if (activityError) { console.error("POST /api/classes: activity_log insert failed", activityError.message) }` immediately after. Capture-and-log, no rollback — matches the standing convention established in Tiers 3.1/3.4/3.5/3.6/3.7.

### Updated JSDoc comment at lines 97–101

Update to document that `description` in the body maps to `notes` in the DB, and that `title` defaults to `class_type.name` when blank:

```
POST /api/classes
Create a new class. Body field `description` maps to the DB column `notes`.
`title` defaults to the class_type name when omitted or blank.
Writes an activity_log row with type='class_created'. Requires owner or manager role.
```

### Acceptance criteria for Step 2

- POST handler has a role check (owner or manager) at the top, returning 403 if absent.
- `class_types` verification query selects `"id, name"` (not just `"id"`).
- `.insert()` uses `notes: description ?? null`, not `description: description ?? null`.
- `.insert()` uses `title: title || classType.name` — never inserts null into the NOT NULL column.
- `activity_log` insert includes `description: \`Class created: ${classType.name}\`` .
- `activity_log` insert result is captured into `activityError` and `console.error`'d on failure.
- GET handler is untouched.
- The handler still returns `{ data: newClass }` with status 201 on success.

---

## Step 3 — Testid seeds (13 attributes across 2 files)

**Files:**
- `apps/web/src/app/(admin)/schedule/page.tsx` (1 testid)
- `apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` (12 testids)

**Estimated diff:** 13 attribute additions; no logic changes

**Why third:** The POM (Step 5) and spec (Step 6) reference these testids. Seeds must be in source before tests run. No logic changes — purely attribute additions. Review the minimal-diff discipline from `AGENTS.md`: one attribute per element, no restructuring.

### `schedule/page.tsx` — 1 seed

At line 736, the `<button>` that opens the create modal currently has no testid. Add `data-testid="schedule-new-class-btn"` alongside the existing `onClick` and `className` props. Do not rename or restructure the button.

### `ClassFormModal.tsx` — 12 seeds

Each seed is a single attribute addition on an existing element. All line numbers are from the current file (confirmed by Analyst probe). The element type and containing structure must not change.

| Testid | Element | Approximate line |
|---|---|---|
| `schedule-class-form-modal` | `<DialogContent>` | 149 |
| `schedule-class-form-type-select` | `<select>` (class type) | 165 |
| `schedule-class-form-title-input` | `<Input>` (title) | 179 |
| `schedule-class-form-date-input` | `<Input type="date">` | 185 |
| `schedule-class-form-start-time-input` | `<Input type="time">` (start) | 189 |
| `schedule-class-form-end-time-input` | `<Input type="time">` (end) | 193 |
| `schedule-class-form-capacity-input` | `<Input type="number">` | 200 |
| `schedule-class-form-trainer-select` | `<select>` (trainer) | 204 |
| `schedule-class-form-description-textarea` | `<textarea>` | 219 |
| `schedule-class-form-error` | `<p className="text-sm text-red-600">` | 229 |
| `schedule-class-form-cancel-btn` | Cancel `<Button>` | 235 |
| `schedule-class-form-submit-btn` | Submit `<Button>` | 236 |

**Critical note on `schedule-class-form-error`:** This `<p>` is conditionally rendered inside `{error && (...)}`. The testid goes on the `<p>` element itself, not on a wrapper. This means the locator will return zero elements when there is no error — which is the correct behavior for `expect(...).toBeHidden()` / `expect(...).not.toBeVisible()` assertions. Do NOT add a wrapper `<div>` just to keep the element in the DOM. Playwright handles detached elements correctly.

**Critical note on `schedule-class-form-modal`:** The `DialogContent` component (shadcn) forwards arbitrary props to the underlying `<div role="dialog">`. Adding `data-testid` directly on `<DialogContent>` will propagate to the rendered DOM element. This is the established pattern — confirmed by prior tiers using the same component.

### Acceptance criteria for Step 3

- `grep -r 'schedule-new-class-btn'` returns exactly 1 hit in `page.tsx`.
- `grep -r 'schedule-class-form-'` returns exactly 12 hits in `ClassFormModal.tsx`.
- No logic changes, no prop changes, no restructuring.
- The Cancel button testid is `schedule-class-form-cancel-btn`; the Submit button testid is `schedule-class-form-submit-btn`. These names exactly match the Analyst's seed list.

---

## Step 4 — Fixture constants and cleanup

**Files:**
- `apps/web/e2e/fixtures/test-data.ts` (2 new exported constants)
- `apps/web/e2e/fixtures/db.ts` (1 new cleanup block, step 5c)

**Estimated diff:** ~8 lines total across 2 files

**Why fourth:** The spec imports the constants. The cleanup runs in `beforeEach` and `afterAll`. Both must exist before Step 6.

### `test-data.ts` — 2 new constants

Append after the existing `E2E_MEMBER_NAME_PREFIX` block (end of the file):

```ts
/** UUID of the "Open Sauna" class_type in the default test studio. Stable — seeded at DB init, never recreated by tests. */
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID = '314f0ddf-dc6d-4402-beaa-22ed19172b18'

/** Display name of the "Open Sauna" class_type. Used as expected default title in Scenario 4. */
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME = 'Open Sauna'
```

These are stable production-seeded values confirmed by the Analyst's Probe 4. They do not need to be created by the test suite.

### `db.ts` — Step 5c cleanup block

In `resetStudioTestData()`, after step 5b (lines 457–467, which deletes activity_log rows for test profile IDs), add step 5c before step 6:

```ts
// 5c. Delete activity_log rows for test-created classes. The 'class_*' types
//     are new as of Tier 3.8's migration and are only produced by the test
//     suite. Scoped to the test studio. Safe to run against a shared dev DB
//     because class_* types did not exist before this tier.
await testDb
  .from('activity_log')
  .delete()
  .eq('studio_id', studioId)
  .like('type', 'class_%')
```

This cleanup is not scoped by subject_id because test class UUIDs are not collected in `resetStudioTestData` (unlike test profile IDs). Scoping by `type LIKE 'class_%'` is safe because: (a) these types are new as of this tier's migration, (b) no non-test code currently writes `class_*` activity_log rows (the feature was completely broken until this tier), and (c) the cleanup is studio-scoped.

### Acceptance criteria for Step 4

- `test-data.ts` exports `DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID` and `DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME`.
- UUIDs match the Analyst's Probe 4 exactly (copy verbatim — do not retype).
- `resetStudioTestData` contains a step 5c block that deletes `activity_log` rows with `type LIKE 'class_%'` for the test studio.
- Step 5c is inserted between the existing step 5b and step 6 blocks. Comment explains why it is safe.

---

## Step 5 — SchedulePage POM extension (Tier 3.8 section)

**File:** `apps/web/e2e/pages/SchedulePage.ts`
**Action:** Extend the existing 30-line stub — do NOT replace it
**Estimated diff:** ~120 lines appended after the existing `expectMounted()` method
**Why fifth:** Spec file imports `SchedulePage` methods. All locators and helpers must exist.

### Architecture decision: extend, not replace

The existing `SchedulePage.ts` has a valid `pageRoot()` + `expectMounted()` + class declaration. The Tier 3.8 section is appended as a new block inside the class body after `expectMounted()`. The section header comment is `// ─── Tier 3.8: Create Class ───`. This matches the pattern used in `MembersPage.ts` for Tier 3.7.

### POM skeleton (write this exactly)

```ts
// ─── Tier 3.8: Create Class ────────────────────────────────────────────────
//
// Locators and helpers for the "New Class" flow on /schedule.
// The modal is rendered by ClassFormModal.tsx (249 lines) as a shadcn Dialog.
// The flow: click "New Class" → modal opens → fill form → click "Create Class"
// → POST /api/classes → modal closes → schedule refreshes.
//
// BUG-015 (4-layer route divergence) was fixed inline as part of this tier:
//   L1. description → notes column mapping
//   L2. title defaults to class_type.name when blank
//   L3. activity_log.description added (NOT NULL guard)
//   L4. activity_log.type='class_created' added to CHECK enum (migration)
//   L5. POST role check added (owner | manager)

/** "New Class" button in the schedule header. Opens the create modal. */
newClassBtn(): Locator {
  return this.byTestId('schedule-new-class-btn')
}

/** The DialogContent wrapper of the ClassFormModal. Visible when modal is open. */
classFormModal(): Locator {
  return this.byTestId('schedule-class-form-modal')
}

/** Class type native <select> dropdown. Use page.selectOption() by label text. */
classTypeSelect(): Locator {
  return this.byTestId('schedule-class-form-type-select')
}

/** Title text input (optional — defaults to class_type.name on the server). */
titleInput(): Locator {
  return this.byTestId('schedule-class-form-title-input')
}

/** Date input (type="date"). Fill with 'YYYY-MM-DD'. */
dateInput(): Locator {
  return this.byTestId('schedule-class-form-date-input')
}

/** Start time input (type="time"). Fill with 'HH:MM'. */
startTimeInput(): Locator {
  return this.byTestId('schedule-class-form-start-time-input')
}

/** End time input (type="time"). Fill with 'HH:MM'. */
endTimeInput(): Locator {
  return this.byTestId('schedule-class-form-end-time-input')
}

/** Capacity number input. Fill with string representation of the integer. */
capacityInput(): Locator {
  return this.byTestId('schedule-class-form-capacity-input')
}

/** Trainer native <select> dropdown. Use page.selectOption() by label text, or '' for none. */
trainerSelect(): Locator {
  return this.byTestId('schedule-class-form-trainer-select')
}

/** Description textarea. Maps to classes.notes in the DB (L1 fix). */
descriptionTextarea(): Locator {
  return this.byTestId('schedule-class-form-description-textarea')
}

/**
 * Inline error paragraph. Conditionally rendered — only in the DOM when
 * setError() has been called. Covers both client-side validation errors
 * (e.g., 'Please select a class type') and server-side 400/500 errors
 * (e.g., 'end_time must be after start_time').
 */
classFormError(): Locator {
  return this.byTestId('schedule-class-form-error')
}

/** "Create Class" submit button (shows "Save Changes" in edit mode). */
submitClassBtn(): Locator {
  return this.byTestId('schedule-class-form-submit-btn')
}

/** "Cancel" outline button — closes modal without submitting. */
cancelClassBtn(): Locator {
  return this.byTestId('schedule-class-form-cancel-btn')
}

/**
 * Click "New Class" and wait for the modal to become visible.
 * The modal has a lookup-loading spinner before the form renders.
 * Wait for the submit button to be enabled, not just the modal container.
 */
async openNewClassModal(): Promise<void> {
  await this.newClassBtn().click()
  await expect(this.classFormModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
  // Wait for the lookup spinner to resolve and the submit button to be enabled.
  await expect(this.submitClassBtn()).toBeEnabled({ timeout: ANIM_TIMEOUT })
}

/**
 * Fill the class creation form. All fields are optional — only provided
 * fields are set. Fields not provided retain their current/default values.
 *
 * @param classTypeName - Label text of the class type option (e.g., 'Open Sauna').
 *   Uses selectOption by label — must exactly match the option text.
 * @param title - Title string. Pass '' to test blank-title defaulting (Scenario 4).
 * @param date - Date in 'YYYY-MM-DD' format. Defaults to tomorrow if omitted.
 * @param startTime - HH:MM (e.g., '17:00').
 * @param endTime - HH:MM (e.g., '18:00').
 * @param capacity - Integer capacity value.
 * @param description - Description / notes text.
 */
async fillClassForm(opts: {
  classTypeName?: string
  title?: string
  date?: string
  startTime?: string
  endTime?: string
  capacity?: number
  description?: string
}): Promise<void> {
  if (opts.classTypeName !== undefined) {
    await this.classTypeSelect().selectOption({ label: opts.classTypeName })
  }
  if (opts.title !== undefined) {
    await this.titleInput().fill(opts.title)
  }
  if (opts.date !== undefined) {
    await this.dateInput().fill(opts.date)
  }
  if (opts.startTime !== undefined) {
    await this.startTimeInput().fill(opts.startTime)
  }
  if (opts.endTime !== undefined) {
    await this.endTimeInput().fill(opts.endTime)
  }
  if (opts.capacity !== undefined) {
    await this.capacityInput().fill(String(opts.capacity))
  }
  if (opts.description !== undefined) {
    await this.descriptionTextarea().fill(opts.description)
  }
}

/**
 * Click the submit button and wait for the POST /api/classes response.
 *
 * Race-safe: the waitForResponse promise is created BEFORE the click,
 * so the response cannot arrive before we start listening.
 * The 30-second timeout covers Next.js cold-compile on the first test run.
 *
 * This helper resolves when the response arrives — it does NOT assert the
 * response status. Callers are responsible for asserting modal state and DB.
 */
async submitClassForm(): Promise<void> {
  const responsePromise = this.page.waitForResponse(
    (res) =>
      res.url().includes('/api/classes') &&
      res.request().method() === 'POST',
    { timeout: 30_000 },
  )
  await this.submitClassBtn().click()
  await responsePromise
}

/**
 * Click Cancel and wait for the modal to disappear.
 * Does NOT trigger a network request.
 */
async cancelClassForm(): Promise<void> {
  await this.cancelClassBtn().click()
  await expect(this.classFormModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
}

/**
 * Assert the inline error is visible and optionally contains a substring.
 * Used by Scenarios 5 and 6 to verify client and server-side validation errors.
 */
async expectClassFormError(messageSubstring?: string): Promise<void> {
  await expect(this.classFormError()).toBeVisible({ timeout: ANIM_TIMEOUT })
  if (messageSubstring !== undefined) {
    await expect(this.classFormError()).toContainText(messageSubstring)
  }
}
```

### Why `selectOption({ label: opts.classTypeName })` not `{ value: id }`

The class type `<select>` renders `<option value={ct.id}>{ct.name}</option>`. Playwright's `selectOption({ label: ... })` matches on the option's visible text, not its value. Using label is more readable and less brittle to UUID changes. The spec passes `'Open Sauna'` which must exactly match the option text from the DB.

### Why `submitClassBtn().toBeEnabled()` inside `openNewClassModal()`

The modal renders a loading spinner while fetching class_types and trainers. During loading, the submit button is `disabled`. Waiting for `toBeEnabled` is the correct signal that lookups resolved and the form is interactive.

### Acceptance criteria for Step 5

- Existing `pageRoot()`, `expectMounted()` methods are untouched.
- Section header comment present: `// ─── Tier 3.8: Create Class ───`.
- 13 locator methods present (1 per testid + `classFormError()`).
- 5 helper methods present: `openNewClassModal()`, `fillClassForm(opts)`, `submitClassForm()`, `cancelClassForm()`, `expectClassFormError(messageSubstring?)`.
- `submitClassForm()` creates the `waitForResponse` promise BEFORE calling `.click()`.
- `fillClassForm()` treats all opts as optional — omitted fields are skipped.
- File still compiles: `import type { Locator }` and `import { expect }` are already present in the stub; no new imports needed.

---

## Step 6 — Spec file

**File (NEW):** `apps/web/e2e/schedule-create-class.spec.ts`
**Why last:** Depends on Steps 1–5. A single scenario cannot run until every preceding step is done.

### File header

Mirror the Tier 3.7 spec header style. Include the BUG-015 layer inventory in the doc comment.

### Structure

```ts
import { test, expect } from '@playwright/test'
import { SchedulePage } from './pages/SchedulePage'
import { resetStudioTestData, testDb } from './fixtures/db'
import {
  DEFAULT_STUDIO_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
  E2E_CLASS_TITLE_PREFIX,
} from './fixtures/test-data'

function uniqueTag(label: string): string {
  return `${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function uniqueTitle(label: string): string {
  return `${E2E_CLASS_TITLE_PREFIX} ${uniqueTag(label)}`
}

// Date helper: tomorrow in YYYY-MM-DD format (local timezone-safe).
function tomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

test.describe('Schedule — Create Class (Tier 3.8)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // Scenario 1 — 7 tests
})
```

### Per-scenario execution

#### Scenario 1 — P0 — Happy path

```ts
test('creates a class with all fields — classes row + activity_log @p0', async ({ page }) => {
  const title = uniqueTitle('HappyPath')
  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openNewClassModal()
  await schedule.fillClassForm({
    classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
    title,
    date: tomorrowDate(),
    startTime: '17:00',
    endTime: '18:00',
    capacity: 12,
    description: 'Test description for Tier 3.8',
  })
  await schedule.submitClassForm()
  await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

  const { data: classes } = await testDb
    .from('classes')
    .select('id, class_type_id, title, notes, capacity, status')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .eq('title', title)
    .single()

  expect(classes).not.toBeNull()
  expect(classes!.class_type_id).toBe(DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID)
  expect(classes!.title).toBe(title)
  expect(classes!.notes).toBe('Test description for Tier 3.8')   // L1 proof
  expect(classes!.capacity).toBe(12)
  expect(classes!.status).toBe('scheduled')

  const { data: logs } = await testDb
    .from('activity_log')
    .select('type, description, subject_type, subject_id, metadata')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .eq('subject_id', classes!.id)
    .eq('type', 'class_created')

  expect(logs?.length).toBeGreaterThanOrEqual(1)
})
```

#### Scenario 2 — P0 — Activity log explicit proof

```ts
test('activity_log row has valid type, non-null description, correct metadata @p0', async ({ page }) => {
  const title = uniqueTitle('LogProof')
  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openNewClassModal()
  await schedule.fillClassForm({
    classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
    title,
    date: tomorrowDate(),
    startTime: '09:00',
    endTime: '10:00',
    capacity: 8,
  })
  await schedule.submitClassForm()
  await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

  const { data: cls } = await testDb
    .from('classes')
    .select('id')
    .eq('title', title)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  const { data: logs } = await testDb
    .from('activity_log')
    .select('type, description, subject_type, metadata')
    .eq('subject_id', cls!.id)
    .eq('studio_id', DEFAULT_STUDIO_ID)

  expect(logs?.length).toBeGreaterThanOrEqual(1)
  const log = logs![0]
  expect(log.type).toBe('class_created')               // L4 proof
  expect(log.description).toBeTruthy()                 // L3 proof — NOT NULL
  expect(log.description).toContain('Class created')
  expect(log.subject_type).toBe('class')
  expect(log.metadata).toMatchObject({ class_type_id: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID })
})
```

#### Scenario 3 — P0 — L1 explicit proof (description → notes)

```ts
test('description field in form writes to classes.notes column (L1 proof) @p0', async ({ page }) => {
  const title = uniqueTitle('L1Proof')
  const proofString = `specific-L1-proof-${uniqueTag('notes')}`
  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openNewClassModal()
  await schedule.fillClassForm({
    classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
    title,
    date: tomorrowDate(),
    startTime: '10:00',
    endTime: '11:00',
    description: proofString,
  })
  await schedule.submitClassForm()
  await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

  const { data: cls } = await testDb
    .from('classes')
    .select('notes')
    .eq('title', title)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  expect(cls!.notes).toBe(proofString)
  // Regression guard: 'description' is not a column on the row object
  expect((cls as Record<string, unknown>)['description']).toBeUndefined()
})
```

#### Scenario 4 — P0 — Blank title defaults to class_type.name (L2 proof)

```ts
test('blank title defaults to class_type.name — no 500 on NOT NULL column @p0', async ({ page }) => {
  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openNewClassModal()
  await schedule.fillClassForm({
    classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
    title: '',           // explicitly blank — triggers the L2 defaulting
    date: tomorrowDate(),
    startTime: '11:00',
    endTime: '12:00',
    capacity: 12,
  })
  await schedule.submitClassForm()
  await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

  // Fetch by class_type_id + studio_id + status (no title to match on)
  const { data: classes } = await testDb
    .from('classes')
    .select('id, title')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .eq('class_type_id', DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID)
    .eq('status', 'scheduled')
    .order('created_at', { ascending: false })
    .limit(1)

  expect(classes?.length).toBeGreaterThanOrEqual(1)
  expect(classes![0].title).toBe(DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME)  // L2 proof

  // Activity log description also uses the class type name
  const { data: logs } = await testDb
    .from('activity_log')
    .select('description')
    .eq('subject_id', classes![0].id)
    .eq('type', 'class_created')

  expect(logs![0].description).toContain(DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME)
})
```

**Note on Scenario 4 DB assertion:** We cannot query by `title = DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME` because the default studio already has "Open Sauna" classes from prior test runs. We query by `class_type_id` + `status` + order by `created_at DESC LIMIT 1` to get the most recently created row. This is safe because `resetStudioTestData` in `beforeEach` wipes all `E2E Test%` titled classes — but blank-title classes will have `title = 'Open Sauna'` and WILL NOT match the cleanup filter. The step 5c cleanup (activity_log rows with `type LIKE 'class_%'`) handles the log rows. The classes table row itself will remain but is harmless — the test fetches by most-recent creation, so an orphan from a prior run cannot be the newest row.

**Risk mitigated:** Add `created_at` to the `classes` query's `.select()` and verify it is within the last 30 seconds: `expect(new Date(classes![0].created_at).getTime()).toBeGreaterThan(Date.now() - 30_000)`. This distinguishes the just-created row from any prior blank-title class rows.

#### Scenario 5 — P1 — Missing class_type_id returns inline error

```ts
test('missing class type shows inline error, modal stays open, no DB write @p1', async ({ page }) => {
  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openNewClassModal()
  // Do NOT fill classTypeName — leave it at the default empty value.
  await schedule.fillClassForm({
    date: tomorrowDate(),
    startTime: '12:00',
    endTime: '13:00',
  })

  // Click submit directly (no submitClassForm() — we do not expect a network call)
  await schedule.submitClassBtn().click()

  await schedule.expectClassFormError('Please select a class type')
  await expect(schedule.classFormModal()).toBeVisible()

  // DB: no class row was inserted
  const { data: classes } = await testDb
    .from('classes')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .gte('created_at', new Date(Date.now() - 5000).toISOString())

  expect(classes?.length ?? 0).toBe(0)
})
```

**Why not `submitClassForm()` here:** The client-side validation guard fires before the fetch. No network request is made. Using `submitClassForm()` would wait 30 seconds for a response that never comes. Click the button directly and assert the error immediately.

#### Scenario 6 — P1 — End time before start returns error

```ts
test('end time before start time shows error, modal stays open @p1', async ({ page }) => {
  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openNewClassModal()
  await schedule.fillClassForm({
    classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
    date: tomorrowDate(),
    startTime: '18:00',
    endTime: '17:00',  // end before start
  })

  // Server validates this — a network call will happen. Use submitClassForm().
  await schedule.submitClassForm()

  await schedule.expectClassFormError('end_time must be after start_time')
  await expect(schedule.classFormModal()).toBeVisible()
})
```

**Note:** The server returns `400 { error: "end_time must be after start_time" }` (confirmed from route.ts line 148–152). The modal's error handler sets `setError(body.error || 'Failed to save class')`. The `<p data-testid="schedule-class-form-error">` will contain the exact server message. Use `submitClassForm()` here because a POST IS fired before the server 400 rejects it.

#### Scenario 7 — P1 — Cancel closes modal without writing

```ts
test('cancel button closes modal without inserting any rows @p1', async ({ page }) => {
  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openNewClassModal()
  await schedule.fillClassForm({
    classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
    title: uniqueTitle('CancelTest'),
    date: tomorrowDate(),
  })

  await schedule.cancelClassForm()
  // Modal is closed
  await expect(schedule.classFormModal()).toBeHidden()

  // DB: no class row inserted
  const { data: classes } = await testDb
    .from('classes')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .gte('created_at', new Date(Date.now() - 5000).toISOString())

  expect(classes?.length ?? 0).toBe(0)

  // Reopen: form should be in fresh state (not pre-populated)
  await schedule.openNewClassModal()
  await expect(schedule.titleInput()).toHaveValue('')
  await expect(schedule.classTypeSelect()).toHaveValue('')
})
```

### Acceptance criteria for Step 6

- Seven tests, tagged `@p0` (1–4) or `@p1` (5–7) in the test title.
- Each test seeds the page via UI navigation (`goto('/schedule')`), not direct DB writes.
- Scenarios 1–4 assert against the DB after the UI action.
- Scenario 5 uses a direct button click (not `submitClassForm()`) because no network call is expected.
- Scenario 6 uses `submitClassForm()` because a POST fires before the 400 rejection.
- Scenario 4 asserts `created_at` recency (within 30 seconds) to distinguish the new row from prior blank-title rows.
- No test asserts on toast text (Meridian toast is not triggered by the current modal success path — the modal just calls `onOpenChange(false)` and `onSuccess()`).

---

## Risk register

| Risk | Step where it bites | Mitigation |
|---|---|---|
| Migration not applied before running tests | Step 1 | Engineer must apply migration and verify via `pg_constraint` query before writing any test. Sentinel will grep for `class_created` in route and fail if no migration timestamp exists. |
| `selectOption({ label: 'Open Sauna' })` fails because lookup spinner is still showing | Step 5 POM | `openNewClassModal()` waits for `submitClassBtn().toBeEnabled()` before returning — this ensures lookups have resolved and the `<select>` options are populated. |
| Scenario 4 blank-title row cannot be distinguished from prior test runs | Step 6 Scenario 4 | Assert `created_at` is within 30 seconds of test execution. `resetStudioTestData()` beforeEach handles `E2E Test%` titles but NOT `'Open Sauna'` titles. The recency guard is the only safeguard. |
| `schedule-class-form-error` detaches from DOM when no error (Playwright `.toBeHidden()` on absent element) | Step 3 + Step 5 | Playwright's `expect(locator).toBeHidden()` treats a detached element as hidden — it does not throw. This is correct behavior. Do NOT wrap the error `<p>` in a permanent `<div>`. |
| `waitForResponse` filter matches the GET /api/classes request that fires on success (schedule refresh) instead of the POST | Step 5 POM | The filter requires BOTH `url().includes('/api/classes')` AND `request().method() === 'POST'`. The GET fired by `onSuccess()` will not match. |
| Scenario 4's blank-title class is not cleaned up between runs | Step 4 cleanup | Step 5c only cleans `activity_log`. The `classes` row with `title='Open Sauna'` from a blank-title test will persist. This is acceptable because the recency guard distinguishes it. A future tier can scope the cleanup further if accumulation becomes a problem. |
| Tier 3.7 regression from adding testids to ClassFormModal | Step 3 | ClassFormModal is not touched by Tier 3.7. Zero regression risk. |
| POST role check (L5) rejects the admin test user | Step 2 | The test admin user has `roles: ['owner']` per `auth.setup.ts` and `test-data.ts:ADMIN_USER`. The role check accepts `'owner'`. No test change needed. |
| `classType.name` is null despite `NOT NULL` schema | Step 2 handler | The `class_types.name` column is `NOT NULL` per Analyst Probe 1b. The fallback `title: title || classType.name` will always resolve to a string. Add a comment in the route to document why no null-coalesce is needed. |

---

## Handoff checklist for the Sentinel

The Sentinel's regression pass should verify:

```
[ ] Migration: 'class_created', 'class_updated', 'class_cancelled', 'class_deleted' in activity_log CHECK
[ ] Route: POST /api/classes returns 201 with valid body when called with all fields
[ ] Route: POST /api/classes returns 403 for a member role (no owner/manager)
[ ] Route: POST /api/classes returns 400 when end_time <= start_time
[ ] Route: POST /api/classes returns 404 when class_type_id is not in the studio
[ ] DB: classes.notes is populated when description field is sent (L1)
[ ] DB: classes.title = class_type.name when body title is null/blank (L2)
[ ] DB: activity_log row exists with type='class_created' for every created class (L4)
[ ] DB: activity_log.description is non-null for every created class (L3)
[ ] UI: data-testid="schedule-new-class-btn" exists on the schedule page button
[ ] UI: all 12 ClassFormModal testids present in source (grep confirms)
[ ] POM: SchedulePage.ts has the Tier 3.8 section with all 5 helpers
[ ] Spec: schedule-create-class.spec.ts has 7 tests, 4 @p0 + 3 @p1
[ ] Cleanup: resetStudioTestData() step 5c deletes activity_log type LIKE 'class_%'
[ ] Existing tests: Tier 3.7 (members-archive-exclude) still passes
[ ] Existing tests: Tier 2.2 (schedule smoke) still passes — expectMounted() untouched
```

---

## Handoff to Engineer

**Execute Steps 1–6 in order. Rationale is above — do not skip.**

```
[ ] Step 1 — Migration: extend activity_log.type CHECK (1 new SQL file, apply + verify)
[ ] Step 2 — POST handler rewrite: L1–L5 fixes (5 discrete changes in 1 function)
[ ] Step 3 — Testid seeds: 1 in page.tsx, 12 in ClassFormModal.tsx (attributes only)
[ ] Step 4 — Fixture constants + cleanup: 2 lines in test-data.ts, 8 lines in db.ts
[ ] Step 5 — SchedulePage POM extension: ~120 lines appended to existing stub
[ ] Step 6 — Spec file: 7 tests, new file schedule-create-class.spec.ts
```

**Standing directives:**

- Do NOT fix BUG-015 sub-findings L6, L7, L8 (RLS issues). Those are out of tier scope. File as BUG-016 in the Scribe phase.
- Do NOT touch the edit class path (PUT /api/classes/[id]) — that is Tier 3.10 (Reschedule).
- Do NOT replace the native `<select>` elements with a shadcn `Select` component — no restructuring.
- Do NOT add a `created_at` column to `classes` if it doesn't exist — check the schema first. If it exists, use it in Scenario 4. If it doesn't, use an alternative discriminator (e.g., query by the specific capacity + time combination used in that test).
- After all 6 steps, run the 7-test spec in isolation (`npx playwright test schedule-create-class`) before the full admin regression suite.

**Tier counter:** This is Tier 3.8. Tier 3 counter advances to **8/12** on completion.

Now I'll write this to the file. Since I don't see a Write/Edit tool in the available set, I need to check again.

Looking at my tool list: Glob, Grep, Read, WebFetch, TodoWrite, WebSearch — no Write tool. The task says "Write it to [path]" but the final note also says "the parent agent reads your text output, not files you create." I'll return the complete blueprint as my response text. The parent agent will handle writing it to the file.

---

# QA Council — Schedule: Create Class (Tier 3.8) — ARCHITECT

**Pipeline ID:** `schedule-create-class`
**Tier:** 3.8 (Core Writes — 8 of 12)
**Project:** `admin`
**Phase:** 2 — Architect
**Date:** 2026-04-10
**Input:** `specs/reports/schedule-create-class-analyst.md`
**Status:** 8-step blueprint. Execution order is load-bearing — do not re-order without re-reviewing dependencies.

---

## Scope affirmation

Re-read the Analyst report. All four BUG-015 blocking layers are in play, plus L5 (missing POST role check, fixed for free). One migration. Thirteen testid seeds across two files. Existing `SchedulePage.ts` stub extended with a new Tier 3.8 section (not replaced). Seven tests (4 P0 + 3 P1). Eight files total.

**Test scenarios 1:1 match the Analyst's listing:**

| # | Priority | Title |
|---|---|---|
| 1 | P0 | Create class happy path — all fields filled |
| 2 | P0 | Activity log explicit proof — description + type |
| 3 | P0 | Description field writes to classes.notes (L1 explicit proof) |
| 4 | P0 | Blank title defaults to class_type.name (L2 explicit proof) |
| 5 | P1 | Missing class_type_id returns inline error |
| 6 | P1 | End time before start time returns inline error |
| 7 | P1 | Cancel closes modal without writing |

**POM section header:** `// ─── Tier 3.8: Create Class ───`

**Fixture note:** `seedClass()` already exists and `resetStudioTestData` already cleans classes by `E2E Test%` title prefix. No new seed helper needed. One cleanup addition (step 5c) for `activity_log` rows with `type LIKE 'class_%'`. Two new constants in `test-data.ts`.

---

## Critical file paths

| File | Action | Step |
|---|---|---|
| `supabase/migrations/<timestamp>_extend_activity_log_class_types.sql` | Create — new SQL migration | 1 |
| `apps/web/src/app/api/classes/route.ts` | Modify — POST handler rewrite (L1–L5) | 2 |
| `apps/web/src/app/(admin)/schedule/page.tsx` | Modify — 1 testid on "New Class" button (line 736) | 3 |
| `apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` | Modify — 12 testids on form elements | 3 |
| `apps/web/e2e/fixtures/test-data.ts` | Modify — 2 class_type constants | 4 |
| `apps/web/e2e/fixtures/db.ts` | Modify — step 5c cleanup block | 4 |
| `apps/web/e2e/pages/SchedulePage.ts` | Modify — extend existing stub with Tier 3.8 section | 5 |
| `apps/web/e2e/schedule-create-class.spec.ts` | Create — 7-test spec | 6 |

Eight files. No new API routes. No new UI components.

---

## Execution order (load-bearing)

```
Step 1 → Step 2    (migration MUST land before route fix runs in tests)
Step 3             (independent — seeds testids needed by POM)
Step 4             (independent — constants + cleanup needed by spec)
Step 5             (depends on Step 3 testids existing in source)
Step 6             (depends on Steps 1–5 all complete)
```

- **Step 1 before Step 2:** The `activity_log` CHECK constraint rejects `'class_created'`. Even a perfectly-written handler will silently fail the log insert until the migration lands. The Engineer must apply the migration and verify via `pg_constraint` query before touching the route file.
- **Steps 1 and 2 are the only production-code steps.** Steps 3–6 are test infrastructure that do not affect the running application.
- **Step 3 before Step 5:** The POM references testids by string. If the attributes are not in source, Playwright locators will silently match zero elements. Seeds must be added to source first so the POM is verifiable.
- **Step 4 before Step 6:** The spec imports `DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID` from `test-data.ts` and relies on `resetStudioTestData` running the 5c cleanup block.
- **Step 5 before Step 6:** The spec imports `SchedulePage`.
- **Steps 3 and 4 are independent of each other.** They can run in either order, but both must complete before Step 5.

---

## Step 1 — Migration: extend `activity_log.type` CHECK constraint

**File:** New file in `supabase/migrations/` — name `<timestamp>_extend_activity_log_class_types.sql`
**Estimated diff:** 1 new file, ~15 lines SQL
**Why first:** Hardest blocker. `'class_created'` is not in the CHECK enum. This cannot be worked around in application code. The DB rejects the insert regardless of handler correctness.

### What the migration must do

Drop `activity_log_type_check` using `DROP CONSTRAINT IF EXISTS` (idempotent), then re-add it with four new values appended: `'class_created'`, `'class_updated'`, `'class_cancelled'`, `'class_deleted'`. The complete 22-value array is in the Analyst report Layer 4 section. Do NOT omit any of the original 18 values.

Apply via Supabase MCP `apply_migration`. Verify with:

```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'activity_log_type_check';
```

The result must contain all four new values in the ARRAY literal.

### Acceptance criteria for Step 1

- Migration file exists with a valid timestamp prefix.
- `pg_constraint` query returns a definition containing `'class_created'`, `'class_updated'`, `'class_cancelled'`, `'class_deleted'`.
- All 18 original values still present (no regression).
- A test insert with `type = 'class_created'` succeeds (verify via Supabase MCP `execute_sql`).

---

## Step 2 — POST handler rewrite (BUG-015 L1–L5)

**File:** `apps/web/src/app/api/classes/route.ts`
**Function:** `export async function POST(...)` — lines 102–220
**Estimated diff:** ~25 lines changed within the existing handler body; 0 lines outside it
**Why second:** Migration (Step 1) must be live. This single handler rewrite fixes all five issues in one pass. Do NOT touch the GET handler.

### Five discrete changes — all within the POST handler body

**L5 — Add role check between lines 162 and 164**

The GET handler already has the exact pattern at lines 44–50. Copy it verbatim. Insert after `const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID` and before the class_type verification query. Reject with 403 if the user lacks `'owner'` or `'manager'` role.

**L2, part A — Extend the class_type verification query at line 165**

Change `.select("id")` to `.select("id, name")`. One string change. The `classType` variable now has `classType.id` and `classType.name`. No new query, no new round trip.

**L1 — Fix phantom column write at line 188**

In the `.insert({...})` block at lines 179–193, change:
```
description: description ?? null,
```
to:
```
notes: description ?? null,
```
One line change. The `description` variable from the destructured body is correct — only the DB column name changes.

**L2, part B — Title default at line 187**

In the same `.insert({...})` block, change:
```
title: title ?? null,
```
to:
```
title: title || classType.name,
```
Use `||` (not `??`) because the modal sends `title: '' || null` which evaluates to `null` before the network call — `??` would not catch that. `classType.name` is guaranteed non-null (schema `NOT NULL`, confirmed Analyst Probe 1b). No null-coalesce needed on `classType.name`.

**L3 + L4 — Fix the activity_log insert at lines 203–210**

Two changes to the existing insert:

1. Add `description: \`Class created: ${classType.name}\`` to the insert object. Use `classType.name` (the type name), not `title` (the possibly-customized user value). This is consistent regardless of whether the user provided a custom title.
2. Capture the result: change `await supabase.from("activity_log").insert({...})` to `const { error: activityError } = await supabase.from("activity_log").insert({...})`. Add capture-and-log immediately after: `if (activityError) { console.error("POST /api/classes: activity_log insert failed", activityError.message) }`. No rollback — the class was successfully created; losing an observability row is not a reason to return 500.

### Updated JSDoc comment at lines 97–101

```
POST /api/classes
Create a new class. Body field `description` maps to DB column `notes` (L1 fix).
`title` defaults to the class_type.name when omitted or blank (L2 fix).
Requires owner or manager role (L5 fix). Writes an activity_log row with
type='class_created'. Requires migration extending the activity_log CHECK enum.
```

### Acceptance criteria for Step 2

- POST handler has a role check returning 403 for non-owner/manager users.
- `class_types` verification query selects `"id, name"`.
- `.insert()` uses `notes: description ?? null`, not `description: description ?? null`.
- `.insert()` uses `title: title || classType.name` — never inserts null into the NOT NULL column.
- `activity_log` insert includes `description: \`Class created: ${classType.name}\``.
- `activity_log` result captured into `activityError`, `console.error`'d on failure, never returned as 500.
- GET handler is untouched.
- Handler still returns `{ data: newClass }` with status 201 on success.

---

## Step 3 — Testid seeds (13 attributes across 2 files)

**Files:**
- `apps/web/src/app/(admin)/schedule/page.tsx` — 1 seed
- `apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` — 12 seeds

**Estimated diff:** 13 attribute additions; zero logic changes
**Why third:** POM and spec reference these testids. Attributes must exist in source. Per `AGENTS.md` minimal-diff discipline: one attribute per element, no restructuring.

### `schedule/page.tsx` — 1 seed

At line 736, the `<button>` currently has no testid. Add `data-testid="schedule-new-class-btn"` alongside the existing `onClick` and `className` props.

### `ClassFormModal.tsx` — 12 seeds

All line numbers from the current confirmed file state:

| Testid | Element | Line |
|---|---|---|
| `schedule-class-form-modal` | `<DialogContent>` | 149 |
| `schedule-class-form-type-select` | `<select>` (class type) | 165 |
| `schedule-class-form-title-input` | `<Input>` (title) | 179 |
| `schedule-class-form-date-input` | `<Input type="date">` | 185 |
| `schedule-class-form-start-time-input` | `<Input type="time">` (start) | 189 |
| `schedule-class-form-end-time-input` | `<Input type="time">` (end) | 193 |
| `schedule-class-form-capacity-input` | `<Input type="number">` | 200 |
| `schedule-class-form-trainer-select` | `<select>` (trainer) | 204 |
| `schedule-class-form-description-textarea` | `<textarea>` | 219 |
| `schedule-class-form-error` | `<p className="text-sm text-red-600">` | 229 |
| `schedule-class-form-cancel-btn` | Cancel `<Button>` | 235 |
| `schedule-class-form-submit-btn` | Submit `<Button>` | 236 |

**Critical — `schedule-class-form-modal` on `<DialogContent>`:** shadcn's `DialogContent` forwards arbitrary props to the rendered `<div role="dialog">`. Adding `data-testid` directly on `<DialogContent>` propagates to the DOM element. This is the established pattern.

**Critical — `schedule-class-form-error` on the conditional `<p>`:** This element is only in the DOM when `error` is truthy. `expect(locator).toBeHidden()` correctly treats a detached element as hidden. Do NOT add a wrapper `<div>` to keep the element in the DOM permanently.

### Acceptance criteria for Step 3

- `grep 'schedule-new-class-btn' apps/web/src/app/(admin)/schedule/page.tsx` returns exactly 1 hit.
- `grep 'schedule-class-form-' apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` returns exactly 12 hits.
- No logic changes, no prop changes, no component restructuring.

---

## Step 4 — Fixture constants and cleanup

**Files:**
- `apps/web/e2e/fixtures/test-data.ts` — 2 new exports
- `apps/web/e2e/fixtures/db.ts` — 1 new cleanup block

**Estimated diff:** ~10 lines total
**Why fourth:** Spec imports these constants. Cleanup must run in `beforeEach` and `afterAll` before any test executes.

### `test-data.ts` — 2 new constants

Append after `E2E_MEMBER_NAME_PREFIX` at the end of the file:

```ts
/** UUID of the "Open Sauna" class_type in the default test studio.
 *  Stable — seeded at DB init, never created or deleted by tests. */
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID = '314f0ddf-dc6d-4402-beaa-22ed19172b18'

/** Display name of the "Open Sauna" class_type.
 *  Used as the expected default title in Scenario 4 (blank-title proof). */
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME = 'Open Sauna'
```

Copy the UUID verbatim from the Analyst Probe 4 table — do not retype.

### `db.ts` — Step 5c cleanup block

Insert after the step 5b block (which ends around line 467) and before step 6:

```ts
// 5c. Delete activity_log rows for test-created classes. The 'class_*' types
//     were added by Tier 3.8's migration and are only produced by this test
//     suite. Scoped to the test studio. Safe against shared dev DBs because
//     no pre-existing rows use these types.
await testDb
  .from('activity_log')
  .delete()
  .eq('studio_id', studioId)
  .like('type', 'class_%')
```

### Acceptance criteria for Step 4

- `test-data.ts` exports `DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID` and `DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME`.
- UUID matches Analyst Probe 4 exactly.
- `resetStudioTestData` contains a step 5c block that deletes `activity_log` rows with `type LIKE 'class_%'` for the test studio.
- Step 5c is inserted between the existing step 5b and step 6 blocks, with the explaining comment.

---

## Step 5 — SchedulePage POM extension

**File:** `apps/web/e2e/pages/SchedulePage.ts`
**Action:** Extend — append Tier 3.8 section inside the existing class body after `expectMounted()`
**Estimated diff:** ~120 lines appended; existing 30 lines untouched
**Why fifth:** Spec imports `SchedulePage` methods. All locators and helpers must exist before the spec compiles.

### Architecture decision: extend the existing stub

The existing `SchedulePage.ts` is a valid 30-line file with `pageRoot()` + `expectMounted()`. The Tier 3.8 section is a new block appended inside the class body after `expectMounted()`. Do NOT replace the file. The Tier 2.2 smoke test (`schedule.spec.ts`) still calls `expectMounted()` and must continue to pass.

No new imports are needed — `Locator` and `expect` are already imported in the stub. `ANIM_TIMEOUT` is already imported from `'./BasePage'`.

### Full POM skeleton to implement

```ts
// ─── Tier 3.8: Create Class ────────────────────────────────────────────────
//
// Locators and helpers for the "New Class" flow on /schedule.
// The modal is rendered by ClassFormModal.tsx as a shadcn Dialog.
// Flow: click "New Class" → modal opens → fill form → click "Create Class"
// → POST /api/classes → modal closes → schedule refreshes.
//
// BUG-015 (4-layer route divergence) was fixed inline as part of this tier:
//   L1. description → notes column mapping in the POST handler
//   L2. title defaults to class_type.name when blank (Option A)
//   L3. activity_log.description added (NOT NULL guard)
//   L4. activity_log.type='class_created' added to CHECK enum via migration
//   L5. POST role check added (owner | manager)

/** "New Class" button in the schedule page header. Opens the create modal. */
newClassBtn(): Locator {
  return this.byTestId('schedule-new-class-btn')
}

/** The DialogContent container of the ClassFormModal. Visible when modal is open. */
classFormModal(): Locator {
  return this.byTestId('schedule-class-form-modal')
}

/** Class type native <select>. Use .selectOption({ label: '...' }) to pick by name. */
classTypeSelect(): Locator {
  return this.byTestId('schedule-class-form-type-select')
}

/** Title text input (optional per UI label; defaults to class_type.name server-side). */
titleInput(): Locator {
  return this.byTestId('schedule-class-form-title-input')
}

/** Date input (type="date"). Fill with 'YYYY-MM-DD'. */
dateInput(): Locator {
  return this.byTestId('schedule-class-form-date-input')
}

/** Start time input (type="time"). Fill with 'HH:MM'. */
startTimeInput(): Locator {
  return this.byTestId('schedule-class-form-start-time-input')
}

/** End time input (type="time"). Fill with 'HH:MM'. */
endTimeInput(): Locator {
  return this.byTestId('schedule-class-form-end-time-input')
}

/** Capacity number input. Fill with the string representation of an integer. */
capacityInput(): Locator {
  return this.byTestId('schedule-class-form-capacity-input')
}

/** Trainer native <select>. Use .selectOption({ label: '...' }) or '' for None. */
trainerSelect(): Locator {
  return this.byTestId('schedule-class-form-trainer-select')
}

/**
 * Description textarea. The UI label says "Description" but this writes to
 * the DB column `classes.notes` (not `description` — that column does not
 * exist). BUG-015 L1 fix ensures the POST handler does this mapping correctly.
 */
descriptionTextarea(): Locator {
  return this.byTestId('schedule-class-form-description-textarea')
}

/**
 * Inline error paragraph. Conditionally rendered when setError() is called.
 * Covers both client-side validation (e.g., 'Please select a class type')
 * and server-side 400/500 errors (e.g., 'end_time must be after start_time').
 * Both paths render the same <p> element — one testid covers both cases.
 * Only in the DOM when an error exists — expect().toBeHidden() treats
 * detached elements as hidden (Playwright correct behavior).
 */
classFormError(): Locator {
  return this.byTestId('schedule-class-form-error')
}

/** "Create Class" primary submit button (shows "Save Changes" in edit mode). */
submitClassBtn(): Locator {
  return this.byTestId('schedule-class-form-submit-btn')
}

/** "Cancel" outline button — closes modal without submitting. */
cancelClassBtn(): Locator {
  return this.byTestId('schedule-class-form-cancel-btn')
}

/**
 * Click "New Class" and wait for the modal to become fully interactive.
 *
 * Two waits are needed:
 * 1. classFormModal visible — the Dialog rendered
 * 2. submitClassBtn enabled — the lookup spinner (class_types + trainers)
 *    resolved, options are in the DOM, form is interactive
 *
 * Do NOT proceed to fillClassForm() until openNewClassModal() resolves —
 * selectOption() on an empty <select> will silently fail.
 */
async openNewClassModal(): Promise<void> {
  await this.newClassBtn().click()
  await expect(this.classFormModal()).toBeVisible({ timeout: ANIM_TIMEOUT })
  await expect(this.submitClassBtn()).toBeEnabled({ timeout: ANIM_TIMEOUT })
}

/**
 * Fill the class creation form. All fields are optional — only provided
 * fields are acted on. Omitted fields retain their current modal state.
 *
 * @param classTypeName - Visible text of the class type option ('Open Sauna').
 *   Passed to selectOption({ label }). Must exactly match the option text.
 * @param title - Title string. Pass '' to test the blank-title default (Scenario 4).
 * @param date - 'YYYY-MM-DD' format.
 * @param startTime - 'HH:MM' format (e.g., '17:00').
 * @param endTime - 'HH:MM' format (e.g., '18:00').
 * @param capacity - Integer capacity value (passed as string to .fill()).
 * @param description - Description / notes text (maps to classes.notes via L1 fix).
 */
async fillClassForm(opts: {
  classTypeName?: string
  title?: string
  date?: string
  startTime?: string
  endTime?: string
  capacity?: number
  description?: string
}): Promise<void> {
  if (opts.classTypeName !== undefined) {
    await this.classTypeSelect().selectOption({ label: opts.classTypeName })
  }
  if (opts.title !== undefined) {
    await this.titleInput().fill(opts.title)
  }
  if (opts.date !== undefined) {
    await this.dateInput().fill(opts.date)
  }
  if (opts.startTime !== undefined) {
    await this.startTimeInput().fill(opts.startTime)
  }
  if (opts.endTime !== undefined) {
    await this.endTimeInput().fill(opts.endTime)
  }
  if (opts.capacity !== undefined) {
    await this.capacityInput().fill(String(opts.capacity))
  }
  if (opts.description !== undefined) {
    await this.descriptionTextarea().fill(opts.description)
  }
}

/**
 * Click the submit button and wait for the POST /api/classes response.
 *
 * Race-safe canonical pattern: the waitForResponse promise is created BEFORE
 * the click, so the response cannot arrive and be missed between the click
 * and the listener registration. The 30-second timeout covers Next.js
 * cold-compile on the first test run of the session.
 *
 * The filter requires BOTH url includes '/api/classes' AND method === 'POST'
 * so that the GET /api/classes fired by onSuccess() (schedule refresh) does
 * not satisfy the promise.
 *
 * This helper resolves when the POST response arrives. It does NOT assert
 * the response status code — callers assert modal state and DB content.
 */
async submitClassForm(): Promise<void> {
  const responsePromise = this.page.waitForResponse(
    (res) =>
      res.url().includes('/api/classes') &&
      res.request().method() === 'POST',
    { timeout: 30_000 },
  )
  await this.submitClassBtn().click()
  await responsePromise
}

/**
 * Click Cancel and wait for the modal to be hidden.
 * Does not trigger any network request — the button calls onOpenChange(false).
 */
async cancelClassForm(): Promise<void> {
  await this.cancelClassBtn().click()
  await expect(this.classFormModal()).toBeHidden({ timeout: ANIM_TIMEOUT })
}

/**
 * Assert the inline error element is visible and optionally contains a substring.
 * Used by Scenarios 5 and 6 to verify validation errors.
 *
 * @param messageSubstring - if provided, asserts the error text contains this string.
 */
async expectClassFormError(messageSubstring?: string): Promise<void> {
  await expect(this.classFormError()).toBeVisible({ timeout: ANIM_TIMEOUT })
  if (messageSubstring !== undefined) {
    await expect(this.classFormError()).toContainText(messageSubstring)
  }
}
```

### Acceptance criteria for Step 5

- Existing `pageRoot()` and `expectMounted()` methods are untouched.
- Section header comment present: `// ─── Tier 3.8: Create Class ───`.
- 13 locator methods: one per testid listed in Step 3.
- 5 helper methods: `openNewClassModal()`, `fillClassForm(opts)`, `submitClassForm()`, `cancelClassForm()`, `expectClassFormError(messageSubstring?)`.
- `submitClassForm()` creates the `waitForResponse` promise BEFORE calling `.click()`.
- `fillClassForm()` treats all opts fields as optional — omitted fields are not acted on.
- No new imports needed (all imports already in the stub).

---

## Step 6 — Spec file

**File (NEW):** `apps/web/e2e/schedule-create-class.spec.ts`
**Estimated diff:** ~200 lines, 7 tests
**Why last:** Depends on Steps 1–5 all complete. A single test cannot pass until every preceding step is done.

### File structure

Mirror `members-archive-exclude.spec.ts` for file header, `describe`/`beforeEach`/`afterAll` structure, and per-test shape. File header doc-comment must name all four BUG-015 layers. Tests tagged `@p0` or `@p1` in the title string.

```ts
import { test, expect } from '@playwright/test'
import { SchedulePage } from './pages/SchedulePage'
import { resetStudioTestData, testDb } from './fixtures/db'
import {
  DEFAULT_STUDIO_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
  E2E_CLASS_TITLE_PREFIX,
} from './fixtures/test-data'

function uniqueTag(label: string): string {
  return `${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function uniqueTitle(label: string): string {
  return `${E2E_CLASS_TITLE_PREFIX} ${uniqueTag(label)}`
}

function tomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

test.describe('Schedule — Create Class (Tier 3.8)', () => {
  test.beforeEach(async () => { await resetStudioTestData() })
  test.afterAll(async () => { await resetStudioTestData() })
  // 7 tests follow
})
```

### Per-scenario execution notes

**Scenario 1 (P0 — happy path):** Fill all fields including description. After `submitClassForm()`, assert modal hidden, then query DB by `title = uniqueTitle` for the classes row. Assert `class_type_id`, `title`, `notes`, `capacity`, `status`. Also fetch `activity_log` by `subject_id = newClass.id` and `type = 'class_created'` — assert it exists.

**Scenario 2 (P0 — activity log explicit proof):** Same setup as Scenario 1 but assertions focus on the log row. Assert `log.type === 'class_created'` (L4 proof), `log.description` is truthy and contains `'Class created'` (L3 proof), `log.subject_type === 'class'`, `log.metadata.class_type_id` matches the Open Sauna ID.

**Scenario 3 (P0 — L1 explicit proof):** Use a unique `proofString` as the description. After submit, query `classes.notes` by the class ID and assert `notes === proofString`. Regression guard: assert `(cls as Record<string, unknown>)['description'] === undefined` to catch if a phantom `description` column ever appears.

**Scenario 4 (P0 — L2 explicit proof):** Fill with `title: ''`. After submit and modal close, query the most recently created class for that class_type_id in the studio (order by `created_at DESC LIMIT 1`). Assert `title === DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME`. Additionally assert `created_at` is within 30 seconds of `Date.now()` to distinguish this row from prior blank-title test residue. Assert the activity_log description contains `DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME`.

**Scenario 5 (P1 — missing class_type_id):** Open modal, fill date/times only (no class type). Click `submitClassBtn()` directly — do NOT use `submitClassForm()` (client-side guard fires before fetch; no POST is made). Assert `expectClassFormError('Please select a class type')` and `classFormModal()` is still visible. Assert no `classes` row with `created_at` in the last 5 seconds.

**Scenario 6 (P1 — end before start):** Fill class type + date + `startTime: '18:00'` + `endTime: '17:00'`. Use `submitClassForm()` — a POST IS made before the server 400 rejects it. Assert `expectClassFormError('end_time must be after start_time')` and modal still visible.

**Scenario 7 (P1 — cancel):** Fill class type + a unique title. Call `cancelClassForm()`. Assert modal hidden. Assert no `classes` row with `created_at` in the last 5 seconds. Reopen modal (`openNewClassModal()`), assert title input is `''` and class type select is `''` (form reset on re-open).

### Acceptance criteria for Step 6

- Seven tests, tagged `@p0` (1–4) or `@p1` (5–7).
- Each test navigates to `/schedule` via `schedule.goto('/schedule')` + `schedule.expectMounted()`.
- Scenario 5 uses direct button click, not `submitClassForm()`, because no network call is expected.
- Scenario 6 uses `submitClassForm()` because a POST fires before the server rejects it.
- Scenario 4 asserts `created_at` recency (within 30 seconds) as a discrimination guard.
- No test asserts on toast text. The ClassFormModal success path calls `onOpenChange(false)` and `onSuccess()` — no toast is fired by the modal itself.
- All assertions are against the DB, not against rendered text (except the inline error scenarios).

---

## Risk register

| Risk | Step | Mitigation |
|---|---|---|
| Migration not applied before running tests | 1 | Engineer applies migration and verifies `pg_constraint` before Step 2. Sentinel greps for `class_created` in route to confirm the fix, and can cross-check migration file existence. |
| `selectOption({ label: 'Open Sauna' })` fails because spinner still showing | 5 POM | `openNewClassModal()` waits for `submitClassBtn().toBeEnabled()` — spinner means button is disabled. This is the correct signal that lookups resolved. |
| Scenario 4 blank-title row indistinguishable from prior test residue | 6 Scenario 4 | Assert `created_at` within 30 seconds. `resetStudioTestData` beforeEach handles `E2E Test%` titled rows but not `'Open Sauna'` titled rows. The recency guard is the only safeguard against stale residue. |
| `classFormError` detached from DOM when no error (Playwright assertion on absent element) | 3 + 5 | Playwright `expect(locator).toBeHidden()` correctly treats detached elements as hidden. Do NOT wrap the conditional `<p>` in a permanent container. |
| `waitForResponse` filter matches the GET /api/classes fired by `onSuccess()` | 5 POM | Filter requires `method() === 'POST'`. The schedule refresh fires a GET. The filter is precise. |
| Blank-title class row not cleaned up between test runs | 4 + 6 | Step 5c cleans activity_log rows. The classes row with `title='Open Sauna'` persists but is harmless — Scenario 4 uses recency guard. Future tier can add a targeted cleanup if accumulation becomes a problem. |
| POST role check (L5) blocks the test admin user | 2 | Test admin has `roles: ['owner']` per `ADMIN_USER` constant in `test-data.ts`. The role check accepts `'owner'`. No test-user change needed. |
| `classes` table has no `created_at` column | 6 Scenario 4 | The Engineer must verify `created_at` exists by reading `information_schema.columns` for `classes`. The Analyst Probe 1 listed 21 columns; `created_at` was not explicitly listed. If absent, substitute with a capacity + time combination unique to the Scenario 4 test (e.g., capacity=7 to distinguish it from the default 12). |

---

## Handoff checklist for the Sentinel

```
[ ] Migration: pg_constraint contains 'class_created', 'class_updated', 'class_cancelled', 'class_deleted'
[ ] Migration: all 18 original activity_log types still present
[ ] Route: POST /api/classes returns 201 for owner role with valid body
[ ] Route: POST /api/classes returns 403 for missing/non-owner role
[ ] Route: POST /api/classes returns 400 when end_time <= start_time
[ ] Route: POST /api/classes returns 404 for unknown class_type_id
[ ] DB: classes.notes populated when description field sent (L1)
[ ] DB: classes.title = class_type.name when body title is null/blank (L2)
[ ] DB: activity_log row exists with type='class_created' for each created class (L4)
[ ] DB: activity_log.description is non-null for created classes (L3)
[ ] UI: data-testid="schedule-new-class-btn" in page.tsx — grep returns 1 hit
[ ] UI: all 12 schedule-class-form-* testids in ClassFormModal.tsx — grep returns 12 hits
[ ] POM: SchedulePage.ts Tier 3.8 section present, 5 helpers implemented
[ ] POM: submitClassForm() creates waitForResponse BEFORE click (read the code)
[ ] Spec: schedule-create-class.spec.ts — 7 tests, 4 @p0 + 3 @p1
[ ] Cleanup: resetStudioTestData step 5c present and deletes type LIKE 'class_%'
[ ] Regression: Tier 3.7 members-archive-exclude passes
[ ] Regression: Tier 2.2 schedule smoke passes (expectMounted() untouched)
```

---

## Handoff to Engineer

**Execute Steps 1–6 in order. Rationale is in the execution order section — do not skip.**

```
[ ] Step 1 — Migration: extend activity_log.type CHECK (1 new SQL file, ~15 lines; apply + verify)
[ ] Step 2 — POST handler rewrite: 5 discrete changes in 1 function, ~25 lines changed
[ ] Step 3 — Testid seeds: 1 in page.tsx, 12 in ClassFormModal.tsx, attributes only
[ ] Step 4 — Fixture constants + cleanup: 4 lines in test-data.ts, 8 lines in db.ts
[ ] Step 5 — SchedulePage POM extension: ~120 lines appended after expectMounted()
[ ] Step 6 — Spec file: 7 tests, new file schedule-create-class.spec.ts, ~200 lines
```

**Standing directives:**

- Do NOT fix BUG-015 sub-findings L6, L7, L8 (RLS policy issues). File as BUG-016 in the Scribe phase.
- Do NOT touch `PUT /api/classes/[id]` — that is Tier 3.10 (Reschedule).
- Do NOT replace the native `<select>` elements with shadcn `Select` — no restructuring.
- Do NOT rename existing testids. The `schedule-page-root` testid from Tier 2.2 stays unchanged.
- Before Scenario 4, verify that `classes.created_at` exists in the schema. If it does not, use a unique `capacity` value (e.g., 7) to identify the blank-title test row instead of recency.
- Run the 7-test spec in isolation (`npx playwright test schedule-create-class`) before the full admin regression suite.

**Tier counter:** This is Tier 3.8. Tier 3 counter advances to **8/12** on completion.