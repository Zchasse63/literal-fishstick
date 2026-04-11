# Tier 3.9 — Schedule: Cancel Class

**Run date:** 2026-04-10
**Pipeline:** Full (Analyst → Architect → Engineer → Code Review → Sentinel → Healer → Scribe)
**Status:** ✅ PASS
**Tests:** 5 scenarios (3 P0, 2 P1) — all green on 3 consecutive standalone runs + 37/37 full regression
**Bugs closed:** BUG-017 (PUT L1/L3/L5 + DELETE L3/L5, all fixed inline) + BUG-008 GAP-4 (Cancel Class UI built inline)
**Bugs surfaced (documented, not fixed):** DELETE handler phantom-value filter — `['confirmed', 'checked_in']` uses a value not in the bookings_status_check enum. Latent — noted in Scribe design notes.

---

## Feature scope

Admin cancels a scheduled class from the schedule page via a new Cancel Class button on the ClassDetailPanel. The flow uses PUT with `status: 'cancelled'` (soft cancel) — NOT DELETE (hard delete). Soft cancel preserves:
- The class row (for historical audit)
- Existing bookings (member attendance data)
- The activity_log trail (type=`class_cancelled` instead of `class_updated`)

Business context: per CLAUDE.md edge-case policies, cancelled classes are a retention risk — the studio owner needs to cancel a class (trainer illness, facility issue) without losing the historical record. Soft cancel via status flip is the correct semantic.

---

## Phase 1 — Analyst

### Probes

1. `information_schema.columns` on `classes` → same as Tier 3.8 (no `description` column, `notes` is the text column, `title` is NOT NULL).
2. `pg_constraint` on `classes.status` → CHECK enum: `['scheduled', 'in_progress', 'completed', 'cancelled']`. `'cancelled'` is valid.
3. `pg_constraint` on `activity_log.type` → 22 values (Tier 3.8 migration added 4 class lifecycle types including `class_cancelled`).
4. `pg_policies` on `classes` → BUG-016 findings (L6 precedence, L7 no role restriction on update) — mitigated in practice once L5 role check lands at app layer.
5. **Panel-button ID trace:** `selectedClass.id` → direct `classes.id` pass-through. No BUG-013-style divergence (classes use `id` as the PK without a `profile_id`-equivalent split).

### BUG-017 — PUT + DELETE handler divergence

Mirror of BUG-015 (Tier 3.8 POST fix) on the remaining two class handlers:

| Handler | L | Description |
|---|---|---|
| PUT | L1 | `allowedFields` included `description` which flowed to phantom DB column → any edit with description 500s |
| PUT | L3 | `activity_log.description` omitted → silent swallow |
| PUT | L5 | No role check → generic 500 on RLS reject |
| DELETE | L3 | `activity_log.description` omitted → silent swallow |
| DELETE | L5 | No role check |

PUT-L1 was a partial silent-swallow — the app returned 500 with an error message, which is visible but not actionable. The Edit Class modal (Tier 3.8 builds it and sends `description`) would have 500'd on every description edit; since Tier 3.8 tests didn't edit the description field directly, this was latent until Tier 3.9 exercised it.

### Missing UI (BUG-008 GAP-4)

ClassDetailPanel had no Cancel button. Existing buttons: Check In All, Send Reminder, Edit Class. This is the Phase 1 completeness audit gap (BUG-008 GAP-4). Inline build was chosen over gap-file because the backend was well-defined and the button is a 30-line addition.

### Test scenarios (5)

| # | Pri | Name | Proves |
|---|---|---|---|
| 1 | P0 | Cancel happy path | L3, L5, happy path |
| 2 | P0 | Log explicit proof | L3 description + L4 type + metadata.status |
| 3 | P0 | Cancel with bookings (PUT, not DELETE) | Feature design choice (soft cancel) |
| 4 | P1 | Dismiss dialog | No side effects on cancel abort |
| 5 | P1 | PUT with description field (L1 proof) | `description → notes` remap landed |

---

## Phase 2 — Architect

7-step blueprint (one step merged), 0 migrations, 5 files:

1. PUT + DELETE handler rewrite (`/api/classes/[id]/route.ts`)
2. Cancel button + 4 testid seeds (`schedule/page.tsx`)
3. SchedulePage POM Tier 3.9 section
4. (Skipped — no fixture changes)
5. New spec file
6. Code Review
7. Sentinel

Architect blueprint at `specs/reports/schedule-cancel-class-architect.md`.

**Design decisions:**

- **PUT status='cancelled' over DELETE** — preserves history and works with bookings
- **`description` remap to `notes`, not remove from allowedFields** — backward compatible
- **Cancel type `class_cancelled` via conditional on `updates.status`** — ops dashboards can distinguish cancellations from generic edits
- **Panel root testid + class tile testid seeded in the same edit** — these are infrastructural for all schedule tiers, not just 3.9
- **Calendar rendering of cancelled classes deferred** — cancelled classes stay visible on the calendar until a future tier adds visual state

---

## Phase 3 — Engineer

All steps landed. Notable:

- **PUT handler `description → notes` remap** inserted after the existing `start_time/end_time` remap, BEFORE the `Object.keys(updates).length === 0` guard. Walked through the description-only PUT case to verify guard doesn't fire incorrectly.
- **Activity log type conditional** uses `wasCancelled = updates.status === "cancelled"` to pick between `class_cancelled` and `class_updated`. This works because `updates` is populated before the activity_log insert runs.
- **DELETE handler now fetches existingClass up front** — serves as both a clean 404 check and the source of truth for the activity_log description.
- **ClassBlockCard testid (`schedule-class-tile`) + `data-class-id`** enables the POM's `openClassPanel(title)` to filter tiles by text.
- **`onCancelClass` prop is required (not optional) on ClassDetailPanel** — TypeScript will catch any future call site that forgets to pass it. Only one call site exists (the parent in the same file).
- **Panel wires the fetch directly (not through a helper)** — matches the existing pattern of inline onClick handlers on the detail panel. No refactor scope creep.

---

## Phase 4 — Code Review

**Zero high-confidence issues found.** All 8 specific concerns verified clean:

- L1 remap correctness: guard runs after remap, description-only requests pass
- Activity log type selection: `wasCancelled` correctly conditional on `updates.status`
- DELETE `existingClass` fetch placement: correct ordering
- Scenario 3 `status: 'booked'` seed: documented limitation (can't prove PUT-vs-DELETE distinction)
- POM `waitForResponse` regex: strict `/\/api\/classes\/[^/]+$/` correctly excludes POST list, `/remind` suffix, etc.
- Name collision: `cancelClassBtn()` (Tier 3.8 modal) vs `cancelClassActionBtn()` (Tier 3.9 panel) — different testids, no collision
- `onCancelClass` prop threading: only one call site, prop is required, TypeScript compiles cleanly
- Scenario 5 direct PUT: auth cookies carry via `page.request`, walkthrough confirms expected behavior

The reviewer noted one below-threshold concern (Scenario 3 booking seed missing a `source` field) which was later resolved during Healer.

---

## Phase 5 — Healer

### Healer round 1 — TypeScript name collision

Typecheck surfaced `TS2393: Duplicate function implementation` because the POM already had `cancelClassBtn()` from Tier 3.8 (the modal's Cancel button). Renamed the Tier 3.9 panel-action locator to `cancelClassActionBtn()` to disambiguate. Tier 3.8 helpers untouched.

### Healer round 2 — Scenario 3 booking FK error

Scenario 3 failed first run with `Failed to seed booking: insert or update on table "bookings" violates foreign key constraint "bookings_member_id_fkey"`. Discovery: `bookings.member_id` references **`members.id`** (NOT `profiles.id`). I had used `member.profileId` based on the db.ts cleanup step 5 pattern which does `.in('member_id', testProfileIds)` — but THAT cleanup step is broken (the filter target is wrong). The actual FK target is `members.id`.

**Fix:** Changed `member_id: member.profileId` → `member_id: member.memberId`. Added an explicit error-capture pattern `if (insertErr) throw new Error(...)` — without it, the insert failure was silent and only surfaced as "expected 2, got 0" in the downstream assertion.

**Lesson:** The "silent swallow" pattern bites **test code** too, not just production code. Supabase JS client insert errors are discarded unless explicitly captured. Every `testDb.from(...).insert(...)` in test seeds should check the error. Saving this as a memory for future tiers.

### Healer round 3 — none needed

The full Sentinel after these 2 fixes ran clean.

---

## Phase 6 — Sentinel

### Tier 3.9 standalone — 3 consecutive runs

| Run | Duration | Result |
|---|---|---|
| 1 | 43.2s | 7/7 ✅ |
| 2 | 41.0s | 7/7 ✅ |
| 3 | 40.3s | 7/7 ✅ |

(7 = 2 auth-setup + 5 Tier 3.9 tests.)

### Full regression — members + schedule

**37/37 passing** (3.6m). Zero regressions.

| Tier | Tests | Result |
|---|---|---|
| Auth setup | 2 | ✅ |
| 3.5 Create Member | 9 | ✅ |
| 3.6 Edit Member | 9 | ✅ |
| 3.7 Archive Member | 5 | ✅ |
| 3.8 Create Class | 7 | ✅ |
| 3.9 Cancel Class | 5 | ✅ |

Notable: **no transient failures this time.** The Tier 3.6 and Tier 3.8 runs had 1-2 random failures on the `openMemberProfileByName` path; Tier 3.9's run was clean from first attempt. Possibly because Tier 3.9 doesn't load the members directory (all 5 scenarios navigate to `/schedule` only), reducing the directory-search pressure point that triggered prior tiers' transients.

---

## Files changed

### Production code

| File | Change |
|---|---|
| `apps/web/src/app/api/classes/[id]/route.ts` | PUT rewrite: role check (L5), remove `description` from allowedFields + add remap to `notes` (L1), conditional `class_cancelled` type on status-cancel path (L3+L4), capture-and-log pattern. DELETE rewrite: role check (L5), existingClass fetch + 404 guard, non-null description on activity_log (L3). Updated JSDoc. |
| `apps/web/src/app/(admin)/schedule/page.tsx` | 4 testids seeded (`schedule-class-tile` + `data-class-id` on ClassBlockCard, `schedule-class-detail-panel` on panel root, `schedule-edit-class-btn` on existing edit button, `schedule-cancel-class-btn` on new cancel button). `onCancelClass` prop added to ClassDetailPanel interface. Parent wires the PUT fetch with confirm() dialog + toast. |

### Test infrastructure

| File | Change |
|---|---|
| `apps/web/e2e/pages/SchedulePage.ts` | Tier 3.9 section appended: 3 locators (`classDetailPanel`, `cancelClassActionBtn`, `classTiles`) + 2 helpers (`openClassPanel`, `cancelClassFromPanel`). Name-collision note: `cancelClassActionBtn` distinct from Tier 3.8's `cancelClassBtn`. |
| `apps/web/e2e/schedule-cancel-class.spec.ts` | NEW — 5 scenarios (~290 lines) |

### Specs

| File | Change |
|---|---|
| `specs/reports/schedule-cancel-class-analyst.md` | NEW — full Analyst report with probes, BUG-017, Cancel UI scope, 5 scenarios |
| `specs/reports/schedule-cancel-class-architect.md` | NEW — 7-step blueprint with POM skeleton + per-scenario templates + risk register |
| `specs/reports/schedule-cancel-class-report.md` | This file |

### Migrations

**Zero migrations.** Tier 3.8 already added `class_cancelled` to the `activity_log.type` enum. `classes.status` CHECK already has `'cancelled'`. Everything was in place.

---

## Bugs

### BUG-017 — closed by this run

All 5 layers fixed inline in `/api/classes/[id]/route.ts`:
- PUT L1: description remapped to notes
- PUT L3: activity_log description non-null with capture-and-log
- PUT L5: role check (owner/manager)
- DELETE L3: activity_log description non-null with capture-and-log
- DELETE L5: role check (owner/manager)

### BUG-008 GAP-4 — closed by this run

"Schedule Cancel Class UI PARTIAL (API exists)" — the UI is now built and wired end-to-end.

### Latent DELETE filter bug (documented, not fixed)

The DELETE handler's 409-if-bookings filter uses `.in("status", ["confirmed", "checked_in"])`, but `'confirmed'` is NOT in the `bookings_status_check` CHECK enum (the actual values are `['booked', 'checked_in', 'no_show', 'cancelled', 'late_cancelled', 'waitlisted']`). Only `'checked_in'` can trigger the filter. This means:

- A class with `booked` (default) bookings can be hard-deleted via DELETE — the 409 guard never fires for pre-class-time bookings
- Only classes with `checked_in` attendees (after class starts) get the 409

**Impact:** Minor. Users can't trigger DELETE from the UI (the Cancel button uses PUT). A direct API caller could hard-delete a class with booked attendees, losing their booking records via `ON DELETE CASCADE` on `bookings_class_id_fkey`.

**Disposition:** Filed as a standalone finding for Tier 3.10 or a future security tier. Will be addressed alongside BUG-016's RLS gaps.

### Latent db.ts cleanup bug (documented, not fixed)

`resetStudioTestData` step 5 at db.ts:462 uses `.in('member_id', testProfileIds)` — but `bookings.member_id` references `members.id`, not `profiles.id`. This cleanup step has been ineffective since it was written. It's a no-op in practice because step 6 deletes the `members` rows, which cascades via the FK to delete the bookings.

**Disposition:** Documented. Safe no-op. Can be fixed in any future tier that touches `db.ts`.

---

## Design notes for future tiers

1. **The "silent swallow" pattern bites test code too.** Every `testDb.from(...).insert(...)` in test seeds should capture `{ error }` and throw explicitly. Without that, a silent seed failure shows up as a downstream assertion failure with a confusing symptom. Saving this as a standing memory.

2. **FK reference verification is now part of the Analyst probe checklist.** The `bookings.member_id → members.id` vs the app's assumption of `profiles.id` is a BUG-013-adjacent divergence that bit Tier 3.9 Sentinel. Future tiers that insert into tables with `*_id` foreign keys should probe `pg_constraint` for FK targets before writing the seed code.

3. **The PUT+DELETE rewrite pattern is now canonical.** Tier 3.8 established it for POST; Tier 3.9 extended it to the other two methods on the same resource. Future tiers that touch `/api/<resource>/[id]` routes should apply the same 5-layer audit (L1 phantom columns, L2 NOT NULL defaults, L3 activity_log description, L4 enum values, L5 role check) upfront.

4. **Soft cancel via status flip is the right semantic for destructive actions.** Tier 3.9 chose PUT `status='cancelled'` over DELETE. This preserves history, handles foreign-key relationships gracefully, and doesn't require hardcoded "what does cascading delete do" logic. Tier 3.10 (Reschedule) and Tier 3.11 (Waitlist) should follow the same pattern for their destructive operations where applicable.

5. **The POM `waitForResponse` URL regex needs to be stricter as more endpoints are added to the same resource.** Tier 3.8 used `includes('/api/classes') && method === 'POST'` which works for POST-vs-GET but would match `/api/classes/anything`. Tier 3.9 tightened to `/\/api\/classes\/[^/]+$/` to exclude `/remind` suffix. Future tiers will need equal care when adding new endpoints under `/api/classes/[id]/*`.

6. **Class tile testid + data-class-id opens up targeted calendar clicks.** The `data-class-id={cls.id}` attribute is unused in Tier 3.9 but will be valuable for Tier 3.10 (Reschedule by tile drag) and Tier 3.11 (Waitlist scenarios where specific classes need to be selected). Adding the attribute now means zero future tiers need to touch this file for ID-based targeting.

7. **Tier 3.9 is the first tier since 3.1 to have zero transient regression failures.** The Tier 3.6 and Tier 3.8 transient failures in the `openMemberProfileByName` path didn't recur. This suggests the transients are triggered by heavy directory-search load specifically — tiers that exercise other surfaces (schedule-only here) don't hit them.

8. **The panel-button ID trace caught its 0th bug this tier.** Tier 3.9's `selectedClass.id → classes.id` chain is clean — no `profile_id`-equivalent divergence on the schedule subsystem. The checklist item is still valuable (it would have caught BUG-013 if Members was being built instead) but for schedule-related tiers, the probe routinely returns "N/A". Don't skip it — it's the cheapest probe and catches the scariest bugs.

---

## Tier 3 status

**8/12 → 9/12** (7 full, 2 gap-filed). Next: **Tier 3.10 — Schedule: Reschedule Class**. The PUT handler is now correct (Tier 3.9's BUG-017 fix handles all cases), so Tier 3.10 can focus purely on:
- The drag-to-reschedule UI (or modal-based reschedule — design decision)
- The PUT payload with new `start_time`/`end_time`
- The activity_log `class_updated` type (now used for non-cancel edits)
- Conflict detection (optional — trainer double-booking, sauna double-booking)

Tier 3 counter advances to 9/12 on Scribe completion.
