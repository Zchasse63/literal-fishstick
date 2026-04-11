# QA Report — Schedule Smoke (Tier 2.2)

**Pipeline ID:** `schedule-smoke`
**Tier:** 2.2 (Admin Smoke — 2 of 11)
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** ✅ COMPLETE — all phases green, no Healer iteration, no bugs found

---

## TL;DR

The Schedule page (`/schedule`) mounts under the admin shell with no pageerrors, stable hydration, and a visible Week view-mode button. 3 tests added. This is the first Tier 2 smoke that **consumes the shared infrastructure** (`expectSmokeMount`, `adminShellLandmark`) without building new helpers — validating that the Tier 2.1 pattern scales as intended. Total per-spec effort: 1 testid seed, 1 POM (28 lines), 1 spec (69 lines). 

## What was tested

| # | Scenario | Priority | Type | Result |
|---|---|---|---|---|
| 1 | `/schedule` mounts — admin shell + `schedule-page-root` testid visible, no pageerrors | P0 | E2E smoke | ✅ PASS (1.6s) |
| 2 | `/schedule` remains stable after 1.5s idle — no deferred hydration crashes | P1 | E2E smoke | ✅ PASS (3.3s) |
| 3 | `/schedule` → "Week" view-mode button rendered (content semantics) | P1 | E2E content | ✅ PASS (1.8s) |

**Coverage:** 100% of P0 (1/1) + 100% of P1 (2/2) = **3/3 tests passing**.

## Files changed

### Created
- `apps/web/e2e/schedule.spec.ts` — 3 tests, 69 lines
- `apps/web/e2e/pages/SchedulePage.ts` — POM with `pageRoot()`, `expectMounted()` (28 lines)
- `specs/reports/schedule-smoke-report.md` — this report

### Modified
- `apps/web/src/app/(admin)/schedule/page.tsx` — seeded `data-testid="schedule-page-root"` on the single top-level `<motion.div>` (line 669). Unlike Command Center, SchedulePage has a single render path (loading state is nested, not a separate return), so only one testid was needed.

## Test run

### First run
```
Running 5 tests using 1 worker  (2 auth-setup + 3 schedule)

  ✓  schedule.spec.ts:23 › /schedule mounts @p0 (1.6s)
  ✓  schedule.spec.ts:34 › /schedule stable after 1.5s idle @p1 (3.3s)
  ✓  schedule.spec.ts:56 › /schedule → Week button rendered @p1 (1.8s)

  5 passed (20.8s)
```

### Flake check — `--repeat-each=3`
```
Running 11 tests using 1 worker  (2 auth-setup + 3 schedule × 3 repeats)
  11 passed (31.7s)
```
**Flake count: 0/11.**

### Full admin project — regression suite
```
Running 17 tests using 1 worker
  (2 auth-setup + 4 command-center + 3 schedule + 4 logout + 4 session-refresh)
  17 passed (43.3s)
```
**No regression in prior-tier suites.**

## Bugs found

None.

## Follow-up work

- All previously-filed follow-ups (BUG-001 through BUG-005, `handleSupabaseAuthError` cleanup, middleware→proxy migration, missing `public.increment_rate_limit`) remain open.
- No new findings from this run.

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline | ✅ 3 scenarios designed (mount + stability + content) |
| 2 — Architect | inline | ✅ Plan: 1 testid seed, 1 POM extending BasePage, 1 spec consuming shared Tier 2 infra |
| 3 — Engineer | inline | ✅ Tests written; 3/3 passing on first run |
| 4 — Sentinel | inline | ✅ PASS — 0/11 flake check, 17/17 admin regression |
| 5 — Healer | — | SKIPPED (no failures) |
| 6 — Scribe | inline | ✅ This report |

**Run time:** single session. Playwright time: ~21s first run + ~32s flake + ~43s full admin = ~96s.
