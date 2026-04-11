# QA Report — Members Smoke (Tier 2.3)

**Pipeline ID:** `members-smoke`
**Tier:** 2.3 (Admin Smoke — 3 of 11)
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** ✅ COMPLETE — all phases green, no Healer iteration, no bugs found

---

## TL;DR

Both `/members` (directory) and `/members/[id]` (detail, not-found branch) mount under the admin shell with no pageerrors. 4 tests added. This is the first Tier 2 smoke to cover a **nested dynamic route** — the `/members/[id]` async server component — using a known-bogus UUID (`00000000-0000-0000-0000-000000000000`) to smoke the "member not found" fallback without requiring fixture seeding. Happy-path detail coverage is deferred to Tier 3.5. Per-spec effort: 2 testid seeds, 1 POM (63 lines), 1 spec (104 lines).

## What was tested

| # | Scenario | Priority | Type | Result |
|---|---|---|---|---|
| 1 | `/members` mounts — admin shell + `members-page-root` testid visible, no pageerrors | P0 | E2E smoke | ✅ PASS (0.7s) |
| 2 | `/members` remains stable after 1.5s idle — no deferred hydration crashes | P1 | E2E smoke | ✅ PASS (3.5s) |
| 3 | `/members` → "Add Member" header button rendered (content semantics) | P1 | E2E content | ✅ PASS (2.0s) |
| 4 | `/members/[bogus-uuid]` mounts + renders not-found fallback | P1 | E2E smoke | ✅ PASS (3.3s) |

**Coverage:** 100% of P0 (1/1) + 100% of P1 (3/3) = **4/4 tests passing**.

## Files changed

### Created
- `apps/web/e2e/members.spec.ts` — 4 tests, 104 lines
- `apps/web/e2e/pages/MembersPage.ts` — POM with `pageRoot()`, `detailRoot()`, `detailNotFound()`, `expectDirectoryMounted()`, `expectBogusDetailNotFound()`, and a `BOGUS_MEMBER_ID` export (63 lines)
- `specs/reports/members-smoke-report.md` — this report

### Modified
- `apps/web/src/app/(admin)/members/page.tsx` — seeded `data-testid="members-page-root"` on the top-level `<motion.div>` at line 419. Single return path, so only one seed needed.
- `apps/web/src/app/(admin)/members/[id]/_components/MemberProfileClient.tsx` — seeded two testids: `members-detail-not-found` on the null-member fallback div at line 386, and `members-detail-root` on the main `<motion.div>` at line 402. Two seeds because the component has two distinct render paths (found vs not-found); Tier 3.5 will use `members-detail-root` for happy-path coverage.

## Test run

### First run
```
Running 6 tests using 1 worker  (2 auth-setup + 4 members)

  ✓  [admin] /members mounts @p0 (727ms)
  ✓  [admin] /members stable after 1.5s idle @p1 (3.5s)
  ✓  [admin] /members → Add Member button rendered @p1 (2.0s)
  ✓  [admin] /members/[bogus-uuid] mounts + renders not-found fallback @p1 (3.3s)

  6 passed (23.4s)
```

### Flake check — `--repeat-each=3`
```
Running 14 tests using 1 worker  (2 auth-setup + 4 members × 3 repeats)
  14 passed (36.6s)
```
**Flake count: 0/14.**

### Full admin project — regression suite
```
Running 21 tests using 1 worker
  (2 auth-setup + 4 command-center + 3 schedule + 4 members + 4 logout + 4 session-refresh)
  21 passed (50.1s)
```
**No regression in prior-tier suites.**

### Anonymous regression
```
Running 13 tests using 1 worker
  (2 auth-setup + 8 login + 4 middleware-redirect - wait: 8+4=12, actual 13 includes login-render as well)
  13 passed (15.9s)
```

## Bugs found

None.

## Design notes

### Why a bogus UUID for the detail page

The `/members/[id]` route is a Next.js async server component that filters by `.eq('studio_id', DEFAULT_STUDIO_ID)` (the BUG-001 coupling). Seeding a real member row for this smoke would require either (a) waiting for the BUG-001 refactor, or (b) extending `db.ts` fixtures to seed into `DEFAULT_STUDIO_ID` — which the Tier 0 parameterization already does, but seeding-per-test feels heavy for a smoke.

The cleaner approach: hit the route with `00000000-0000-0000-0000-000000000000`, a well-formed UUID that won't match any row. This exercises:
- Next.js routing for the `/members/[id]` pattern
- Server component compilation and execution
- Supabase's `.single()` with zero rows (returns `{ data: null, error: {...} }`, not a throw)
- The server component's `let member: MemberProfile | null = null` fallback path
- The `<MemberProfileClient member={null} .../>` pass-through
- The client component's `if (!member) return <NotFound/>` branch
- End-to-end admin-shell mount

Happy-path coverage (valid member, full profile rendered) is Tier 3.5's responsibility.

### Why two testids on MemberProfileClient

The component has two distinct top-level return paths:
1. `if (!member)` → `<div data-testid="members-detail-not-found">`
2. `return <motion.div data-testid="members-detail-root">` (happy path)

Tier 2.3 uses the first. Tier 3.5 will use the second. Naming them separately means tests can distinguish "page rendered fallback" from "page rendered happy path" without brittle text matching.

## Follow-up work

- All previously-filed follow-ups (BUG-001 through BUG-005, `handleSupabaseAuthError` cleanup, middleware→proxy migration, missing `public.increment_rate_limit`) remain open.
- No new findings from this run.

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline | ✅ 4 scenarios designed (directory mount + stability + content + detail not-found) |
| 2 — Architect | inline | ✅ Plan: 2 testid seeds across 2 files, 1 POM extending BasePage, 1 spec consuming shared Tier 2 infra |
| 3 — Engineer | inline | ✅ Tests written; 4/4 passing on first run |
| 4 — Sentinel | inline | ✅ PASS — 0/14 flake check, 21/21 admin regression, 13/13 anonymous regression |
| 5 — Healer | — | SKIPPED (no failures) |
| 6 — Scribe | inline | ✅ This report |

**Run time:** single session. Playwright time: ~23s first run + ~37s flake + ~50s admin + ~16s anonymous = ~126s.
