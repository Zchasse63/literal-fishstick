# Tier 3.8 — Schedule: Create Class

**Run date:** 2026-04-10
**Pipeline:** Full (Analyst → Architect → Engineer → Code Review → Healer → Sentinel → Scribe)
**Status:** ✅ PASS
**Tests:** 7 scenarios (4 P0, 3 P1) — all green on 3 consecutive flake-check runs + full regression round 2
**Bugs closed by this run:** BUG-015 (4 blocking layers + 1 sub-finding, all fixed inline)
**Bugs filed by this run:** BUG-016 (3 RLS sub-findings on `classes`/`class_types`, documented for future tiers)

---

## Feature scope

The schedule module's "Create Class" flow. Admin clicks "New Class" on `/schedule` → `ClassFormModal` opens → user selects class type, date, times, capacity, optional trainer/title/description → submits → POST `/api/classes` → row lands in `classes` + `activity_log`.

Business context: per CLAUDE.md, the Sauna Guys operates a **group-class booking model** where classes are hour-long time slots with a `class_type` (Open Sauna, Guided Session, Private Event). The default test studio has 3 active class_types seeded at DB init.

---

## Phase 1 — Analyst

### Probes: 4 mandatory Tier 3+ checks + panel-button ID trace (N/A)

1. `information_schema.columns` on `classes` → 21 columns, critical findings: `title` is NOT NULL with no default (BUG-015 L2), **no `description` column** (BUG-015 L1), `notes` is the actual text column.
2. `information_schema.columns` on `class_types` → `name` is NOT NULL with no default (allows L2 default to `class_type.name` to be safe).
3. `pg_constraint` for `activity_log.type` CHECK → 18 values present, `class_created` NOT in the enum (BUG-015 L4). Also: `classes_status_check` has 4 values (`scheduled`, `in_progress`, `completed`, `cancelled`).
4. `pg_policies` for `classes` + `class_types` → 3 RLS findings (L6–L8 sub-findings below).
5. Sample data from `classes` → 3 existing rows in the test studio, all with `notes: null` (notes column confirmed as the target for description text). `class_types`: 3 active rows (Open Sauna, Guided Session, Private Event).
6. Panel-button ID trace → N/A (pure create flow, no `${id}` in the button chain).

### BUG-015 — 4 blocking layers

| L | Description | Fix path |
|---|---|---|
| **L1** | POST handler writes phantom `description` column. Actual column is `notes`. Every create attempt 500s with "column description does not exist". | Map body's `description` → DB column `notes` |
| **L2** | `classes.title` is NOT NULL with no default. Modal sends `title: title \|\| null`. Handler passes null through. Any create with blank title → NOT NULL violation → 500. Modal label explicitly says "Title (optional)". | Handler defaults title to `class_type.name` when blank (Option A — matches existing data pattern) |
| **L3** | `activity_log.description` (NOT NULL) omitted from insert. Silent-swallow pattern — log row never lands, no user-visible error. | Add `description: \`Class created: ${classType.name}\``, capture `{ error }` with `console.error` |
| **L4** | `activity_log.type='class_created'` not in CHECK enum. Even with L3 fixed, insert still fails CHECK constraint → silent swallow. | Migration extending the enum with 4 new values: `class_created`, `class_updated`, `class_cancelled`, `class_deleted` (Tier 3.9–3.11 will consume the other three) |

**L1 is NOT a silent swallow** (the handler correctly captures `insertError` and returns 500 with the error message) — but it makes the feature totally non-functional. Users get a 500 error instead of a created class. L3 and L4 are both silent swallows because the activity_log insert's result was discarded.

### Sub-finding L5 — fixed in same tier for free

POST handler had no role check. GET handler at `route.ts:44-50` has one. Members trying to POST would fall through to RLS and get a generic 500 "Internal server error" instead of a clean 403. 4-line fix, mirrors GET.

### Sub-findings L6–L8 — filed as BUG-016, out of this tier's scope

**L6: `classes_write` RLS operator precedence bug**

```sql
WITH CHECK (
  ((studio_id = get_user_studio_id()) AND user_has_role('owner'))
  OR user_has_role('admin')
  OR user_has_role('manager')
)
```

Due to SQL operator precedence (AND binds tighter than OR), this parses as `(A AND B) OR C OR D` — meaning `admin`/`manager` roles can INSERT classes into ANY studio. Only the `owner` branch has the studio_id check. **Cross-tenant write vector.** Mitigated in practice because the test admin user is `['owner']` and the app layer uses `profile.studio_id` for the insert, but defense-in-depth failure.

**L7: `classes_update` RLS has no role restriction**

```sql
USING (studio_id = get_user_studio_id())
```

Any authenticated user in the studio (including regular members) can UPDATE any class. Out of Tier 3.8 scope. Will be exercised by Tier 3.10 (Reschedule Class).

**L8: `class_types_studio_write` has no role restriction**

```sql
WITH CHECK (studio_id = get_user_studio_id())
```

Any studio member can create class_types. Not blocking but unusual permissiveness. Not exercised by any Tier 3 scenario.

### Test scenarios (7)

| # | Pri | Name | Proves |
|---|---|---|---|
| 1 | P0 | Create class happy path — all fields | L1 (implicit), L3 (implicit), L4 (implicit), happy path |
| 2 | P0 | Activity log explicit proof (type + description + metadata) | **L3, L4** explicit |
| 3 | P0 | Description → notes column | **L1** explicit |
| 4 | P0 | Blank title defaults to class_type.name | **L2** explicit |
| 5 | P1 | Missing class type → inline error | Client-side validation guard |
| 6 | P1 | End time ≤ start time → server error | Server-side validation |
| 7 | P1 | Cancel closes modal without DB write | State leak prevention + form reset on reopen |

---

## Phase 2 — Architect

8-step blueprint, 1 migration, 8 files:

1. Migration (enum extension) — applied via Supabase MCP
2. POST handler rewrite (L1–L5) — 1 file
3. Testid seeds (1 + 12 = 13) — 2 files
4. Fixture constants (2 new) + db.ts cleanup 5c — 2 files
5. SchedulePage POM extension — 1 file (existing 30-line stub extended with ~200 lines)
6. New spec file — 1 file
7–8. Code review + Sentinel

Execution order was load-bearing: Step 1 MUST precede Step 2 (enum migration must land before handler writes `class_created`); Step 3 before Step 5 (POM references testids); Step 4 before Step 6 (spec imports constants + relies on cleanup); Step 5 before Step 6 (spec imports POM).

Full architect report: `specs/reports/schedule-create-class-architect.md` (~1,500 lines with POM skeleton, scenario templates, risk register, and handoff checklist).

---

## Phase 3 — Engineer

All 6 blueprint steps landed cleanly. Notable implementation details:

- **Migration applied** via Supabase MCP `apply_migration` with name `extend_activity_log_class_types`. All 22 values verified via `pg_constraint` query after apply.
- **Route rewrite** was surgical — 5 discrete changes within the existing POST handler body, 0 lines added outside it. The L2 fix reused the existing class_type verification query by changing `.select("id")` to `.select("id, name")` — zero new round trips.
- **`title || classType.name`** (not `??`) — the `||` operator handles both the modal's `null` and hypothetical future `''` inputs. Architect explicitly specified this; code reviewer verified.
- **Capture-and-log pattern** for `activityError` — no rollback (observability pattern established in Tiers 3.1/3.4/3.5/3.6/3.7).
- **Idempotent short-circuit** NOT added — this is a pure create flow with a unique class UUID, no re-create concern.
- **SchedulePage POM** extended the existing 30-line smoke stub. Section header `// ─── Tier 3.8: Create Class ───`. `submitClassForm()` uses the canonical `page.waitForResponse((res) => ... && method === 'POST')` pattern established in Tier 3.7.
- **Spec file** uses `schedule.goto('/schedule')` (POM method from BasePage) instead of `page.goto` — both work, but the POM method is slightly more idiomatic in this tier.

---

## Phase 4 — Code Review (feature-dev:code-reviewer)

**2 issues found, both fixed in Healer.**

### Issue 1 (CRITICAL, confidence 88) — `tomorrowDate()` uses `toISOString()` which returns UTC

```ts
// BUGGY
function tomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]  // UTC!
}
```

The comment claimed "local timezone-safe" but `toISOString()` always returns UTC. In EST (UTC-5), local 23:30 on Apr 10 is UTC 04:30 on Apr 11 — so `setDate(+1)` → local Apr 11, but `toISOString()` → UTC Apr 12. Off-by-one at late local hours in western timezones.

**Fix:** Use local date parts (`getFullYear()`, `getMonth() + 1`, `getDate()`) with explicit zero-padding. No UTC conversion.

### Issue 2 (IMPORTANT, confidence 82) — Scenario 4 recency guard direction

```ts
// BUGGY
expect(new Date(newest.created_at).getTime()).toBeGreaterThan(
  beforeCreate - 1000,
)
```

The `- 1000` was intended as a clock-skew buffer, but subtracting 1000ms from `beforeCreate` *expands the valid window backwards*, making the guard MORE permissive, not less. A prior-run blank-title row created 999ms before `beforeCreate` would pass the guard and be falsely accepted as "the one I just created".

**Fix:** `>= beforeCreate` strictly. The insert always happens AFTER `beforeCreate` (captured before the modal opens), so the strict check is correct. Same-machine JS and Postgres clocks are tightly synchronized enough that no backwards buffer is needed; a forward-tolerance buffer would need to be in the OTHER direction (raising `beforeCreate`, not lowering).

### Clean areas verified

- L1–L5 POST handler fixes all match the canonical pattern. `classType.name` is in scope when the activity_log insert runs.
- Role check placement (after profile fetch, before class_type query) is correct.
- `selectOption({ label })` for native `<select>` matches visible text; Scenario 4 passes `'Open Sauna'` which matches the option text.
- `page.waitForResponse` filter requires BOTH `url().includes('/api/classes')` AND `method() === 'POST'` — will NOT match GET schedule refresh requests or DELETE.
- `openNewClassModal()` waits for `submitClassBtn().toBeEnabled()` which is the correct readiness signal (button is disabled while lookups load).
- `workers: 1` in playwright.config.ts confirms no concurrent test race for Scenario 4.
- Fixture constants match Analyst probe exactly (UUID `314f0ddf-dc6d-4402-beaa-22ed19172b18` for Open Sauna).
- `db.ts` step 5c cleanup correctly scoped (`studio_id = X AND type LIKE 'class_%'`), safe against shared dev DBs because `class_*` types are new as of this tier's migration.

---

## Phase 5 — Healer

Applied both reviewer fixes inline. One additional transient issue surfaced during Sentinel (documented below).

---

## Phase 6 — Sentinel

### Round 1 — Tier 3.8 standalone (3 runs)

| Run | Duration | Result |
|---|---|---|
| 1 | 54.5s | 9/9 ✅ |
| 2 | 49.5s | 9/9 ✅ |
| 3 | 60.0s | 9/9 ✅ |

(9 includes 2 auth-setup + 7 Tier 3.8 tests.)

### Round 2 — Full members + schedule regression (first attempt)

32 tests (2 auth + 9 Tier 3.5 + 9 Tier 3.6 + 5 Tier 3.7 + 7 Tier 3.8). **30/32 passing**, 2 transient failures in Tier 3.7 Scenarios 1 and 2 (`openMemberProfileByName` could not find the seeded member in the directory search results). Scenarios 3, 4, 5 of Tier 3.7 passed. Tier 3.5 and 3.6 were 18/18.

### Diagnosis

- Ran Tier 3.7 standalone → 7/7 ✅ (proves the Tier 3.7 code is not broken)
- Ran the same full regression again → **32/32 ✅** (proves the failures were transient)

The failure pattern (first two scenarios of Tier 3.7 failing, subsequent scenarios passing) is consistent with a warmup/state-pileup issue. Possible causes:

1. **Supabase connection pool or rate limit pressure.** The full regression does ~400 deletes per `beforeEach` across 32 tests. If the pool hits a limit during Tier 3.7's first seedMember calls, the insert could succeed but not be visible to the subsequent search query (eventual consistency or write-after-read lag).

2. **Members directory search debounce race with DOM hydration.** `openMemberProfileByName` fills the search box (which triggers the debounced server-side search query), then immediately asserts `toBeVisible` on the filtered row. Under load, the debounce + query + render cycle may exceed 10s.

3. **BUG-011 bleed-through.** Although `openMemberProfileByName` uses the search box (which IS server-side), the newly-seeded member's profile might not be visible to the query briefly after insert due to replica lag or RLS caching. Unclear.

Neither reproduced on the second attempt. Since Tier 3.6 also had a similar transient pattern (documented in its own report), this is a recurring but non-deterministic phenomenon — **the standing directive from Tier 3.6 holds: re-run once before declaring failure.**

### Round 3 — Full regression re-run

**32/32 passing (3.0m total).** Zero regressions from the Tier 3.8 changes:

- Tier 3.5 Create Member: 9/9 ✅
- Tier 3.6 Edit Member: 9/9 ✅
- Tier 3.7 Archive + Exclude: 5/5 ✅
- Tier 3.8 Create Class: 7/7 ✅
- Auth setup: 2/2 ✅

Notable: Tier 3.7 passed all 5 scenarios, including the two that had failed on the first attempt.

---

## Files changed

### Production code

| File | Change |
|---|---|
| `apps/web/src/app/api/classes/route.ts` | POST handler rewrite: role check (L5), extended class_type query for name (L2 prerequisite), `notes: description ?? null` (L1), `title: title \|\| classType.name` (L2), activity_log with `description: \`Class created: ${classType.name}\`` + capture-and-log (L3), `type: 'class_created'` unchanged but now valid in enum (L4). Updated JSDoc. |
| `apps/web/src/app/(admin)/schedule/page.tsx` | 1 testid added: `schedule-new-class-btn` on line 736. |
| `apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` | 12 testids seeded: modal root, class type select, title/date/time inputs, capacity, trainer select, description textarea, error paragraph, cancel/submit buttons. Zero logic changes. |

### Migration

| Migration | Change |
|---|---|
| `extend_activity_log_class_types` (applied 2026-04-10 via Supabase MCP) | Drops + re-adds `activity_log_type_check` with 4 new values: `class_created`, `class_updated`, `class_cancelled`, `class_deleted`. All 18 original values preserved. |

### Test infrastructure

| File | Change |
|---|---|
| `apps/web/e2e/fixtures/test-data.ts` | 2 new constants: `DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID`, `DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME`. |
| `apps/web/e2e/fixtures/db.ts` | Step 5c in `resetStudioTestData`: deletes `activity_log` rows scoped to `studio_id` + `type LIKE 'class_%'`. |
| `apps/web/e2e/pages/SchedulePage.ts` | Extended existing 30-line smoke stub with Tier 3.8 section: 13 locators + 5 helpers (`openNewClassModal`, `fillClassForm`, `submitClassForm`, `cancelClassForm`, `expectClassFormError`). |
| `apps/web/e2e/schedule-create-class.spec.ts` | NEW — 7 scenarios (~400 lines). |

### Specs

| File | Change |
|---|---|
| `specs/reports/schedule-create-class-analyst.md` | NEW — full Analyst report with probe results, 4 bug layers, 3 sub-findings, 7 scenarios |
| `specs/reports/schedule-create-class-architect.md` | NEW — 8-step blueprint with POM skeleton + per-scenario templates + risk register |
| `specs/reports/schedule-create-class-report.md` | This file |

---

## Bugs

### BUG-015 — closed by this run

All 4 blocking layers + L5 sub-finding fixed inline:
- L1: Phantom `description` column → `notes` mapping
- L2: `title` NOT NULL → defaults to `class_type.name` when blank
- L3: `activity_log.description` NOT NULL → inserted with capture-and-log
- L4: `type='class_created'` not in enum → migration added 4 class lifecycle values
- L5: Missing POST role check → added, mirrors GET handler pattern

### BUG-016 — filed for future tiers (NEW)

Three RLS sub-findings on the schedule subsystem, all documented in the Analyst report:

- **L6: `classes_write` RLS operator precedence** — cross-tenant write vector for admin/manager roles (defense-in-depth failure, mitigated in practice by app-layer studio_id lookups but still a bug)
- **L7: `classes_update` has no role restriction** — any authenticated studio member can update any class (will be exercised by Tier 3.10 Reschedule)
- **L8: `class_types_studio_write` has no role restriction** — any studio member can create class_types (not exercised by Tier 3, may be deferred indefinitely)

Should be filed as `specs/bugs/schedule-rls-gaps.md` by the Scribe. All three are low-likelihood in production but should be fixed when Tier 3.10/3.11 touches the schedule RLS surface.

---

## Design notes for future tiers

1. **The POM `waitForResponse` pattern is now used across 2 tiers (3.7 archive, 3.8 create).** It's the canonical shape for any POM helper that triggers an async fetch. Future tiers should apply it to any POST/PUT/DELETE helper. Tier 3.9 (Cancel Class) will add a DELETE helper; Tier 3.10 (Reschedule) will add a PUT helper. Both should use this pattern.

2. **`class_types` is a "reference" dependency, not a fixture.** The Tier 3.8 spec references pre-seeded class_types by ID/name rather than creating them per test. This keeps the test surface smaller and matches reality (class_types are configured once per studio and reused for all classes). Future schedule tiers should follow the same pattern — don't seed new class_types per test.

3. **Scenario 4 demonstrates a new assertion pattern: query by most-recent + assert recency.** When you can't filter by a unique test marker (because the marker is shared — e.g., blank title defaulting to a class_type name), query by the non-unique filter, order by created_at DESC LIMIT 1, and assert the recency timestamp. This is cleaner than creating a temporary unique marker that the feature doesn't normally produce.

4. **The "silent swallow" pattern has now bit 6 consecutive Tier 3 runs** (3.1, 3.4, 3.5, 3.6, 3.7, 3.8). Every write flow in Meridian needs explicit `{ error }` capture. Every Tier 3 run has surfaced at least one instance of omitted NOT NULL columns on activity_log. Tier 3.8 had the 6th consecutive instance. **A dedicated Tier 8 audit scanning for unprotected writes is no longer optional — it should be scheduled as a confirmed Tier 8 task.**

5. **BUG-015 is the second tier in a row where the feature was UI-present but totally non-functional** (Tier 3.4 products, Tier 3.8 classes). The pattern: prior dev wrote a modal that POSTs to a route; the route inserts into the wrong columns; nobody ever tested the feature end-to-end; it shipped silent-broken. **When auditing Meridian modules, the presence of a modal should NOT be treated as evidence the underlying write flow works.** The Phase 1 audit claim "Create Class: ✅" in CLAUDE.md was incorrect — the feature was broken. Update CLAUDE.md after this tier.

6. **Code review continues to earn its place.** 2 issues caught (tomorrowDate UTC bug, recency guard direction). Both would have shipped undetected by Engineer alone. The tomorrowDate bug would have caused nondeterministic flake near midnight EST; the recency guard bug would have allowed false positives on Scenario 4 across runs.

7. **Transient regression failures are a recurring phenomenon.** Tier 3.6 had one transient failure (dup-email) that didn't reproduce. Tier 3.8 had two transient failures (Tier 3.7 scenarios) that didn't reproduce. Both cases involved Supabase-heavy test runs (many deletes + seeds). **The standing directive is: when a regression fails, re-run the same suite once before investigating. If it still fails, investigate. If it passes, log the transient in the Sentinel notes and move on.** This directive has now paid off twice.

8. **The panel-button ID trace was N/A for this tier** but the principle applies to future schedule tiers. Tier 3.9 (Cancel) and Tier 3.10 (Reschedule) will both exercise the edit/cancel flow where `editData!.id` flows from the schedule click → modal → DELETE/PUT route. Trace that ID chain in the Analyst phase.

---

## Tier 3 status

**7/12 → 8/12** (6 full, 2 gap-filed). Next: **Tier 3.9 — Schedule: Cancel Class**. The migration from this tier already extends the `activity_log.type` enum with `class_cancelled`, so Tier 3.9 won't need another migration — it can focus purely on the DELETE or status=cancelled flow, the POM extension (add `cancelClassBtn`, `expectClassCancelled`), and the spec.

**Tier counter advances to 8/12 on Scribe completion.**
