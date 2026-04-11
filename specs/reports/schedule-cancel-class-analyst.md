# Tier 3.9 — Schedule: Cancel Class — Analyst Report

**Run date:** 2026-04-10
**Phase:** 1 (Analyst)
**Status:** 🔴 Missing UI + multi-layer API bug — BUG-008 GAP-4 + new BUG-017 filed

---

## Feature scope

Admin cancels a scheduled class from the schedule page. The cancelled class preserves its DB row (soft cancel via status update), is logged in activity_log with `type='class_cancelled'`, and disappears from its own attendees' upcoming-class views (future tiers). The existing bookings on the class are NOT auto-cancelled by this tier — that's a separate decision (member-facing tier or a trigger).

Business context: per CLAUDE.md's edge-case policies, cancelled classes are a retention risk — the studio owner needs to easily cancel a class (e.g., trainer illness, facility issue) without permanently losing the historical record. The cancellation should propagate to member-facing surfaces so attendees know the class is no longer happening.

---

## State on entry

### Backend (partial)

- `classes.status` column exists (NOT NULL, default `'scheduled'`, CHECK enum: `['scheduled', 'in_progress', 'completed', 'cancelled']`)
- `PUT /api/classes/[id]` accepts `status` in allowedFields — can transition to `'cancelled'`
- `DELETE /api/classes/[id]` exists (hard delete) — returns 409 if active bookings exist. NOT the right semantic for "cancel" because it loses history and blocks the operation when members are attending.
- `activity_log.type` enum includes `class_cancelled` (added by Tier 3.8 migration)
- RLS policy `classes_update` — studio-scoped, NO role restriction (BUG-016 L7 — out of Tier 3.9 scope, just noting)

### UI (absent)

- **NO Cancel button exists on the ClassDetailPanel.** Current buttons: Check In All, Send Reminder, Edit Class. Nothing for cancellation.
- **NO status='cancelled' handling on the schedule calendar.** The `useClasses` hook does not filter by status, so cancelled classes would remain visible on the calendar after a cancellation with no visual differentiation.
- **ClassFormModal does NOT expose `status` as an editable field.** The Edit flow can't transition status.

This is **BUG-008 GAP-4** ("Schedule Cancel Class UI PARTIAL (API exists)") — already filed in the Phase 1 completeness audit, not closed.

### Fixture support

- `seedClass(opts)` already exists in `db.ts` (lines 270–297) — can seed a class with `title: 'E2E Test ...'` for cleanup matching
- `resetStudioTestData` cleans classes by `title LIKE 'E2E Test%'` AND cleans activity_log rows with `type LIKE 'class_%'` (added in Tier 3.8 step 5c)

### POM support

- `SchedulePage` has Tier 2.2 smoke methods + Tier 3.8 Create Class section (13 locators + 5 helpers)
- NO existing helpers for opening the ClassDetailPanel or targeting cancelled classes

---

## Probe results

### Probe 1 — `information_schema.columns` for `classes`

Same 21 columns as Tier 3.8 probe. Key points:

- `status` is NOT NULL with default `'scheduled'`, type `text`
- `updated_at` is NOT NULL with default `now()` — the PUT handler sets this explicitly
- No `description` column — **BUG-017 L1 confirmed** (same phantom column as Tier 3.8 POST had)

### Probe 2 — `pg_constraint` for CHECK constraints

```sql
classes_status_check:
CHECK (status = ANY (ARRAY['scheduled', 'in_progress', 'completed', 'cancelled']))

activity_log_type_check:
(...18 original values + class_created, class_updated, class_cancelled, class_deleted)
```

`'cancelled'` is a valid `status` value. `class_cancelled` is in the activity_log enum (added by Tier 3.8). **Zero new migrations needed for Tier 3.9.**

### Probe 3 — `pg_policies` for `classes`

Same as Tier 3.8 — three RLS findings documented in BUG-016:
- L6: `classes_write` precedence bug (not in Tier 3.9 path — we use UPDATE)
- **L7: `classes_update` has no role restriction — relevant to Tier 3.9**
- L8: `class_types_studio_write` (not in Tier 3.9 path)

L7 means: the `classes_update` RLS policy `USING (studio_id = get_user_studio_id())` allows **any authenticated studio user**, including regular members, to UPDATE any class. In practice, this is mitigated by the app-layer handler role check (which is MISSING — BUG-017 L5). If the Tier 3.9 fix adds a role check to the PUT handler, app-layer scoping returns, and L7 becomes a defense-in-depth failure only (not an exploitable one).

### Probe 4 — `/api/classes/[id]` route handler review

Three handlers in `apps/web/src/app/api/classes/[id]/route.ts`:

**GET** — role check ✓, fetch ✓, booking count ✓. No issues.

**PUT** (lines 88–233) — **multi-layer divergence (BUG-017)**:

| L | Description | Severity |
|---|---|---|
| **L1** | `allowedFields` includes `"description"` (line 125). The body's `description` field flows through to the UPDATE. `classes.description` doesn't exist — phantom column. Every edit that sends a non-empty description 500s. | Blocking (edit path) |
| **L3** | activity_log insert at line 216 omits `description` (NOT NULL). Silent swallow — log row never lands. | Silent |
| **L5** | No role check. Falls through to RLS which returns generic 500 instead of clean 403. | UX |

PUT also has:
- `allowedFields` remap for `start_time → starts_at`, `end_time → ends_at` ✓ correct
- Validation for dates ✓ correct
- 404 on zero-row update ✓ correct (added by BUG-012 Healer in Tier 3.6 pattern... wait, actually this is pre-existing, see the `if (!updated) return 404`)
- Silent-swallow activity_log insert ⚠️

**DELETE** (lines 239–314) — **BUG-017 DELETE subset**:

| L | Description | Severity |
|---|---|---|
| **L3** | activity_log insert at line 297 omits `description` (NOT NULL). Silent swallow. | Silent |
| **L5** | No role check. Falls through to RLS. | UX |

DELETE has the 409-if-bookings guard at line 269-281 which is correct behavior for hard delete.

### Probe 5 — `useClasses` hook status filter

`apps/web/src/hooks/use-supabase.ts:170-190`:

```ts
export function useClasses(dateRange?: ...) {
  const filters = [
    { column: 'studio_id', operator: 'eq', value: DEFAULT_STUDIO_ID },
  ]
  if (dateRange) {
    filters.push(
      { column: 'starts_at', operator: 'gte', value: dateRange.from },
      { column: 'starts_at', operator: 'lte', value: dateRange.to },
    )
  }
  return useQuery('classes', { select: '*, ...', filters, orderBy: ..., poll: true })
}
```

**No status filter.** Cancelled classes WILL remain visible on the schedule calendar after cancellation. This is a UX gap that the Architect must decide whether to address in this tier or defer.

### Probe 6 — Panel-button ID trace (standing checklist item)

The ClassDetailPanel receives `selectedClass` as a prop (type `ClassBlock`). The `selectedClass.id` is traced through to:

1. Edit button: `onEditClass()` → `rawClasses.find(c => c.id === selectedClass.id)` → populates EditClassData.id → ClassFormModal uses `editData.id` → PUT `/api/classes/${editData.id}` ✓ correct
2. (New) Cancel button: will receive `selectedClass.id` → PUT `/api/classes/${selectedClass.id}` with `{ status: 'cancelled' }` — **ID chain is clean** since `selectedClass.id` is `classes.id` (the PK, not a foreign key)

No BUG-013-style divergence. The schedule subsystem uses `classes.id` end-to-end; there's no equivalent to the `members.id` vs `profile_id` split.

---

## BUG-017 — `/api/classes/[id]` PUT + DELETE handler divergence

### Scope

Mirrors BUG-015 (which fixed the POST handler in Tier 3.8). This is the PUT and DELETE counterpart. All three class handlers had the same silent-swallow + phantom column pattern; Tier 3.8 fixed POST, Tier 3.9 fixes PUT and DELETE in the same rewrite.

### Layers

**PUT-specific:**
- **L1** — `allowedFields` includes `"description"` which maps to a phantom column. Must either (a) remove `description` from `allowedFields` entirely, or (b) remap to `notes` after the initial allowlist extraction (mirror of the remap pattern for `start_time → starts_at`).
- **L3** — activity_log insert omits `description`.
- **L5** — no role check.

**DELETE-specific:**
- **L3** — activity_log insert omits `description`.
- **L5** — no role check.

### Fix plan

In `apps/web/src/app/api/classes/[id]/route.ts`:

**PUT handler:**
1. Add role check (owner/manager) after profile fetch.
2. Remove `"description"` from `allowedFields` and instead remap: `if (body.description !== undefined) updates.notes = body.description`. Same pattern as `start_time → starts_at`.
3. Extend activity_log insert with `description: \`Class updated: ${updated.title ?? '(untitled)'}\``. Capture `{ error: activityError }` and `console.error` on failure.

**DELETE handler:**
1. Add role check (owner/manager) after profile fetch.
2. Fetch `existingClass` before the delete (for the activity_log description).
3. Extend activity_log insert with `description: \`Class deleted: ${existingClass.title ?? '(untitled)'}\``. Capture `{ error: activityError }` and `console.error` on failure.
4. (Optional) The 409-if-bookings check stays.

This is ~40 lines of diff across one file. Both handlers fixed in one Engineer step.

---

## Cancel UI — inline build scope

### Decision: use PUT status='cancelled' (soft cancel), not DELETE

Rationale:

- Preserves the historical record (bookings, attendance data)
- Avoids the 409 "can't delete if bookings exist" guard — which would block the admin from cancelling exactly the classes they most need to cancel
- Matches the semantic of "cancel" vs "delete" in common usage
- The `cancelled` status is already in the CHECK enum, no migration needed
- The activity_log `class_cancelled` type is already in the enum (Tier 3.8 migration)

### UI placement

Add a new **Cancel Class** button to the ClassDetailPanel (`schedule/page.tsx:349-490`). Place it below the Edit Class button with visual treatment matching "destructive" actions (red outline, red text) — same pattern as the Archive button on the MemberProfilePanel (Tier 3.7).

### Button flow

```tsx
<button
  data-testid="schedule-cancel-class-btn"
  onClick={async () => {
    if (!confirm('Cancel this class? Attendees will need to be notified separately.')) return
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (res.ok) {
        onClose()
        showToast('Class cancelled')
      } else {
        showToast('Failed to cancel class')
      }
    } catch {
      showToast('Network error')
    }
  }}
>
  Cancel Class
</button>
```

The button uses the existing browser `confirm()` dialog (matches Tier 3.7 Archive pattern). The Playwright POM will handle `confirm()` via `page.once('dialog', ...)` (same pattern as `archiveMemberFromPanel`).

### Calendar rendering decision: DEFER

The cancelled class will remain visible on the calendar after cancellation (because `useClasses` doesn't filter status). For Tier 3.9, this is acceptable as a documented UX gap. A future tier can add either:

- A status filter to `useClasses` (`.neq('status', 'cancelled')`) — simplest
- Visual strikethrough on cancelled classes — more informative

Neither is blocking Tier 3.9's test suite. The tests assert DB state and activity_log state — they do NOT assert calendar rendering of cancelled classes.

### Toast

The tier inherits the existing `showToast('Class cancelled')` pattern. The ToastNotification component already supports this (it's a shared component from Tier 0).

---

## Test scenarios (5 total — 3 P0, 2 P1)

### Scenario 1 — P0 — Happy path: cancel a class with no bookings

**Proves:** PUT status='cancelled' flow, BUG-017 PUT L3+L5 fixes (via side-effects on activity_log), panel closes.

```
GIVEN a seeded class in the test studio with status='scheduled' and no bookings
WHEN admin navigates to /schedule, clicks the class, clicks Cancel Class, confirms
THEN the panel closes (selectedClass becomes null)
AND a toast 'Class cancelled' is shown
AND DB: classes.status = 'cancelled' for that class id
AND DB: activity_log row with type='class_cancelled' exists with non-null description containing 'cancelled' + class title
```

### Scenario 2 — P0 — Activity log explicit proof (L3 + L4 for the new type)

**Proves:** BUG-017 L3 (PUT description non-null) explicitly, validates the `class_cancelled` enum value works end-to-end.

```
GIVEN a seeded class is cancelled via the UI
WHEN we query activity_log for type='class_cancelled', subject_id=<class.id>
THEN exactly one row exists
AND row.description is NOT NULL and contains 'cancelled'
AND row.description contains the class title
AND row.type = 'class_cancelled'
AND row.subject_type = 'class'
AND row.metadata contains status update information
```

### Scenario 3 — P0 — Cancel with active bookings succeeds (PUT, not DELETE)

**Proves:** the feature uses PUT (not DELETE), so active bookings do NOT block the cancellation.

```
GIVEN a seeded class with 2 confirmed bookings
WHEN admin cancels the class
THEN the cancellation succeeds (no 409 error)
AND DB: classes.status = 'cancelled'
AND DB: bookings for the class are NOT deleted (count unchanged)
AND DB: activity_log has the class_cancelled entry
```

This test specifically proves that the architect chose PUT over DELETE — if someone "fixes" it to use DELETE, this test fails on the 409.

### Scenario 4 — P1 — Dismissing confirm() dialog leaves class scheduled

**Proves:** the cancel flow respects the user dismissing the confirmation.

```
GIVEN admin opens the class panel
WHEN admin clicks Cancel Class, then dismisses the browser confirm() dialog
THEN the panel stays open
AND DB: classes.status is still 'scheduled' (unchanged)
AND DB: no class_cancelled activity_log row was inserted
```

### Scenario 5 — P1 — PUT handler rejects description field if provided (L1 regression)

**Proves:** the L1 fix works — either `description` is rejected from allowedFields OR it's remapped to `notes`. Either way, no 500 on phantom column.

```
GIVEN a seeded class
WHEN a direct PUT request is sent via page.request.put('/api/classes/[id]', {...})
  with body { description: 'updated notes via API' }
THEN the request returns 200 (not 500)
AND DB: the class's notes column contains 'updated notes via API'
  OR the description field was silently ignored and notes is unchanged
```

**Note:** The test should accept either behavior — remap OR reject — depending on the architect's choice. The assertion uses a conditional: `expect(res.ok).toBe(true); expect(cls.notes === 'updated...' || cls.notes === originalNotes).toBeTruthy()`. The test's primary goal is: **PUT does not 500 on a description field**.

---

## Testids to seed

| ID | Location | Role |
|---|---|---|
| `schedule-cancel-class-btn` | ClassDetailPanel (new button) | Opens confirm() dialog then PUTs |

Only 1 new testid. The existing Edit Class button should also get a testid for completeness (`schedule-edit-class-btn`) — that's a cheap add in the same edit.

Optional: also seed `schedule-class-detail-panel` on the panel's root div so the POM can assert panel visibility. The panel currently has no container testid.

---

## POM extension

New section `// ─── Tier 3.9: Cancel Class ───` in `SchedulePage.ts`. Add:

**Locators:**
- `classDetailPanel()` — returns `this.byTestId('schedule-class-detail-panel')`
- `cancelClassBtn()` — returns `this.byTestId('schedule-cancel-class-btn')`

**Helpers:**
- `openClassPanel(classTitle: string)` — clicks a class block on the calendar by title. Internally: `this.page.locator('[data-testid="schedule-class-tile"]').filter({ hasText: classTitle }).first().click()` + waits for panel to be visible. Note: `schedule-class-tile` already exists from Tier 2.2 smoke (verify by grep; may need to seed).
- `cancelClassFromPanel(accept: boolean)` — one-shot dialog handler + click Cancel button + wait for PUT response. Mirrors `archiveMemberFromPanel` from Tier 3.7.
  - When `accept=true`, wait for `PUT /api/classes/` response (30s timeout, canonical waitForResponse pattern).
  - When `accept=false`, dismiss the dialog, no network wait.

---

## Fixture work

### seedClass

Already exists. One extension for Tier 3.9: take a `bookedMemberIds` option to also seed N bookings on the class for Scenario 3. Alternatively, scenario 3 can manually seed bookings after seedClass returns — cleaner separation.

Prefer: scenario 3 manually seeds two members + two bookings after seedClass. No need to modify the helper.

### resetStudioTestData

Already cleans classes by title prefix + activity_log by `type LIKE 'class_%'`. Covers Tier 3.9 exactly. No changes needed.

---

## Migrations

**Zero migrations.** The enum extension from Tier 3.8 already added `class_cancelled` (along with `class_created`, `class_updated`, `class_deleted`). The `classes.status` CHECK already has `'cancelled'`. Everything needed is in place.

---

## Handoff to Architect

- **BUG-017 scope is LARGE:** 5 layers across 2 handlers (PUT L1/L3/L5 + DELETE L3/L5) in one rewrite. This is comparable in size to Tier 3.8's POST rewrite.
- **UI build is MEDIUM:** 1 new button in ClassDetailPanel, 1 new testid, 1 confirm dialog, 1 toast call. Mirrors Tier 3.7's Archive button pattern closely.
- **POM extension is SMALL:** 2 new locators + 2 new helpers. The `openClassPanel` helper is new territory (first time clicking a class tile), but the pattern is familiar.
- **Test spec is 5 scenarios, medium complexity.** Scenario 3 requires seeding bookings which adds a db.ts step; Scenario 5 uses direct API request (same pattern as Tier 3.5 Scenario 8 `page.request.post`).

**Estimated complexity:** Medium-high, comparable to Tier 3.8 (8/12 complexity on a 10-point scale). The BUG-017 rewrite is the meaty part; the UI work is cheap.

**Risks:**

1. **The PUT handler's allowedFields + remap pattern** — architect must decide between removing `description` from allowedFields entirely vs remapping to `notes`. Removing is cleaner but changes the API contract (API consumers sending `description` get a silent ignore). Remapping to `notes` is backward-compatible. Recommend remap.
2. **Scenario 3 booking seeding** — requires a fresh approach since `seedClass` doesn't include bookings. The test will need to seed a profile, a member, and then a booking row. Four inserts in sequence. Use `seedMember` + direct `testDb.from('bookings').insert(...)`.
3. **The existing `schedule-class-tile` testid** — must verify it's seeded on the calendar tile. If not, the POM's `openClassPanel` needs a different locator strategy.
4. **`classDetailPanel` visibility assertion** — the panel uses `AnimatePresence mode="wait"` with `initial` + `exit` animations. The ANIM_TIMEOUT should cover the 250ms transition, but verify in the first test run.

**Out-of-tier:**

- BUG-016 L7 (`classes_update` RLS no role restriction) — fixed in practice once L5 is fixed at app layer. Defense-in-depth failure only. Leave the RLS migration for Tier 3.10 or a dedicated security tier.
- Calendar rendering of cancelled classes — defer, documented as UX gap.
- Auto-cancellation of bookings when a class is cancelled — separate feature, not in Tier 3 scope.
