# QA Report — Middleware Protected-Route Redirect

**Pipeline ID:** `middleware-redirect`
**Tier:** 1.2 (Auth & Session)
**Project:** `anonymous`
**Run date:** 2026-04-09
**Status:** ✅ COMPLETE — all phases green

---

## TL;DR

Meridian's Next.js middleware (`apps/web/src/middleware.ts`) correctly protects routes: unauthenticated page requests are redirected to `/login?redirect=<path>`, and unauthenticated `/api/*` requests return a JSON `401`. Five tests added. All pass. Zero flakes in a 3× repeat run. No regression in the existing login suite.

## What was tested

| # | Scenario | Priority | Type | Result |
|---|---|---|---|---|
| 1 | Unauth root (`/`) → `/login?redirect=/` + form visible | P0 | E2E page | ✅ PASS (515ms first run, ~220ms steady) |
| 2 | Unauth admin route `/members` → path preserved in `redirect` param | P0 | E2E page | ✅ PASS (230ms) |
| 3 | Unauth employee route `/employee` → path preserved in `redirect` param | P0 | E2E page | ✅ PASS (228ms) |
| 4 | Unauth protected API `/api/bookings` → `401 {"error":"Unauthorized"}` JSON (no redirect) | P0 | API request | ✅ PASS (22ms) |
| 5 | Public `/login` renders without redirect loop | P1 | E2E page | ✅ PASS (251ms) |

**Coverage:** 100% of P0 (4/4) + 100% of P1 (1/1) = **5/5 tests passing**.

## What was NOT tested (deferred — see spec §5 & §7)

- Post-login redirect fulfillment — the login page currently **ignores** `searchParams.get('redirect')` and hardcodes its destination by role. This is a real bug, filed separately (see "Bugs found" below). Testing it today would write tests that fail — better to fix the page first and add tests at that time.
- Query strings on the original URL (e.g., `/members?tab=active`) — middleware drops them (only pathname is preserved). Worth a follow-up test.
- Already-authenticated user visits `/login` — belongs in Tier 1.4 (session refresh).
- Per-webhook auth for public API allowlist (Stripe signature, cron secret, etc.) — belongs in Tier 8 (platform/stress).

## Files changed

### Created
- `apps/web/e2e/middleware-redirect.spec.ts` — 5 tests, 77 lines
- `specs/features/middleware-redirect-spec.md` — Analyst spec
- `specs/reports/middleware-redirect-report.md` — this report

### Modified
- `apps/web/e2e/pages/BasePage.ts` — added `expectRedirectToLogin(originalPath: string)` helper (Tier 1 gate requirement)
- `apps/web/playwright.config.ts` — broadened `anonymous.testMatch` from a single regex to an array `[/login.*\.spec\.ts/, /middleware-redirect.*\.spec\.ts/]` so the new spec is picked up by the anonymous project

### Not modified (and why)
- `apps/web/src/middleware.ts` — no changes needed; behavior was already correct
- `apps/web/src/app/(auth)/login/page.tsx` — no testid seeding needed; the existing `login-email-input` testid from the login pilot is reused to verify landing
- `apps/web/e2e/pages/LoginPage.ts` — no new methods needed (inherits `expectRedirectToLogin` from BasePage)

## Test run

### First full run
```
Running 5 tests using 1 worker

  ✓  1 unauthenticated root (/) redirects to /login with redirect=/ @p0 (515ms)
  ✓  2 unauthenticated admin route /members preserves path in redirect param @p0 (230ms)
  ✓  3 unauthenticated employee route /employee preserves path in redirect param @p0 (228ms)
  ✓  4 unauthenticated protected API returns JSON 401 (no redirect) @p0 (22ms)
  ✓  5 public /login renders without redirect loop @p1 (251ms)

  5 passed (5.6s)
```

### Full anonymous project (regression check)
```
Running 13 tests using 1 worker
  ✓ login.spec.ts (8/8)
  ✓ middleware-redirect.spec.ts (5/5)
  13 passed (15.7s)
```

### Flake check — `--repeat-each=3`
```
Running 15 tests using 1 worker
  15 passed (9.0s)
```

**Flake count: 0/15.** The API test is the fastest (~20ms) because it skips browser boot.

## Healing summary

**No healing required.** Sentinel passed on first review. All 5 tests written, passed immediately, and stayed green across the regression run and the 3× flake check. The Engineer phase was informed by the Analyst's clarification log (especially CL-4 on `/api/members` vs `/api/bookings`), which prevented a dead-path test from being written.

## Bugs found

### BUG-002 — Login page ignores `?redirect=` query param

**Severity:** P1 (behavioral bug, not blocking tests)
**File:** `apps/web/src/app/(auth)/login/page.tsx`
**Lines:** 44–60 (`handlePasswordSignIn`)

**Description:** The middleware correctly sets `url.searchParams.set("redirect", pathname)` before the 307 bounce. But the login page's post-success logic hardcodes `destination = "/"` (admin) or `"/employee"` (trainer) based on role, completely ignoring the `redirect` query parameter. Users who arrive at the login page via a deep-link bounce land on the generic dashboard instead of the route they originally wanted.

**Reproduction:**
1. Log out.
2. Visit `/members` — middleware redirects to `/login?redirect=%2Fmembers`.
3. Sign in with admin credentials.
4. **Expected:** land on `/members`.
5. **Actual:** land on `/` (command center).

**Proposed fix (not done in this run):**
```ts
const searchParams = useSearchParams();
// ...
const requested = searchParams?.get('redirect');
// SECURITY: only honor same-origin relative paths — reject absolute URLs,
// protocol-relative URLs, and paths starting with `//` to prevent open-redirect.
const safeRedirect =
  requested && requested.startsWith('/') && !requested.startsWith('//')
    ? requested
    : null;
let destination = safeRedirect ?? '/';
// ... then role-based routing only if safeRedirect is null
```

**Security note:** Any fix MUST validate that `redirect` is a same-origin relative path. Blindly using `router.push(searchParams.get('redirect'))` would open a classic [open-redirect vulnerability](https://owasp.org/www-community/attacks/Unvalidated_Redirects_and_Forwards).

**Follow-up:** Should be part of Tier 1.3 (Logout flow) or a dedicated ticket — not retrofitted into this run.

## Follow-up work

1. **Wire `?redirect=` into login page destination logic** (BUG-002 above) — with open-redirect hardening.
2. **Preserve query string in redirect** — middleware uses `request.nextUrl.clone()` then only sets `pathname` + `searchParams.set('redirect', pathname)`. Original URL params (e.g., `?tab=active`) are dropped. Low priority, but worth a test once fixed.
3. **Session-expiry test** (Tier 1.4) — should use this same `expectRedirectToLogin()` helper. The helper's location on `BasePage` was deliberate so future Tier 1.x specs can call it without importing `LoginPage`.
4. **Protected API with malformed auth cookie** — out of scope for middleware redirect, but worth a spec when Tier 1.4 covers session refresh.

## How to run these tests

```bash
# Just middleware redirect (5 tests)
cd apps/web
npx playwright test --project=anonymous middleware-redirect

# Full anonymous project (login + middleware = 13 tests)
npx playwright test --project=anonymous

# Flake check
npx playwright test --project=anonymous middleware-redirect --repeat-each=3
```

No seeding or fixture setup is required — the `anonymous` project has no `storageState` and no `auth-setup` dependency, so each test starts from a fresh unauthenticated browser context.

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline (main context) | ✅ Spec written (`middleware-redirect-spec.md`), 5 scenarios locked, 4 clarifications documented |
| 2 — Architect | inline | ✅ Plan: 2 files modified (BasePage, playwright.config), 1 file created (spec), 0 testids needed |
| 3 — Engineer | inline | ✅ 5 tests written, TypeScript clean, 5/5 passing on first run |
| 4 — Sentinel | inline | ✅ PASS — zero forbidden patterns, 0 flakes in 3× repeat, no regression in login suite |
| 5 — Healer | — | SKIPPED (Sentinel passed) |
| 6 — Scribe | inline | ✅ This report |

**Run time (Engineer → Scribe):** single session. Total wall-clock for test execution: 5.6s (first run) + 9.0s (3× flake) + 15.7s (full anonymous regression) = ~30s of Playwright time.
