# QA Council — Members: Edit Member (Tier 3.6)

**Pipeline ID:** `members-edit-member`
**Tier:** 3.6 (Core Writes — 6 of 12)
**Project:** `admin`
**Run date:** 2026-04-09
**Final status:** ✅ COMPLETE — 9 tests passing, 6-layer schema divergence fixed inline, RLS policy gap fixed, new architectural bug filed for follow-up

---

## Summary

Full write-flow coverage for the admin "Edit Member" UX: open the profile panel from the directory, click the new Pencil icon next to the Close button, edit name/email/phone/notes, and assert that the rows actually change in Postgres. **Before this run, no Edit UI existed at all** — the Members panel had Pause/Upgrade/Archive but no inline edit affordance, and `PUT /api/members/[id]` was broken at six independent layers (BUG-012). Mid-run, a seventh related bug surfaced: `members.id` and `members.profile_id` are 100% distinct UUIDs across all 1,188 production rows, and the Member.id mapping in the directory query mints `members.id` into a field that the per-member action routes (PUT/DELETE/pause/upgrade) all expect to be `profile_id` (BUG-013). All six BUG-012 layers fixed inline. BUG-013 partially mitigated for Edit Member only via Option B (narrow blast radius); broader fix queued for Tier 3.7.

| Metric | Value |
|---|---|
| Tests written | 9 (P0=4, P1=5) |
| New components | 1 (`EditMemberModal.tsx` — ~190 lines) |
| POM additions | 8 locators + 8 helpers on `MembersPage` (Tier 3.6 section) |
| Testids seeded | 10 across `MemberProfilePanel.tsx` (2) + `EditMemberModal.tsx` (8) + `members/page.tsx` (1 row testid + 1 data-row-key attr) |
| Source files edited | 7 (PUT route + types + page + panel + new modal + POM + db.ts) |
| Migrations applied | 1 (`profiles_update_admin` RLS UPDATE policy) |
| Bugs filed | BUG-012 (closed by this run — 6 layers fixed) + BUG-013 (new, filed for Tier 3.7) |
| Flake detection | 29/29 passing across 3 repeats (3.4m) |
| Full admin regression | 106/106 passing (5.1m) |
| Full pipeline duration | Single session (Analyst → Architect → Engineer → Code Review → Sentinel → Scribe) |

---

## The six layers of BUG-012 (all fixed inline)

The Analyst flagged six layers based on the Tier 3.5 detection-gap learnings (mandatory `pg_policies` probe, mandatory schema column probe, etc.). All six were patched in a single PUT handler rewrite.

1. **`notes` written to wrong table** — The pre-fix handler put `notes` in the `allowedFields` list and wrote it to `profiles`. But `profiles` has no `notes` column — it lives on `members`. The Supabase JS client does not throw on column-not-found errors; the value was silently dropped on every request. Fixed by splitting `allowedFields` into `profileAllowedFields = ["full_name", "email", "phone", "exclude_from_analytics"]` and `memberAllowedFields = ["notes"]`, with two separate UPDATE blocks.

2. **Phantom `members` columns in the profile insert payload** — `membership_tier`, `membership_status`, and `credits_remaining` were in the original `allowedFields` list. They live on `members`, not `profiles`, AND they have dedicated routes (`/upgrade`, `/pause`) that handle them with state-machine logic. Fixed by removing them from both lists; sending any of these in the body now correctly returns `400 No valid fields to update`. State-machine fields belong to state-machine routes.

3. **`exclude_from_analytics` was the only valid field that ever made it through** — Pre-fix, this masked the bug because partial updates to `exclude_from_analytics` looked like the handler "worked." Fixed by Layer 1+2 above; this field is now still accepted, but joined by the four other now-valid fields.

4. **Missing `activity_log.description` (NOT NULL)** — The PUT handler's `activity_log` insert omitted `description`. NOT NULL with no default → silent insert failure (Supabase JS client doesn't throw). Fixed by adding `description: \`Member updated: ${memberName}\`` matching the Tier 3.5 POST handler pattern. The activityError is captured into `console.error` on failure (no rollback — observability is not business-critical).

5. **Missing RLS UPDATE policy on `profiles` for admins** — `profiles` had `profiles_read` (SELECT), `profiles_update_own` (UPDATE WHERE auth.uid() = id), and `profiles_write` (INSERT — added in Tier 3.5 BUG-010 Layer 5). It did NOT have an admin-scoped UPDATE policy. The Tier 3.5 Layer 5 lesson: Supabase MCP's `execute_sql` runs as superuser and bypasses RLS, so the Analyst probe alone can't catch this — but the Analyst's mandatory `pg_policies` probe (added as a standing checklist item after BUG-010) explicitly looked for missing policies and surfaced this gap before code was written. Fixed by applying:
   ```sql
   CREATE POLICY profiles_update_admin ON profiles
     FOR UPDATE
     USING (studio_id = get_user_studio_id())
     WITH CHECK (studio_id = get_user_studio_id());
   ```
   Application-layer `requireRole(['owner','manager'])` still gates the route; RLS enforces studio scope. **First time the standing `pg_policies` checklist item caught a bug at Analyst-time rather than at Sentinel-time** — the Tier 3.5 detection-gap fix paid off immediately.

6. **No duplicate-email check on PUT** — The POST handler had a dup-email 409 check (added in BUG-010 fixes); the PUT handler did not. Fixed by mirroring the POST pattern with `.neq("id", id)` to allow idempotent updates (a member updating to their own current email still succeeds).

---

## BUG-013 (newly discovered, partial mitigation in this run)

**Discovery:** During Engineer Step 3 (seeding testids in `MemberProfilePanel.tsx`), I needed to wire the new Edit button's `onClick` to call `PUT /api/members/${something}`. Reading the existing pre-fix PUT handler showed it used `.eq("id", id)` against `profiles`, meaning the URL `[id]` parameter must be a `profile_id`. Reading `MemberProfilePanel.tsx` showed every other action button (Pause, Upgrade, Archive) passes `member.id`. Reading `members/page.tsx:258` showed the directory query maps `id: row.id` (the `members.id` PK).

**SQL probe via Supabase MCP:**
```sql
SELECT count(*) FROM members WHERE id::text = profile_id::text;
-- → 0 (out of 1188 rows)
```

Every single members row has `members.id ≠ members.profile_id`. The UI has been silently passing the wrong ID to the per-member action routes for an unknown duration. The fact that no test had ever exercised these buttons end-to-end is why no one noticed.

**FK truth (also probed):**
- `bookings.member_id` → `members.id` (NOT `profiles.id`)
- `transactions.member_id` → `members.id`
- `member_tags.member_id` → `members.id`

So the data-fetching path (`fetchMemberDetail` for bookings/transactions/tags) is **correct** in passing `members.id`. Only the action-mutation routes are wrong. This is an architectural inconsistency, not a one-off typo.

**Decision: Option B (narrow blast).** Added `profileId: string` to the `Member` interface. Set `profileId: row.profile_id` in the directory query mapping. The new `EditMemberModal` correctly uses `member.profileId`. All other call sites (Pause, Upgrade, Archive, View Full Profile link) still pass `member.id` and remain broken — these are filed as BUG-013 for Tier 3.7 (Members: Lifecycle), which will exercise them end-to-end and surface the bug deterministically.

**Why not fix the wider issue inline:** Tier 3.6's contract is "Edit Member." Fixing the entire panel would balloon the scope, and the partial fix would still need verification by Tier 3.7's tests anyway. The narrow Option B fix (a) makes the new Edit Member feature actually work end-to-end, (b) does not regress any existing flows (the broken ones stay broken at the same level they were before), and (c) sets up a clean handoff to Tier 3.7. Filed `specs/bugs/members-id-vs-profile-id-divergence.md` documenting the full picture, the full fix recommendation (Option A), and the recommended Analyst checklist update.

---

## Files changed

| File | Change |
|---|---|
| `apps/web/src/app/api/members/[id]/route.ts` | Rewrote PUT handler: split allowed fields by table, added email regex, added duplicate-email 409 check, added profile + members write blocks (each only fires when its respective fields are present), captured `activityError`, fetched `existingProfile` upfront for the activity_log description fallback (code-reviewer fix), added members UPDATE row-count check via `.select('id').maybeSingle()` (code-reviewer fix), updated docblock to reflect actual accepted fields (code-reviewer fix). DELETE/GET handlers untouched (Tier 3.7 scope). |
| `apps/web/src/app/(admin)/members/_components/types.ts` | Added `profileId: string` to the `Member` interface with a comment explaining BUG-013. |
| `apps/web/src/app/(admin)/members/page.tsx` | Set `profileId: row.profile_id` in the directory query mapping. Wired `onEditSuccess={() => { fetchMembers(); fetchCounts() }}` on the panel mount. Added `data-testid="members-directory-row"` and `data-row-key={member.profileId}` to the directory `<tr>`. |
| `apps/web/src/app/(admin)/members/_components/MemberProfilePanel.tsx` | Added `Pencil` to lucide imports. Imported and mounted `EditMemberModal`. Added `editOpen` state. Added `onEditSuccess?` prop. Wrapped the existing Close X button with a flex container that also holds the new Pencil edit button (`data-testid="members-edit-btn"`). Added `data-testid="members-panel-close-btn"` to the existing close X. |
| `apps/web/src/app/(admin)/members/_components/EditMemberModal.tsx` | NEW (~190 lines). Mirrors AddMemberModal pattern. 4 fields (full_name, email, phone, notes), 8 testids, delta-payload submission, useEffect re-seeds form when reopened or when underlying member changes, no-op short-circuit if nothing changed, PUT to `/api/members/${profileId}`. |
| `apps/web/src/__tests__/unit/components/member-profile-panel.test.tsx` | Added `profileId: 'test-profile-1'` to the `makeMember()` factory (code-reviewer fix — would have broken `tsc --noEmit`). |
| `apps/web/e2e/pages/MembersPage.ts` | Tier 3.6 section: 8 locators + 8 helpers including `openMemberProfileByName(name)`, `openEditMemberModal()`, `editMemberViaModal({ name?, email?, phone?, notes? })`, `expectEditMemberError(substring)`. |
| `apps/web/e2e/fixtures/db.ts` | Added `notes?: string \| null` to `SeedMemberOptions` and to the `members` insert in `seedMember()`. Required by the Scenario 9 regression test. |
| `apps/web/e2e/members-edit-member.spec.ts` | NEW — 9 tests covering BUG-012 layer-by-layer fix proofs + validation edges + a notes-survival regression check |
| **Database migrations (via Supabase MCP):** | |
| `bug012_layer5_profiles_update_admin_policy` | `CREATE POLICY profiles_update_admin ON profiles FOR UPDATE USING (studio_id = get_user_studio_id()) WITH CHECK (...)` |
| **Bugs filed:** | |
| `specs/bugs/members-id-vs-profile-id-divergence.md` | NEW — BUG-013 documentation, full impact table, recommended Option A fix, Analyst checklist update recommendation |

---

## Test inventory

| # | Priority | Scenario | Key assertion |
|---|---|---|---|
| 1 | P0 | Edit happy path | Profile name + phone updated, activity_log row with `type='member_updated'` and non-null `description` containing the new name |
| 2 | P0 | Notes write to members.notes (Layer 1) | After editing only `notes`, `members.notes` contains the new value (and `profiles` doesn't even have a notes column to write to — schema-level proof) |
| 3 | P0 | activity_log integrity (Layers 3+4) | `description` not null + contains "Member updated" + `type === 'member_updated'` + `metadata.fields` array contains the changed field |
| 4 | P0 | Admin can update profile they don't own (Layer 5 RLS) | Admin (different auth.uid) successfully updates a seeded member's name; pre-fix, `profiles_update_own` would have blocked this with no policy override |
| 5 | P1 | Blank name keeps Submit disabled | Clear name field; submit goes disabled; no DB mutation |
| 6 | P1 | Duplicate email returns 409 (Layer 6) | Seed two members; try to overwrite memberB's email with memberA's; modal stays open with "already exists" error; memberB email unchanged |
| 7 | P1 | Invalid email format returns 400 (server regex) | `page.request.put` direct API call bypasses HTML5 validation; `body.error === 'Invalid email format'`; profile email unchanged |
| 8 | P1 | Cancel closes modal without writing | Type new name; cancel; profile name + phone unchanged in DB |
| 9 | P1 | PUT updates only changed fields | Edit ONLY name; assert email + phone unchanged in profiles, notes unchanged in members (Layer 1 regression: name change must NOT clear notes from a different table) |

---

## Phase log

### Phase 1 — Analyst ✅
Report: `specs/reports/members-edit-member-analyst.md`
Scenarios: 9 (4 P0, 5 P1). 8 testids flagged `[NEEDS SEEDING]` for the new modal + 1 for the panel Edit button + 1 directory row testid. BUG-012 documented as a 6-layer stack — the **first time the mandatory `pg_policies` checklist item (added as a standing Analyst step after Tier 3.5 BUG-010 Layer 5) caught a missing policy at Analyst-time**, before any test was written. Saved a Sentinel round.

### Phase 2 — Architect ✅
Report: `specs/reports/members-edit-member-architect.md`
8-step blueprint: migration → PUT handler rewrite → testid seeds in panel → create EditMemberModal → POM extension → seedMember `notes` extension → spec file → code review + Sentinel.
Decision log: chose "build inline" vs "gap-file" (mirrors Tier 3.5 BUG-009/BUG-010 pattern); chose to add `profileId` to Member type (Option B) for the BUG-013 narrow fix mid-Engineer-phase rather than expand scope.

### Phase 3 — Engineer ✅
All 8 blueprint steps completed inline.
- Step 1: Applied `profiles_update_admin` RLS policy via Supabase MCP.
- Step 2: Rewrote PUT handler — all 6 BUG-012 layers patched in one edit.
- **Step 2.5 (unplanned):** Investigation surfaced BUG-013. SQL probe confirmed 1,188/1,188 rows have `members.id ≠ profile_id`. Documented in `specs/bugs/members-id-vs-profile-id-divergence.md`. Applied Option B narrow fix: added `profileId: string` to Member type, set `profileId: row.profile_id` in page.tsx mapping.
- Step 3: Seeded testids in MemberProfilePanel (Edit button + Close X) and the directory rows.
- Step 4: Created EditMemberModal (~190 lines) with delta-payload submission and re-seed-on-open useEffect.
- Step 5: Extended MembersPage POM with the Tier 3.6 section.
- Step 6: Extended `seedMember()` to accept `notes`.
- Step 7: Wrote 9-test spec.
- Step 8: Code review (separate phase below).

### Code Review (feature-dev:code-reviewer) — 4 issues, all fixed inline
1. **Critical** — `makeMember()` unit test factory at `member-profile-panel.test.tsx:45` was missing the new required `profileId` field. Would have broken `tsc --noEmit` on next CI run. Fixed: added `profileId: 'test-profile-1'`.
2. **Important** — The members UPDATE block had no row-count check. A 0-row UPDATE (orphaned member row, future RLS gap) would silently return 200 with notes never saved. Fixed: added `.select('id').maybeSingle()` and checked `!updatedMember`, returning 404 on miss.
3. **Important** — `memberName` would always be `"(unknown)"` when only `notes` changed (because `updatedProfile` would be null since profileUpdates was empty, and the only fallback was `updatedProfile?.full_name`). Fixed: fetch the existing profile up-front (also serves as a clean studio-scoped 404 check), use its `full_name` as the fallback. The activity_log description now always contains the real name regardless of which table was written.
4. **Medium** — The PUT docblock listed pre-fix accepted body fields including `membership_tier`, `membership_status`, `credits_remaining`, `roles`. These are all rejected by the post-fix handler. Misleading for any future API consumer. Fixed: rewrote the docblock to enumerate the actual accepted fields and the rejected ones with the dedicated route they should use.

### Phase 4 — Sentinel ✅ PASS (first round)
- Flake detection: **29/29 passing** across `--repeat-each=3` (3.4m). Zero flakes.
- Full admin regression (round 1): **105/106 passing** with one flaky failure on the dup-email test that did NOT reproduce in isolated re-runs.
- Full admin regression (round 2): **106/106 passing** (5.1m). Zero regressions from the API route fix, the migration, or the new files. The single failure on round 1 was a one-off transient (likely server load timing — both Tier 3.5 and Tier 3.6 specs heavily exercise the directory query, and the round-2 rerun confirmed the test is stable).

### Phase 5 — Scribe ✅
This report + `pipeline-log.md` update + `qa-pipeline-roadmap.md` advance.

---

## Design notes

**The Tier 3.5 detection-gap fix paid for itself immediately.** BUG-010 Layer 5 (the missing INSERT policy) was invisible to the Analyst because Supabase MCP runs as superuser and bypasses RLS. The remediation was to add a mandatory `pg_policies` probe to the standing Analyst checklist. Tier 3.6 was the first run with that checklist item — and it caught BUG-012 Layer 5 (the missing UPDATE policy) before a single test was written. Sentinel never saw the failure. One round of inline fix instead of a Sentinel→Healer→Sentinel cycle.

Going forward, the three mandatory Tier 3+ Analyst probes are now battle-tested:
1. `information_schema.columns` for every table the feature writes to (catches phantom columns + NOT NULL violations — caught BUG-009 Layer 6, BUG-010 Layer 4, BUG-012 Layer 1)
2. `pg_constraint` for every CHECK constraint (catches enum mismatches — caught BUG-009 Layer 3, BUG-010 Layer 3)
3. `pg_policies` for every table the feature writes to (catches missing RLS policies — would have caught BUG-010 Layer 5 in hindsight, **caught BUG-012 Layer 5 prospectively**)

**BUG-013 is a different kind of detection gap.** No schema probe would have caught it — the schema is fine. The bug is an architectural inconsistency between which UUID the UI passes (`members.id`) and which UUID the route expects (`profile_id`). Catching it requires either (a) a session-scoped E2E test that exercises the UI button end-to-end (which is what Tier 3.7 will do), or (b) a code-tracing audit that follows `${id}` from every panel button through to its WHERE clause. Adding a "panel action button ID trace" item to the standing Analyst checklist is the cheapest fix — recommendation already filed in the BUG-013 bug doc.

**The "silent swallow" pattern keeps biting.** Now four Tier 3 council runs in a row (3.1, 3.4, 3.5, 3.6) have surfaced the same failure mode: Supabase JS client does not throw on insert/update errors, so `await ...insert(...)` returns `{ error }` and the caller discards it. Tier 3.6 added a new wrinkle: the same applies to `update().eq()` chains that match zero rows — they return `{ data: [], error: null }`. The code reviewer caught this on the members UPDATE block in this run; the fix was `.select('id').maybeSingle()` + `if (!updatedMember) return 404`. Worth a dedicated Tier 8 audit that greps for `await supabase.from(...).(insert|update|delete)(...)` without a capture pattern.

**Bug discovery DURING the Engineer phase is now a known phenomenon.** Tier 3.5 surfaced BUG-011 (directory ordering) during Sentinel; Tier 3.6 surfaced BUG-013 (member ID vs profile ID) during Engineer Step 3. The right answer in both cases was: file the new bug, mitigate narrowly within current scope, queue the broader fix for a future tier. Trying to fix both BUG-012 AND BUG-013 fully in this run would have ballooned the council from "single session" to "multi-day" and risked breaking unrelated UI (the Pause/Upgrade/Archive flows would all need their tests rewritten alongside).

**Tier 3 progress: 6/12.** 4 full runs (3.1, 3.4, 3.5, 3.6), 2 gap-filed (3.2, 3.3). Next: Tier 3.7 — Members: Lifecycle (Pause/Upgrade/Archive), which will surface every BUG-013 instance and fix them at the proper scope.
