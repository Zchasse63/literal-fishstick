# Tier 3.7 — Members: Archive / Exclude from Analytics

**Run date:** 2026-04-10
**Pipeline:** Full (Analyst → Architect → Engineer → Code Review → Sentinel → Scribe)
**Status:** ✅ PASS
**Tests:** 5 scenarios (3 P0, 2 P1) — all green on 3 consecutive flake-check runs
**Bugs closed by this run:** BUG-014 (4 layers, all fixed inline), BUG-008 GAP-5 (exclude_from_analytics UI wired end-to-end)
**Bugs narrowed by this run:** BUG-013 (second panel-to-route divergence fixed: the directory dropdown "Remove" button)

---

## Feature scope

Two adjacent lifecycle operations on the Members surface, both flowing through `MemberProfilePanel` and the existing `EditMemberModal`:

1. **Archive** — soft-delete via `DELETE /api/members/[id]`. Button lives in the panel's Active Membership card alongside Pause/Upgrade. Flips `profiles.is_active = false` and writes a `member_deleted` row to `activity_log`. Member is NOT physically deleted — credits, transactions, and history remain intact.
2. **Exclude from Analytics** — per-member toggle persisted as `profiles.exclude_from_analytics`. Used to hide comped / former-owner accounts from revenue and attendance calculations without removing them from the directory or revoking their access. The PUT allowlist was already extended in Tier 3.6; this tier ships the UI.

Both operations were already supported at the schema + API layer. The panel's Archive button was UI-present-but-route-broken (4-layer BUG-014), and the Exclude toggle had no UI at all (BUG-008 GAP-5).

---

## Phase 1 — Analyst

### Scenarios (5)

| # | Priority | Name | What it proves |
|---|---|---|---|
| 1 | P0 | Archives a member, flipping `is_active=false` + activity_log row lands | Happy path; implicit proof for Layers 1, 3, 4 |
| 2 | P0 | Archive activity_log has non-null description + valid type | Explicit proof for Layers 2 + 3 (the silent-swallow layers) |
| 3 | P0 | Exclude from Analytics checkbox writes `profiles.exclude_from_analytics` | Closes BUG-008 GAP-5 |
| 4 | P1 | Cancelling archive dialog leaves member active | Confirms `confirm()` dismiss path; no DB mutation |
| 5 | P1 | Exclude from Analytics persists through modal reopen | Round-trip: DB → directory mapper → panel → modal initial state. Also proves no duplicate log row on no-op submit. |

### BUG-014 — DELETE handler 4-layer divergence

All four layers caught at Analyst-time via the three mandatory Tier 3+ probes:

| Layer | Source of divergence | Probe that caught it |
|---|---|---|
| **L1** — phantom `profiles.status = 'archived'` write. Actual soft-delete flag is `profiles.is_active`. | `information_schema.columns` probe: no `status` column on `profiles`. | — |
| **L2** — `activity_log.description` omitted from insert (column is NOT NULL with no default, silent-swallow pattern). | `information_schema.columns` probe: `activity_log.description` NOT NULL. | — |
| **L3** — `activity_log.type = 'member_archived'` not in the CHECK constraint enum (canonical is `'member_deleted'`, established in Tier 3.5). | `pg_constraint` probe. | — |
| **L4** — panel Archive button passed `member.id` (= `members.id`) but the route WHERE clause expects `profile_id`. BUG-013 inheritance. | The new standing checklist item introduced after Tier 3.6: **panel action button ID trace**. | — |

### Analyst-time addition to the standing checklist

After Tier 3.6 surfaced BUG-013 mid-Engineer-step-3, the Analyst checklist was extended with: **for each panel action button, trace `${id}` from the UI through to the route's WHERE clause.** Tier 3.7 is the first run where that checklist item caught a bug before a single line of test code was written. L4 would otherwise have surfaced at Sentinel-time as a 404.

### BUG-008 GAP-5 state entering the run

- `profiles.exclude_from_analytics` column exists.
- Tier 3.6 extended the PUT allowlist to accept `exclude_from_analytics` as one of the whitelisted fields.
- Tier 3.6 activity_log metadata already includes `fields` array so `exclude_from_analytics` edits are auditable.
- Zero UI surface to set the flag. This run is the UI wire-up.

---

## Phase 2 — Architect

### Blueprint: 8 steps, 0 migrations, 9 files

**Archive fixes (Steps 1–2)**
1. Rewrite DELETE handler in `apps/web/src/app/api/members/[id]/route.ts` — fix all four BUG-014 layers + add role check + idempotent short-circuit + ai_cache invalidation + capture-and-log pattern on activity_log failure (no rollback — observability pattern).
2. BUG-013 narrow fix in `MemberProfilePanel.tsx` — flip Archive button's fetch URL from `/api/members/${member.id}` to `/api/members/${member.profileId}`. Seed `data-testid="members-archive-btn"`.

**Exclude from Analytics type chain (Steps 3–6)**
3. Extend `Member` interface in `_components/types.ts` with `excludeFromAnalytics?: boolean`.
4. Extend directory query mapper in `members/page.tsx` — add `exclude_from_analytics` to the `profiles!inner(...)` select + map `excludeFromAnalytics: profile.exclude_from_analytics ?? false` in the row mapper.
5. Pass `exclude_from_analytics` to `EditMemberModal.initial` prop in `MemberProfilePanel.tsx`.
6. Add checkbox to `EditMemberModal.tsx` — new `EditFields.exclude_from_analytics` key, re-seed useEffect, delta-payload submission (only sends field if changed), UI element with testid.

**POM + spec (Steps 7–8)**
7. Append Tier 3.7 section to `MembersPage.ts` POM with 4 helpers: `archiveMemberBtn`, `editMemberExcludeAnalyticsCheckbox`, `archiveMemberFromPanel(accept)`, `toggleExcludeFromAnalytics`, `expectExcludeFromAnalyticsChecked`.
8. Write `members-archive-exclude.spec.ts` — 5 scenarios, reuses `seedMember` + `resetStudioTestData`.

### Key design choices

- **Reused `member_deleted` enum value** (no migration). Archive is a logical subset of delete — the distinguishing marker is `metadata.action: 'archive'` on the log row.
- **Single-modal approach** for Exclude toggle. Mid-tier option was a standalone modal, but the existing EditMemberModal was the natural home and Tier 3.6 had already done the delta-payload plumbing.
- **Kept the browser `confirm()` dialog** for Archive. Playwright handles native dialogs cleanly with `page.once('dialog', ...)`.
- **No directory filter for archived members.** The is_active=false rows stay in the list; filtering is a UX scope decision for a future tier (roadmap item).

---

## Phase 3 — Engineer

All 8 blueprint steps landed. The architect report at `specs/reports/members-archive-exclude-architect.md` has the full execution log.

One unplanned addition during Engineer: the DELETE handler's **idempotent short-circuit**. If the existing profile is already `is_active=false`, return `200 { data: { id, already_archived: true } }` WITHOUT writing a duplicate activity_log row. Mirrors the canonical pattern and lets tests distinguish fresh-archive from re-archive.

---

## Phase 4 — Code Review (feature-dev:code-reviewer)

**2 issues found, both fixed in Healer.**

### Issue 1 (CRITICAL, confidence 95) — Scenario 5 `page.keyboard.press('Escape')` does not close the panel

`MemberProfilePanel` has no `onKeyDown` handler and no global Escape handler exists anywhere in the members hierarchy. The spec was using Escape to close the panel between the first edit submit and the reopen assertion. The panel would stay open, `editMemberTriggerBtn` would stay visible, and `toBeHidden({ timeout: 5000 })` would time out.

**Fix:** Replace with an explicit click on `members-panel-close-btn` via a new POM helper `closeMemberPanel()`. Panel has no Escape handler by design — it's dismissed only via the X button, route change, or `selectedMember=null` state change.

### Issue 2 (IMPORTANT, confidence 82) — Directory dropdown "Remove" button still passed `member.id`

The reviewer noticed that `page.tsx:678` has a second archive entry point (the per-row dropdown) that was NOT flipped from `member.id` to `member.profileId`. The architect scope narrowly covered only the panel button. The reviewer argued that since the file was already being touched for Step 4 (the directory mapper extension), leaving a production 404 in the same file was bad hygiene.

**Fix:** Flipped to `member.profileId` with a BUG-013 comment. Not covered by the spec's 5 scenarios (no test exercises the dropdown path) but matches the canonical pattern. Pause/Upgrade on the panel still pass `member.id` — Tier 4.2/4.3 will clean those up when they exercise the routes end-to-end.

### Clean areas the reviewer verified

- All four BUG-014 layer fixes match the canonical pattern from other PUT/pause/upgrade routes.
- Type chain `Member → directory mapper → panel → modal` is coherent at every boundary.
- Delta-payload short-circuit in EditMemberModal does NOT regress Tier 3.6 tests (field never appears in payload unless checkbox is touched).
- `page.once('dialog')` is attached BEFORE the click (race-safe).
- All `getByTestId` calls in the spec resolve to real seeded attributes.
- Fixture compatibility with `seedMember` + `resetStudioTestData` is orthogonal to `is_active`.

---

## Phase 5 — Healer

Applied both reviewer fixes inline. One additional fix was required during Sentinel (documented below).

---

## Phase 6 — Sentinel

### Round 1 — 1 failure surfaced

Scenario 1 (P0 happy path) failed with:

```
Error: expect(locator).toBeHidden() failed
Locator: getByTestId('members-edit-btn')
Expected: hidden
Received: visible
Timeout: 5000ms
```

The panel stayed visible past the 5-second timeout on Scenario 1 only. Scenarios 2–5 (which do the same archive flow) passed.

**Root cause:** Scenario 1 is the first admin test after auth-setup. Next.js compiles `/api/members/[id]/route.ts` on demand the first time it's hit, which can take >5s on cold start. The DELETE fetch was still in-flight when the test's `toBeHidden` assertion started. `archiveMemberFromPanel()` returned immediately after `.click()`, so the test raced the async fetch. Scenarios 2–5 hit the already-compiled route.

**Fix:** Updated `archiveMemberFromPanel(accept)` in the POM to `page.waitForResponse(...)` on the DELETE request when `accept=true`, up to 30s timeout. The click happens, the dialog accepts, the fetch completes, the POM returns, and only THEN does the test assert the panel close.

```ts
if (accept) {
  const responsePromise = this.page.waitForResponse(
    (res) =>
      res.url().includes('/api/members/') &&
      res.request().method() === 'DELETE',
    { timeout: 30_000 },
  )
  await this.archiveMemberBtn().click()
  await responsePromise
}
```

This is a general POM hygiene pattern — any async fetch triggered by a UI action should be awaited in the POM helper, not in the test.

### Round 2 — flake check

3 consecutive runs, all 7 tests green (includes 2 auth-setup):

| Run | Duration | Result |
|---|---|---|
| 1 | 47.5s | 7/7 ✅ |
| 2 | 49.2s | 7/7 ✅ |
| 3 | 48.3s | 7/7 ✅ |

### Round 3 — Members regression

Full Tier 3.5 + Tier 3.6 suite: **20/20 passing** (108s). Zero regressions from the Tier 3.7 changes:

- Tier 3.5 Create Member: 9/9 ✅
- Tier 3.6 Edit Member: 9/9 ✅
- Auth setup: 2/2 ✅

Notable: the Tier 3.6 Edit Member tests never touch `exclude_from_analytics`, so the new checkbox + delta-payload logic is a pure extension — the field is absent from the PUT body in every Tier 3.6 scenario and the `metadata.fields` array is unchanged.

---

## Files changed

### Production code

| File | Change |
|---|---|
| `apps/web/src/app/api/members/[id]/route.ts` | DELETE handler rewrite: role check, existingProfile fetch, idempotent short-circuit, `is_active: false` write, `description` non-null on activity_log, `type: 'member_deleted'`, capture-and-log on activityError, ai_cache invalidation |
| `apps/web/src/app/(admin)/members/_components/MemberProfilePanel.tsx` | Archive button: `data-testid`, URL uses `member.profileId` (BUG-013 narrow fix), EditMemberModal `initial` prop gets `exclude_from_analytics` |
| `apps/web/src/app/(admin)/members/_components/types.ts` | `Member.excludeFromAnalytics?: boolean` |
| `apps/web/src/app/(admin)/members/_components/EditMemberModal.tsx` | `EditFields.exclude_from_analytics`, `EditableInitial.exclude_from_analytics`, initial state + re-seed useEffect + delta-payload + checkbox UI with testid |
| `apps/web/src/app/(admin)/members/page.tsx` | Directory select extended (`exclude_from_analytics`), mapper extended, dropdown "Remove" button flipped from `member.id` to `member.profileId` (second BUG-013 fix from code review) |

### Test code

| File | Change |
|---|---|
| `apps/web/e2e/pages/MembersPage.ts` | Appended Tier 3.7 section: 4 helpers + `closeMemberPanel()` (Healer addition), `archiveMemberFromPanel(accept)` waits on DELETE response |
| `apps/web/e2e/members-archive-exclude.spec.ts` | NEW — 5 scenarios (~290 lines) |

### Specs

| File | Change |
|---|---|
| `specs/reports/members-archive-exclude-architect.md` | NEW — 8-step execution blueprint |
| `specs/reports/members-archive-exclude-report.md` | This file |

---

## Bugs

### BUG-014 — closed by this run
All 4 layers of the DELETE handler divergence fixed inline:
- L1 phantom `profiles.status` column → `is_active: false`
- L2 `activity_log.description` NULL violation → `Member archived: ${name}` non-null
- L3 `type = 'member_archived'` enum miss → `type = 'member_deleted'` + `metadata.action: 'archive'` marker
- L4 `member.id` vs `profile_id` URL mismatch → `member.profileId` (narrow Option B)

### BUG-013 — narrowed (not yet fully closed)
Tier 3.6 applied the narrow fix to the Edit button. Tier 3.7 extends that to:
- Panel Archive button
- Directory dropdown Remove button (discovered by code reviewer, fixed in same tier)

Still open: Pause button, Upgrade button, full-profile navigation link — all still pass `member.id`. Tier 4.2 (Memberships: Upgrade) and Tier 4.3 (Memberships: Downgrade) will exercise Pause/Upgrade end-to-end and will close the remaining panel surfaces.

### BUG-008 GAP-5 — closed by this run
The Exclude from Analytics UI is now wired end-to-end: DB column → directory mapper → Member type → panel prop → EditMemberModal initial state → checkbox → delta-payload → PUT allowlist → DB write → round-trip via page close + reopen.

---

## Design notes for future tiers

1. **The POM fetch-wait pattern is now canonical.** Any POM helper that triggers an async UI fetch should await the expected response before returning. Cold-compile is the canonical case this surfaces, but it also protects against network slowness and any non-determinism in promise scheduling. Future tiers should apply the same pattern to any POM action that triggers a POST/PUT/DELETE.

2. **Code review found both issues the spec didn't cover.** Scenario 5's Escape-key close and the directory dropdown's BUG-013 inheritance. Without the code reviewer step, Scenario 5 would have failed at Sentinel (catchable, one more iteration) and the dropdown 404 would have shipped to production undetected. The pipeline's Code Review → Healer phase structure continues to earn its place — it's cheaper than discovering the same issues at Sentinel.

3. **Panel-button ID trace, the Analyst checklist addition from Tier 3.6, proved its value immediately.** L4 of BUG-014 would otherwise have surfaced as a mysterious 404 at Sentinel-time. With the checklist item, it was caught at Analyst-time before a single line of test code was written. Three mandatory Tier 3+ Analyst probes + one code-trace checklist item are now the battle-tested gate for write features.

4. **The "silent swallow" pattern bites again.** Tier 3.1, 3.4, 3.5, 3.6, and now 3.7 have all surfaced failures of the same shape: Supabase JS client doesn't throw on insert/update errors, so missing NOT NULL columns or invalid enum values return silently and produce user-visible features that "work" in the UI but leave no audit trail. Tier 3.7's DELETE handler uses the established pattern: capture `{ error }` for user-visible writes (with rollback where applicable), capture `{ error }` for activity_log writes and `console.error` (no rollback — observability, not business-critical). Consider a dedicated Tier 8 audit that greps for `await supabase.from(...).(insert|update|delete)(...)` calls without a capture pattern.

5. **Tier 3.7 is the first tier where Engineer + Code Review + Sentinel all surfaced non-trivial bugs.** Three distinct failure modes caught by three distinct phases — and all three phases were necessary. If this keeps happening, the pipeline is tuned correctly.

---

## Tier 3 status

**6/12 → 7/12** (5 full, 2 gap-filed). Next: Tier 3.8 — Schedule: Create Class. This is the first schedule-module write feature, and will require a new `SchedulePage` POM from scratch. The `classes` schema is well-understood (Phase 1 complete), so the Analyst probes should fit the Tier 3+ pattern cleanly.
