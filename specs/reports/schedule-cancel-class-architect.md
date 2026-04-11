# Tier 3.9 — Schedule: Cancel Class — Architect

**Run date:** 2026-04-10
**Phase:** 2 (Architect)
**Input:** `specs/reports/schedule-cancel-class-analyst.md`
**Blueprint:** 7 steps, 0 migrations, 7 files

---

## Critical file paths

| File | Action | Step |
|---|---|---|
| `apps/web/src/app/api/classes/[id]/route.ts` | Modify — PUT + DELETE handler rewrite (BUG-017 L1, L3, L5) | 1 |
| `apps/web/src/app/(admin)/schedule/page.tsx` | Modify — add Cancel button to ClassDetailPanel + 3 testid seeds (cancel btn + edit btn + class tile) | 2 |
| `apps/web/e2e/pages/SchedulePage.ts` | Modify — extend with Tier 3.9 section | 3 |
| `apps/web/e2e/fixtures/db.ts` | Modify — (optional) extend `seedClass` to accept `studioId` parameter if not already | 4 |
| `apps/web/e2e/schedule-cancel-class.spec.ts` | Create — 5-test spec | 5 |

5 files (3 modify + 1 new + 1 conditional). Zero migrations.

---

## Execution order (load-bearing)

```
Step 1 → Step 2   (handler fix before UI wire-up — UI hits the fixed handler)
Step 2 → Step 3   (testids seeded before POM references them)
Step 3 → Step 5   (spec imports POM helpers)
```

Step 4 is optional and can happen any time before Step 5 if needed.

---

## Step 1 — `/api/classes/[id]` handler rewrite (BUG-017)

**File:** `apps/web/src/app/api/classes/[id]/route.ts`
**Estimated diff:** ~50 lines changed across two handlers, 0 added outside them
**Why first:** UI in Step 2 calls PUT; handler must be correct first.

### PUT handler changes (5 discrete edits)

**Change 1 — Add role check after profile fetch (lines 108-115)**

After `const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID`, insert:

```ts
// BUG-017 L5: role check mirrors the GET handler and Tier 3.8 POST fix.
const roles: string[] = profile?.roles ?? [];
if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
  return NextResponse.json(
    { error: "Forbidden" },
    { status: 403 }
  );
}
```

**Change 2 — Remove `"description"` from `allowedFields` + add `notes` remap**

Change `allowedFields` at lines 118-127 to:

```ts
const allowedFields = [
  "title",
  "class_type_id",
  "start_time",
  "end_time",
  "capacity",
  "trainer_id",
  "status",
];
```

(Remove `"description"`.)

Then, after the existing remap block for `start_time`/`end_time` (lines 138-145), add:

```ts
// BUG-017 L1: body field `description` maps to DB column `notes`.
// The classes table has no `description` column.
if (body.description !== undefined) {
  updates.notes = body.description ?? null;
}
```

This preserves backward compatibility — API clients sending `description` still work, but the write lands in the correct column.

**Change 3 — Capture existingClass for the activity_log description**

Before the UPDATE block at line 193, insert a fetch:

```ts
// Fetch existing class for the activity_log description (class may not
// have a title yet, we want to log the resolved title from the DB).
const { data: existingClass } = await supabase
  .from("classes")
  .select("title")
  .eq("id", id)
  .eq("studio_id", studioId)
  .single();
```

**Change 4 — Rewrite the activity_log insert (BUG-017 L3)**

Replace the existing insert at lines 216-223:

```ts
// BUG-017 L3: description is NOT NULL. Capture-and-log pattern.
const classTitle = updated.title ?? existingClass?.title ?? "(untitled)";
const wasCancelled = updates.status === "cancelled";
const { error: activityError } = await supabase.from("activity_log").insert({
  studio_id: studioId,
  actor_id: user.id,
  type: wasCancelled ? "class_cancelled" : "class_updated",
  subject_type: "class",
  subject_id: id,
  description: wasCancelled
    ? `Class cancelled: ${classTitle}`
    : `Class updated: ${classTitle}`,
  metadata: updates,
});

if (activityError) {
  console.error(
    "PUT /api/classes/[id]: activity_log insert failed",
    activityError.message
  );
}
```

Key design: **the log type is `class_cancelled` when the update sets `status: 'cancelled'`** (specific marker for the cancellation path), and `class_updated` otherwise. This gives ops dashboards clean separation between generic edits and cancellations.

**Change 5 — Update JSDoc**

Update the JSDoc at lines 83-87 to reflect:

```
PUT /api/classes/[id]
Update class details. Requires owner or manager role.

Body field `description` maps to the DB column `notes`.
Setting status='cancelled' logs type='class_cancelled' for clean audit separation.
```

### DELETE handler changes (3 discrete edits)

**Change 6 — Add role check**

Same 4-line pattern as PUT, after `studioId` assignment.

**Change 7 — Fetch existingClass before delete**

Before the booking count query at line 268, insert:

```ts
const { data: existingClass } = await supabase
  .from("classes")
  .select("title")
  .eq("id", id)
  .eq("studio_id", studioId)
  .single();

if (!existingClass) {
  return NextResponse.json({ error: "Class not found" }, { status: 404 });
}
```

This also adds a clean 404 on a non-existent class.

**Change 8 — Rewrite the activity_log insert (BUG-017 L3)**

Replace lines 297-304 with:

```ts
const classTitle = existingClass.title ?? "(untitled)";
const { error: activityError } = await supabase.from("activity_log").insert({
  studio_id: studioId,
  actor_id: user.id,
  type: "class_deleted",
  subject_type: "class",
  subject_id: id,
  description: `Class deleted: ${classTitle}`,
  metadata: {},
});

if (activityError) {
  console.error(
    "DELETE /api/classes/[id]: activity_log insert failed",
    activityError.message
  );
}
```

### Acceptance criteria for Step 1

- PUT handler has role check returning 403 for non-owner/manager
- PUT handler's `allowedFields` no longer contains `"description"`
- PUT handler remaps `body.description → updates.notes` if present
- PUT handler's activity_log insert has `description` non-null and type `class_cancelled` or `class_updated` (conditional on `updates.status === 'cancelled'`)
- PUT handler captures `activityError` and `console.error`s on failure
- DELETE handler has role check
- DELETE handler fetches `existingClass` and returns 404 if not found
- DELETE handler's activity_log insert has `description` non-null
- GET handler is untouched
- JSDoc on PUT is updated

---

## Step 2 — UI: add Cancel button + 3 testid seeds

**File:** `apps/web/src/app/(admin)/schedule/page.tsx`

### Change A — Add Cancel button to ClassDetailPanel

Find the Edit Class button at lines 481-487. Replace the block with:

```tsx
<button
  data-testid="schedule-edit-class-btn"
  onClick={onEditClass}
  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
>
  <Edit3 className="w-4 h-4" />
  Edit Class
</button>
<button
  data-testid="schedule-cancel-class-btn"
  onClick={onCancelClass}
  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-950 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
>
  <X className="w-4 h-4" />
  Cancel Class
</button>
```

(The `X` icon is already imported at the top of the file — verify before the edit.)

### Change B — Extend ClassDetailPanel props

In the function signature at lines 349-367, add `onCancelClass: () => void` to the interface. Thread it down from the parent `<ClassDetailPanel ...>` usage at line 851.

### Change C — Wire onCancelClass in the parent

At line 880-881 (where `onEditClass` is defined), add an `onCancelClass` handler:

```tsx
onCancelClass={async () => {
  if (!selectedClass) return
  if (!confirm(`Cancel "${selectedClass.name}"? Attendees will need to be notified separately.`)) return
  try {
    const res = await fetch(`/api/classes/${selectedClass.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (res.ok) {
      setSelectedClass(null)
      showToast('Class cancelled')
    } else {
      const body = await res.json().catch(() => ({}))
      showToast(body.error || 'Failed to cancel class')
    }
  } catch {
    showToast('Network error')
  }
}}
```

Place this prop alongside `onEditClass` in the panel usage block.

### Change D — Add testid to the class tile (for POM targeting)

Find the class tile rendering in the calendar grid. The tile is a clickable element inside the week grid. Search for where `cls.name` + `cls.time` is rendered inside a `<button>` or `<div onClick={...}>`. Add `data-testid="schedule-class-tile"` + `data-class-id={cls.id}` to enable targeted row clicks.

If the tile rendering is too complex to easily find, a fallback testid approach is to add it to a wrapper div around the tile content. Either way, the POM's `openClassPanel` needs a unique selector per tile.

### Change E — (If absent) Add testid to ClassDetailPanel root

Find the `<motion.div>` at line 374. Add `data-testid="schedule-class-detail-panel"` as the first attribute.

### Acceptance criteria for Step 2

- `schedule-cancel-class-btn` testid present on new button
- `schedule-edit-class-btn` testid added to existing button (small addition)
- `schedule-class-tile` testid present on calendar tile
- `schedule-class-detail-panel` testid present on panel root
- `onCancelClass` prop threaded through ClassDetailPanel interface
- Parent wires up the PUT fetch with `confirm()` dialog + toast
- No logic changes to existing Edit/Close/CheckIn/SendReminder flows

---

## Step 3 — SchedulePage POM extension

**File:** `apps/web/e2e/pages/SchedulePage.ts`
**Action:** Append a Tier 3.9 section after the existing Tier 3.8 section
**Estimated diff:** ~60 lines

```ts
// ─── Tier 3.9: Cancel Class ────────────────────────────────────────────────
//
// Locators and helpers for cancelling a class via the ClassDetailPanel.
// Flow: click a class tile on the calendar → panel opens → click Cancel
// Class → confirm() dialog → accept → PUT /api/classes/[id] with
// { status: 'cancelled' } → panel closes → toast 'Class cancelled'.
//
// BUG-017 (/api/classes/[id] PUT + DELETE divergence) was fixed inline
// as part of this tier: PUT L1 (description → notes remap), L3 (log
// description), L5 (role check); DELETE L3 + L5.

/** The class detail panel (visible when a class tile is clicked). */
classDetailPanel(): Locator {
  return this.byTestId('schedule-class-detail-panel')
}

/** The "Cancel Class" button at the bottom of the class detail panel. */
cancelClassBtn(): Locator {
  return this.byTestId('schedule-cancel-class-btn')
}

/** All class tiles on the current calendar view. */
classTiles(): Locator {
  return this.byTestId('schedule-class-tile')
}

/**
 * Click a class tile on the calendar by title text. Waits for the
 * ClassDetailPanel to become visible.
 */
async openClassPanel(classTitle: string): Promise<void> {
  const tile = this.classTiles().filter({ hasText: classTitle }).first()
  await expect(tile).toBeVisible({ timeout: ANIM_TIMEOUT })
  await tile.click()
  await expect(this.classDetailPanel()).toBeVisible({ timeout: ANIM_TIMEOUT })
}

/**
 * Click Cancel Class, handling the browser confirm() dialog. When
 * accepting, waits for the PUT /api/classes/[id] response to avoid
 * racing cold-compile. Mirrors the Tier 3.7 archiveMemberFromPanel
 * pattern exactly.
 *
 * @param accept true → accept (cancellation proceeds), false → dismiss
 */
async cancelClassFromPanel(accept: boolean): Promise<void> {
  this.page.once('dialog', async (dialog) => {
    if (accept) {
      await dialog.accept()
    } else {
      await dialog.dismiss()
    }
  })
  if (accept) {
    const responsePromise = this.page.waitForResponse(
      (res) =>
        /\/api\/classes\/[^/]+$/.test(res.url()) &&
        res.request().method() === 'PUT',
      { timeout: 30_000 },
    )
    await this.cancelClassBtn().click()
    await responsePromise
  } else {
    await this.cancelClassBtn().click()
  }
}
```

**Note on the URL regex:** `/\/api\/classes\/[^/]+$/` matches `/api/classes/<uuid>` but NOT `/api/classes` (the POST/list endpoint) or `/api/classes/<uuid>/remind`. Necessary because the POM's `submitClassForm` already uses `res.url().includes('/api/classes')` which would match both — Tier 3.9 needs a stricter filter to avoid the Create Class POST matching Cancel Class PUT.

### Acceptance criteria for Step 3

- Section header `// ─── Tier 3.9: Cancel Class ───` present
- 3 locators + 2 helpers added
- `cancelClassFromPanel(accept)` uses one-shot dialog handler + conditional waitForResponse
- URL regex stricter than Tier 3.8's `includes('/api/classes')` to avoid cross-matching
- Existing Tier 3.8 section untouched

---

## Step 4 — (Optional) db.ts adjustments

**No changes needed** unless Scenario 3 requires a new helper. For that scenario, the test can inline-seed bookings:

```ts
const { profileId: memberProfileId, memberId } = await seedMember({ ... })
await testDb.from('bookings').insert({
  id: randomUUID(),
  studio_id: DEFAULT_STUDIO_ID,
  class_id: seededClassId,
  member_id: memberProfileId,
  status: 'confirmed',
  created_at: new Date().toISOString(),
})
```

This is ~5 lines in the test body. No helper needed.

`resetStudioTestData` already cleans bookings for test profiles (step 5 at line 453-454) and for test classes (step 4 at line 447-449). Safe.

---

## Step 5 — Spec file

**File (NEW):** `apps/web/e2e/schedule-cancel-class.spec.ts`
**5 tests — 3 P0 (Scenarios 1, 2, 3) + 2 P1 (Scenarios 4, 5)**

### Structure

```ts
import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { SchedulePage } from './pages/SchedulePage'
import { resetStudioTestData, testDb, seedClass, seedMember } from './fixtures/db'
import {
  DEFAULT_STUDIO_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
  E2E_CLASS_TITLE_PREFIX,
} from './fixtures/test-data'

function uniqueTitle(label: string): string {
  return `${E2E_CLASS_TITLE_PREFIX} ${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** ISO timestamp for tomorrow at HH:MM local time. */
function tomorrowAt(hh: number, mm: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

test.describe('Schedule — Cancel Class (Tier 3.9)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // Scenario 1 — happy path
  // Scenario 2 — activity log proof
  // Scenario 3 — cancel works with active bookings
  // Scenario 4 — dismiss dialog preserves state
  // Scenario 5 — direct PUT with description field
})
```

### Scenario 1 — P0 happy path

```ts
test('cancels a class and logs class_cancelled @p0', async ({ page }) => {
  const title = uniqueTitle('CancelHappy')
  const { classId } = await seedClass({
    title,
    classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    startsAt: tomorrowAt(17, 0),
    endsAt: tomorrowAt(18, 0),
    capacity: 12,
  })

  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openClassPanel(title)
  await schedule.cancelClassFromPanel(true)

  // Panel closes
  await expect(schedule.classDetailPanel()).toBeHidden({ timeout: 10_000 })

  // DB: status flipped
  const { data: cls } = await testDb
    .from('classes')
    .select('status')
    .eq('id', classId)
    .single()
  expect(cls?.status).toBe('cancelled')

  // DB: activity_log has the cancel entry
  const { data: logs } = await testDb
    .from('activity_log')
    .select('type, description')
    .eq('subject_id', classId)
    .eq('type', 'class_cancelled')
  expect(logs?.length).toBeGreaterThanOrEqual(1)
  expect(logs![0].description).toContain('cancelled')
  expect(logs![0].description).toContain(title)
})
```

### Scenario 2 — P0 activity log explicit proof

```ts
test('activity_log class_cancelled has non-null description and correct metadata @p0', async ({ page }) => {
  const title = uniqueTitle('CancelLog')
  const { classId } = await seedClass({
    title,
    classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    startsAt: tomorrowAt(18, 0),
    endsAt: tomorrowAt(19, 0),
  })

  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openClassPanel(title)
  await schedule.cancelClassFromPanel(true)

  const { data: logs } = await testDb
    .from('activity_log')
    .select('type, description, subject_type, metadata')
    .eq('subject_id', classId)

  expect(logs?.length).toBeGreaterThanOrEqual(1)
  const log = logs!.find((l) => l.type === 'class_cancelled')
  expect(log).toBeTruthy()
  expect(log!.description).toBeTruthy()
  expect(log!.description).toContain('Class cancelled')
  expect(log!.description).toContain(title)
  expect(log!.subject_type).toBe('class')
  // Metadata records the status update
  expect((log!.metadata as Record<string, unknown>).status).toBe('cancelled')
})
```

### Scenario 3 — P0 cancel with active bookings

```ts
test('cancels a class with confirmed bookings (PUT not DELETE) @p0', async ({ page }) => {
  const title = uniqueTitle('CancelWithBookings')
  const { classId } = await seedClass({
    title,
    classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    startsAt: tomorrowAt(19, 0),
    endsAt: tomorrowAt(20, 0),
    capacity: 12,
  })

  // Seed 2 members + 2 bookings on the class
  const m1 = await seedMember({ studioId: DEFAULT_STUDIO_ID })
  const m2 = await seedMember({ studioId: DEFAULT_STUDIO_ID })
  for (const member of [m1, m2]) {
    await testDb.from('bookings').insert({
      id: randomUUID(),
      studio_id: DEFAULT_STUDIO_ID,
      class_id: classId,
      member_id: member.profileId,
      status: 'confirmed',
      source: 'admin',
      created_at: new Date().toISOString(),
    })
  }

  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openClassPanel(title)
  await schedule.cancelClassFromPanel(true)

  // Panel closes cleanly (no 409 error)
  await expect(schedule.classDetailPanel()).toBeHidden({ timeout: 10_000 })

  // DB: class cancelled
  const { data: cls } = await testDb
    .from('classes')
    .select('status')
    .eq('id', classId)
    .single()
  expect(cls?.status).toBe('cancelled')

  // DB: bookings STILL EXIST (not deleted — preserving historical record)
  const { data: bookings } = await testDb
    .from('bookings')
    .select('id, status')
    .eq('class_id', classId)
  expect(bookings?.length).toBe(2)
  // Bookings' statuses untouched (they're still 'confirmed' — booking
  // cancellation is a separate flow handled by member-facing tiers)
  expect(bookings!.every((b) => b.status === 'confirmed')).toBe(true)
})
```

**Note:** If Scenario 3 fails with a 409 error, that proves the architect's choice of PUT (soft cancel) vs DELETE (hard delete) was correct — this test is specifically designed to catch a future regression where someone "fixes" cancel to use DELETE.

### Scenario 4 — P1 dismiss dialog

```ts
test('dismissing the confirm dialog leaves class scheduled @p1', async ({ page }) => {
  const title = uniqueTitle('CancelDismiss')
  const { classId } = await seedClass({
    title,
    classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    startsAt: tomorrowAt(14, 0),
    endsAt: tomorrowAt(15, 0),
  })

  const schedule = new SchedulePage(page)
  await schedule.goto('/schedule')
  await schedule.expectMounted()

  await schedule.openClassPanel(title)
  await schedule.cancelClassFromPanel(false)  // dismiss

  // Panel stays open
  await expect(schedule.classDetailPanel()).toBeVisible()

  // DB: no change
  const { data: cls } = await testDb
    .from('classes')
    .select('status')
    .eq('id', classId)
    .single()
  expect(cls?.status).toBe('scheduled')

  // DB: no log row
  const { data: logs } = await testDb
    .from('activity_log')
    .select('id')
    .eq('subject_id', classId)
    .eq('type', 'class_cancelled')
  expect(logs?.length ?? 0).toBe(0)
})
```

### Scenario 5 — P1 direct PUT with description field

```ts
test('PUT /api/classes/[id] description field remaps to notes column (L1 regression guard) @p1', async ({ page }) => {
  const title = uniqueTitle('L1Regression')
  const { classId } = await seedClass({
    title,
    classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    startsAt: tomorrowAt(10, 0),
    endsAt: tomorrowAt(11, 0),
  })

  // Navigate first to establish auth cookies for page.request
  await page.goto('/schedule')

  const res = await page.request.put(`/api/classes/${classId}`, {
    data: { description: 'updated notes via API' },
  })

  expect(res.ok()).toBe(true)

  const { data: cls } = await testDb
    .from('classes')
    .select('notes')
    .eq('id', classId)
    .single()
  // The description field was remapped to the notes column
  expect(cls?.notes).toBe('updated notes via API')
})
```

### Acceptance criteria for Step 5

- 5 tests, tagged `@p0` (1-3) or `@p1` (4-5)
- Scenarios use `seedClass` with stable class_type_id (Open Sauna)
- Scenario 3 seeds bookings via direct testDb insert
- Scenario 5 uses `page.request.put` after navigating to establish auth cookies
- All DB assertions scoped by `classId` (no shared state between tests)

---

## Risk register

| Risk | Mitigation |
|---|---|
| `schedule-class-tile` testid location is unclear; calendar uses complex grid rendering | Grep the file for where `cls.name` + `cls.time` are rendered together. If multiple matches, add testid to the innermost wrapper containing both. Verify by clicking the tile in dev mode and watching selectedClass update. |
| `onCancelClass` prop threading through panel interface causes TS errors | Add optional prop `onCancelClass?: () => void` first, then remove the optional marker once the parent wires it. Or require the prop if parent is updated in the same edit. |
| BUG-017 PUT rewrite breaks existing (untested) edit flows | The only current edit path is the ClassFormModal's edit mode, which sends body fields `{ class_type_id, start_time, end_time, capacity, trainer_id, title, description }` — `description` is now remapped to `notes`, so the edit flow's description persistence IMPROVES (it was broken before; now it works). No regression. |
| Scenario 3's booking seed requires a `source` field | The `bookings` table may require more columns than just the 4 listed. Check `information_schema.columns` for `bookings` if the insert fails. |
| PUT response regex in POM matches unintended URLs | Strict regex `/\/api\/classes\/[^/]+$/` only matches `/api/classes/<id>` exactly — doesn't match `/api/classes` (list) or `/api/classes/<id>/remind`. Safe. |
| Scenario 5's auth context | Playwright `page.request` uses the page's cookies. Navigating to `/schedule` first establishes auth state. Must happen before the request. |

---

## Handoff to Engineer

```
[ ] Step 1 — PUT + DELETE handler rewrite (BUG-017 L1, L3, L5)
[ ] Step 2 — Cancel button UI + 4 testid seeds (cancel, edit, tile, panel root)
[ ] Step 3 — SchedulePage POM Tier 3.9 section
[ ] Step 4 — (skip — no fixture changes needed)
[ ] Step 5 — schedule-cancel-class.spec.ts (5 tests)
```

**Standing directives:**

- Do NOT touch the existing Tier 3.8 classes POST handler (route.ts) — BUG-015 is already closed
- Do NOT change the `useClasses` hook to filter cancelled classes — deferred to a future UX tier
- Do NOT add status='cancelled' to the ClassFormModal — that's a separate edit-status feature
- After the 5 Engineer steps, run the 5-test spec in isolation before the full regression

**Tier counter:** This is Tier 3.9. Tier 3 counter advances to **9/12** on completion.
