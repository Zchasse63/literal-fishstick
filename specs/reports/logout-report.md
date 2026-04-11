# QA Report — Logout Flow (Admin Sidebar)

**Pipeline ID:** `logout`
**Tier:** 1.3 (Auth & Session)
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** ✅ COMPLETE — all phases green (Healer ran 2 iterations)

---

## TL;DR

A signed-in admin can click the sidebar's "Sign out" button, be returned to a clean `/login` URL, and subsequent protected requests (page OR API) are re-enforced by middleware. Four tests added. All pass. Zero flakes in a 3× repeat run. Two Healer iterations were required: (1) mocking Supabase's global-scope logout endpoint to prevent storage-state poisoning, and (2) swapping `waitForURL` for polling-based `toHaveURL` to tolerate in-flight request aborts during hard navigation. Both fixes landed in `LoginPage.ts` and are reusable by every future admin spec that calls `logout()`.

## What was tested

| # | Scenario | Priority | Type | Result |
|---|---|---|---|---|
| 1 | Admin clicks sidebar "Sign out" → lands on clean `/login` (no `redirect` param) | P0 | E2E page | ✅ PASS (3.4s) |
| 2 | After logout, revisiting `/` bounces back to `/login?redirect=%2F` | P0 | E2E page | ✅ PASS (3.5s) |
| 3 | After logout, protected API request (`/api/bookings`) via `page.request` returns 401 | P0 | API (context-aware) | ✅ PASS (3.6s) |
| 4 | "Sign out" button is visible, enabled, and has `aria-label="Sign out"` | P1 | E2E a11y | ✅ PASS (1.3s) |

**Coverage:** 100% of P0 (3/3) + 100% of P1 (1/1) = **4/4 tests passing**.

## What was NOT tested (deferred — see spec §5 & §7)

- **Double-click logout race** — second click lands on `/login` where the button doesn't exist. Deferred to Tier 8 (stress / multi-click race coverage).
- **Logout while a background request is in-flight** — would require a slow-API mock. Out of scope for this run.
- **Logout with collapsed sidebar** — button is hidden when `collapsed=true`. Tests assume default (expanded) state which matches real UX.
- **Logout from employee portal** — **no UI surface exists.** Filed as BUG-003 (see below).
- **Logout when Supabase is unreachable** — `signOut()` error path. Meridian swallows errors and still runs `window.location.href = '/login'`, so user-observable contract is identical. Out of scope.
- **Multi-tab session invalidation** — requires two browser contexts. Deferred to Tier 1.4 (session refresh).

## Files changed

### Created
- `apps/web/e2e/logout.spec.ts` — 4 tests, 92 lines
- `specs/features/logout-spec.md` — Analyst spec with 5 clarifications
- `specs/reports/logout-report.md` — this report

### Modified
- `apps/web/e2e/pages/LoginPage.ts` — added two helpers:
  - `mockLogoutServerCall()` — intercepts `**/auth/v1/logout**` with synthetic 204 (prevents storage-state poisoning, see Healer section)
  - `logout()` — clicks sidebar sign-out, polls for `/login` URL, asserts login form visible (reusable by all future admin specs)

### Not modified (and why)
- `apps/web/src/components/layout/sidebar.tsx` — **no testid seeded.** The button already has `aria-label="Sign out"`. Per `AGENTS.md` §6: "Prefer `getByRole` / `getByLabel` / `getByText` when the element has a clear accessible identity."
- `apps/web/src/app/(auth)/login/page.tsx` — no changes. Scenario 4's visibility assertion reuses the existing `login-email-input` testid from the login pilot.
- `apps/web/src/middleware.ts` — no changes; middleware behavior was already verified in Tier 1.2.
- `apps/web/playwright.config.ts` — no changes. The `admin` project's `testMatch` already picks up `*.spec.ts` in `e2e/` (it's `anonymous` that's restricted).

## Test run

### Final full run (admin project — logout only)
```
Running 6 tests using 1 worker  (2 auth-setup + 4 logout)

  ✓  auth.setup.ts › authenticate as admin (5.2s)
  ✓  auth.setup.ts › authenticate as employee (1.1s)
  ✓  logout.spec.ts:28 › admin clicks sidebar sign out and lands on /login @p0 (3.4s)
  ✓  logout.spec.ts:40 › after logout, revisiting / bounces back to /login?redirect=/ @p0 (3.5s)
  ✓  logout.spec.ts:54 › after logout, protected API request via page.request returns 401 @p0 (3.6s)
  ✓  logout.spec.ts:72 › sign out button is visible, enabled, and has correct aria-label @p1 (1.3s)

  6 passed (16.9s)
```

### Flake check — `--repeat-each=3`
```
Running 14 tests using 1 worker  (2 auth-setup + 4 tests × 3 repeats)

  14 passed (27.9s)
```

**Flake count: 0/14.**

### Full anonymous regression (backslide guard)
```
Running 13 tests using 1 worker
  ✓ login.spec.ts (8/8)
  ✓ middleware-redirect.spec.ts (5/5)
  13 passed (15.7s)
```

No regression in the anonymous project from the `LoginPage.ts` modifications.

## Healing summary

**Healer ran 2 iterations. Both fixes are now reusable infrastructure for every future admin spec.**

### Iteration 1 — Storage state poisoning

**Symptom:** Test 1 passed on first run. Tests 2, 3, and 4 failed with "Sign out button not visible" — the `error-context.md` Playwright snapshot showed the `/login` page (Meridian heading, Sign in form) instead of the admin command center.

**Root cause:** Supabase's `auth.signOut()` defaults to `scope: 'global'`, which calls `POST /auth/v1/logout` to invalidate the refresh token **server-side** for all sessions. Flow:

1. Test 1 clicks the real sign-out button. Supabase's SDK sends a real `POST /auth/v1/logout` which invalidates the refresh token stored in `e2e/.auth/admin.json`.
2. Test 2 loads `admin.json` (Playwright's `storageState` loads it fresh per test), tries to use the now-invalidated refresh token.
3. Supabase rejects the refresh → middleware sees no valid session → bounces to `/login`.
4. Test 2 expects the sidebar to be visible → sidebar doesn't exist on `/login` → fail.
5. Tests 3 and 4 cascade-fail for the same reason.

**Fix:** Added `LoginPage.mockLogoutServerCall()` to intercept `**/auth/v1/logout**` and return a synthetic 204. The Supabase JS SDK clears local cookies **regardless** of whether the server call succeeded, so the client-side contract (cookies gone from the browser context, middleware re-enforces on subsequent navigation) is still exercised for real — which is the actual behavior we care about.

Every test in `logout.spec.ts` now calls `mockLogoutServerCall()` **before** `goto('/')` so the route is registered before any network traffic fires. Also re-ran `npx playwright test --project=auth-setup` to regenerate a clean `admin.json`.

### Iteration 2 — `ERR_ABORTED` during hard navigation

**Symptom:** With the mock in place, Tests 1–4 got further, but `LoginPage.logout()` failed with `net::ERR_ABORTED; maybe frame was detached?` on `waitForURL(/\/login/)`.

**Root cause:** The sidebar's sign-out handler calls `window.location.href = '/login'`, which is a **hard** navigation that tears down the entire document. In-flight data fetches on the command center (e.g. the KPI hook at `src/hooks/use-kpi-data.ts:170`) get aborted as part of the unload. Playwright's `waitForURL` listens to the navigation event stream and surfaces those aborts as `ERR_ABORTED` — even though the user-observable outcome (arriving at `/login`) is correct.

**Fix attempt 1:** Wrap `waitForURL` + `click` in `Promise.all()` to arm the listener before the click fires. Still failed — the aborted in-flight request throws regardless of listener ordering.

**Fix attempt 2 (final):** Replace `waitForURL` with polling-based `expect(page).toHaveURL(/\/login/, { timeout: ANIM_TIMEOUT })`. `toHaveURL` polls the URL value instead of listening to navigation events, so it is tolerant to transient aborts during unload. Eventually the URL settles on `/login` and the assertion passes. Followed by a visibility assertion on `login-email-input` to prove the new document actually rendered (not just that the URL string changed).

Rationale documented inline in `LoginPage.ts` so the next person who touches this doesn't try to "optimize" it back to `waitForURL`.

## Bugs found

### BUG-003 — Employee portal has no logout button

**Severity:** P1 (UX gap, not blocking tests)
**File:** `apps/web/src/app/(employee)/layout.tsx` (lines 170–206)

**Description:** The employee shell's sidebar has a "Switch to Admin" link, a dark-mode toggle, and a user identity pill — but **no sign-out button**. Employees are stranded once signed in. They must manually visit `/login` or close the browser tab to re-authenticate.

**Observable:**
- No `signOut` reference anywhere in the file
- No `LogOut` icon imported
- No `aria-label="Sign out"` element

**Proposed fix:**
Add a parallel sign-out button in the employee sidebar with the same handler pattern as `src/components/layout/sidebar.tsx:138–151` and `aria-label="Sign out"`. This lets the existing `LoginPage.logout()` helper handle both admin and employee projects without modification.

**Follow-up:** When the button is added, extend `logout.spec.ts` (or add a parallel `logout-employee.spec.ts` under the `employee` project) using the same 4 scenarios. The helper's selector (`getByRole('button', { name: 'Sign out' })`) will automatically find the new button.

## Follow-up work

1. **BUG-003** — Employee portal logout button (above). Should be a 1-commit fix.
2. **Multi-tab logout propagation** — Supabase broadcasts auth state across tabs via `BroadcastChannel`. Testing this requires two browser contexts and belongs in Tier 1.4 (session refresh / expired session).
3. **Logout during in-flight writes** — The hard navigation interrupts any pending mutations. Meridian's revenue and booking flows should idempotent-ize critical writes, but that's out of scope for a logout spec. Deferred to Tier 8 stress.
4. **`signOut({ scope: 'global' })` audit** — The mock we added in this run masks the real server call. If we ever add a UI feature for "sign out from all devices", that code path will need its own spec that does NOT mock the endpoint — and will need a way to re-seed `admin.json` as teardown.
5. **Missing Supabase RPC** — During the run, the dev DB logged `[rate-limit] RPC error, failing open: Could not find the function public.increment_rate_limit`. The rate limiter fails open (doesn't block requests) so it didn't affect tests, but the function should be added to the migration set. Filed as a separate dev-infra task.

## How to run these tests

```bash
# Just logout (4 tests + 2 auth-setup = 6 total)
cd apps/web
npx playwright test --project=admin logout

# Full admin project (auth-setup + logout = 6 total, no admin smoke specs yet)
npx playwright test --project=admin

# Flake check
npx playwright test --project=admin logout --repeat-each=3

# Regression check on anonymous project (verify LoginPage.ts changes didn't backslide login/middleware-redirect)
npx playwright test --project=anonymous
```

**IMPORTANT:** If you run the suite WITHOUT `mockLogoutServerCall()` even once, `admin.json` will be poisoned and every subsequent admin test will fail with `Sign out button not visible`. Recovery is `npx playwright test --project=auth-setup` to regenerate the storage state.

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline (main context) | ✅ Spec written (`logout-spec.md`), 4 scenarios locked, 5 clarifications documented, BUG-003 surfaced |
| 2 — Architect | inline | ✅ Plan: 1 POM extension (`LoginPage.logout()` per Tier 1 gate), 1 spec created, 0 testids needed, 0 source files modified |
| 3 — Engineer | inline | ✅ 4 tests written, TypeScript clean, 1/4 passing on first run (3 failures → Healer) |
| 4 — Sentinel | inline | 🚫 BLOCKED — 3/4 tests failing (storage state poisoning) |
| 5 — Healer | inline | ✅ 2 iterations: (1) `mockLogoutServerCall()` added, (2) `waitForURL` → `toHaveURL` swap. Final: 4/4 passing, 14/14 flake |
| 6 — Scribe | inline | ✅ This report |

**Run time (Engineer → Scribe):** single session. Total wall-clock for test execution: 16.9s (final run) + 27.9s (3× flake) + 15.7s (anonymous regression) + ~15s of healer iterations = ~75s of Playwright time across all attempts.
