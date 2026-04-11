# QA Report — Session Refresh / Expired Session

**Pipeline ID:** `session-refresh`
**Tier:** 1.4 (Auth & Session) — **TIER 1 COMPLETE**
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** ✅ COMPLETE — all phases green, no Healer iteration

---

## TL;DR

Meridian's middleware correctly re-enforces authentication when a session becomes invalid mid-browse — whether by cleared cookies, tampered cookies, or (presumed, not directly tested) server-side refresh rejection. Pages bounce to `/login?redirect=<path>`, APIs return `401 JSON`. Four tests added. All pass first run. Zero flakes in a 3× repeat run. **Two `LoginPage` helpers added** (`clearAuthCookies`, `tamperAuthCookie`) which are reusable for any future test that needs to simulate session expiry. **One pre-existing playwright.config.ts misconfiguration fixed** — `middleware-redirect.spec.ts` was leaking into the `admin` project because that project's `testIgnore` only excluded `login.spec.ts`. This report's regression run was the first time the full admin project was run without a filter, which surfaced it. **Tier 1 (Auth & Session) is now complete: 4/4 council runs green, 21 total tests across login + middleware-redirect + logout + session-refresh.**

## What was tested

| # | Scenario | Priority | Type | Result |
|---|---|---|---|---|
| 1 | Admin loads `/`, clears auth cookies, navigates to `/members` → `/login?redirect=/members` + form visible | P0 | E2E page | ✅ PASS (925ms) |
| 2 | Admin loads `/`, clears auth cookies, `page.request.get('/api/bookings')` → `401 {"error":"Unauthorized"}` | P0 | API (context-aware) | ✅ PASS (648ms) |
| 3 | Admin has tampered auth cookie (value replaced with `"tampered-not-a-valid-jwt"`), visits `/` → `/login?redirect=/` (NOT 500) | P0 | E2E page (defensive) | ✅ PASS (734ms) |
| 4 | Already-authenticated admin visits `/login` → form renders (gap guard, BUG-004) | P1 | E2E page | ✅ PASS (362ms) |

**Coverage:** 100% of P0 (3/3) + 100% of P1 (1/1) = **4/4 tests passing**.

## What was NOT tested (deferred — see spec §4–§5)

- **Refresh token rejection via `POST /auth/v1/token?grant_type=refresh_token` mock** — with a fresh `admin.json`, the access token isn't near expiry so no refresh call fires on the first page visit. Would require either a time-travel helper or a synthetic session with a pre-expired access token. Deferred to Tier 8 or a dedicated Supabase mock infra run.
- **Multi-tab session invalidation propagation** — requires two browser contexts and either `BroadcastChannel` or `onAuthStateChange` listener wiring. Deferred.
- **Partial chunked cookie corruption** — Supabase chunks large sessions into `.0`, `.1`, etc. Tampering only one chunk while leaving others intact would test the chunk-reassembler's error path. Not covered; scenario 3 tampers all chunks atomically.
- **Access-token-signed-by-wrong-instance scenarios** — requires crafting JWTs manually. Tier 8 adversarial.
- **Profile row deleted but auth session valid** — `getUser()` succeeds, but layout code that queries `profiles` fails. Would surface a layout-level 500. Separate test with a seed fixture that deletes the profile.

## Files changed

### Created
- `apps/web/e2e/session-refresh.spec.ts` — 4 tests, 109 lines
- `specs/features/session-refresh-spec.md` — Analyst spec with 6 clarifications
- `specs/reports/session-refresh-report.md` — this report

### Modified
- `apps/web/e2e/pages/LoginPage.ts` — added two helpers:
  - `clearAuthCookies(): Promise<string[]>` — filters `sb-*-auth-token*` cookies from the browser context and removes them (safer than `context.clearCookies()` which nukes everything)
  - `tamperAuthCookie(): Promise<string[]>` — replaces auth cookie values with garbage so the middleware's Supabase parser returns `{ user: null }`
- `apps/web/playwright.config.ts` — added `/middleware-redirect.*\.spec\.ts/` to the `admin` project's `testIgnore`, and rewrote the comment to explain which specs are anonymous-only and why

### Not modified (and why)
- `apps/web/src/middleware.ts` — no changes needed; behavior was already correct, even for malformed cookies
- `apps/web/src/app/(auth)/login/page.tsx` — BUG-004 is a documented follow-up, not fixed in this run. Scenario 4 captures current behavior.
- `apps/web/src/lib/supabase/client.ts` — `handleSupabaseAuthError` remains dead code; cleanup deferred

## Test run

### Final full run (admin project — session-refresh only)
```
Running 6 tests using 1 worker  (2 auth-setup + 4 session-refresh)

  ✓  auth.setup.ts › create admin session (4.8s)
  ✓  auth.setup.ts › create employee session (3.6s)
  ✓  session-refresh.spec.ts:29 › cookies cleared → bounces to /login @p0 (925ms)
  ✓  session-refresh.spec.ts:48 › cookies cleared → API returns 401 @p0 (648ms)
  ✓  session-refresh.spec.ts:67 › malformed cookie → bounces to /login (no 500) @p0 (734ms)
  ✓  session-refresh.spec.ts:92 › authenticated /login → form renders (gap guard) @p1 (362ms)

  6 passed (16.1s)
```

### Flake check — `--repeat-each=3`
```
Running 14 tests using 1 worker  (2 auth-setup + 4 tests × 3 repeats)

  14 passed (21.1s)
```

**Flake count: 0/14.**

### Full admin project — regression suite
```
Running 10 tests using 1 worker  (2 auth-setup + 4 logout + 4 session-refresh)

  10 passed (20.0s)
```

### Full anonymous project — regression suite
```
Running 13 tests using 1 worker  (8 login + 5 middleware-redirect)

  13 passed (15.1s)
```

**No regression in the anonymous project from the LoginPage.ts or playwright.config.ts modifications.**

## Healing summary

**No Healer iteration required.** Sentinel passed on first review of the test code. Both LoginPage helpers worked correctly on first run, `expectRedirectToLogin` cleanly handled all three P0 scenarios, and the gap guard (scenario 4) passed as expected.

### However — the full admin regression surfaced a pre-existing playwright.config.ts misconfiguration

When running `npx playwright test --project=admin` (no filter), 4 middleware-redirect tests failed because the admin project was picking them up. Middleware-redirect tests were designed for the `anonymous` project — they expect NO session cookies — but the admin project's `testIgnore` only excluded `login.spec.ts`, not `middleware-redirect.spec.ts`.

**Failure pattern:**
- Tests 1–3 (page-nav tests): admin has a valid session, so `/` doesn't redirect → `expectRedirectToLogin` failed
- Test 4 (API via `request` fixture): Playwright's `request` fixture inherits `storageState` from the project config, so under admin it had valid cookies → `/api/bookings` returned 500 (likely a pre-existing route-handler issue when the admin session queries against the studio with no seeded data, OR the studio-context handling throws when it sees the admin's production-like session on a dev DB). Either way, not the `401` the test expected.

**This is NOT a regression** — Tier 1.2 only ran `--project=anonymous` for its regression check, and Tier 1.3 only ran `--project=admin logout` (path filter). Neither ever ran the unfiltered admin project. Tier 1.4 is the first council run to do so, because Tier 1 is now "complete" and a full regression sweep matters more.

**Fix:** Add `/middleware-redirect.*\.spec\.ts/` to the admin project's `testIgnore` array, mirroring the existing `login.spec.ts` pattern. Also improved the inline comment to explicitly list anonymous-only specs and explain why they're excluded, so future council runs don't have to rediscover this.

**Follow-up observation (not filed as a bug):** When the `request` fixture under the admin project called `/api/bookings`, the route returned 500 instead of 200. This is suspicious — it suggests either:
  1. The admin user's studio has no seeded booking data AND the route handler crashes on empty arrays instead of returning `[]`, OR
  2. The route handler reads a required env var / studio context that's missing in the test DB

Worth investigating in Tier 2 (Admin Smoke), especially when Tier 2.1 (Command Center smoke) lights up — if the KPI route returns 500 there too, that confirms a real handler bug.

## Bugs found

### BUG-004 — Login page does not redirect already-authenticated users

**Severity:** P1 (UX gap, not blocking tests)
**File:** `apps/web/src/app/(auth)/login/page.tsx`
**Lines:** entire file — missing the redirect-if-authenticated guard

**Description:** The login page's default export is a pure client component with no `useEffect` or server-component check that redirects signed-in users to the appropriate destination. When an already-authenticated user navigates to `/login` (accidentally, via bookmark, from a stale browser tab, etc.), they see the sign-in form — which looks like they've been signed out even though their session is fine.

**Reproduction:**
1. Sign in as admin.
2. Visit `/login` directly (type the URL or click a bookmark).
3. **Expected:** immediate redirect to `/` (or `/employee` for trainers).
4. **Actual:** the login form renders. If the user re-enters credentials and submits, they do a redundant sign-in.

**Proposed fix (not done in this run):**
Add a top-of-component effect:
```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (cancelled || !user) return;
    const { data: profileData } = await supabase
      .from("profiles").select("roles").eq("id", user.id).single();
    const roles: string[] = profileData?.roles ?? [];
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r));
    const destination = searchParams?.get('redirect')
      ?? (hasAdminRole ? '/' : '/employee');
    // Same open-redirect hardening as BUG-002's proposed fix
    const safeDest = /^\/[^/]/.test(destination) ? destination : '/';
    router.replace(safeDest);
  })();
  return () => { cancelled = true; };
}, []);
```

Combined with BUG-002's fix (honoring `?redirect=` on post-signin routing), this also makes the login page the natural redirect-aware home for the whole auth flow.

**Security note:** As with BUG-002, any use of `searchParams.get('redirect')` must validate it's a same-origin relative path. An attacker who can construct a `/login?redirect=https://evil.com` link otherwise gets a free open-redirect.

**Regression guard in place:** Scenario 4 of this run (`already-authenticated admin visiting /login sees the form @p1`) asserts the current buggy behavior so the fix can't ship without updating the test. When fixing, flip the assertions from "form visible" to "URL is /" and add a separate test for the `?redirect=` path.

## Follow-up work

1. **BUG-004** — Login page redirect-if-authenticated (above). Pair with BUG-002 (Tier 1.2's login redirect param handling) since both touch the same file.
2. **`handleSupabaseAuthError` dead code cleanup** — `src/lib/supabase/client.ts:21` exports a client-side auth-error handler that has zero callers in the codebase. Either wire it into the query layer (wrapping every Supabase query) or delete it. Currently it's misleading — new contributors might assume it's active.
3. **`/api/bookings` returning 500 under admin session during regression** — noted in the healing section above. Worth investigating in Tier 2.1 (Command Center smoke) or 3.1 (Revenue Record Payment), whichever exercises the admin session against real DB queries first.
4. **Refresh token rejection mock path** — the deferred test from spec §4. Requires time-travel or expired-access-token helper. Tier 8 candidate.
5. **Missing `public.increment_rate_limit` Supabase function** — same dev-infra task noted in logout report. The rate limiter continues to fail open (non-blocking).
6. **Next.js "middleware → proxy" deprecation warning** — the dev server log shows: `The "middleware" file convention is deprecated. Please use "proxy" instead.` Meridian's `middleware.ts` will need to be migrated to `proxy.ts` in an upcoming Next.js version. Not a blocker for QA but a scheduled refactor.

## Observations (not bugs)

### Supabase SDK logs a TypeError when parsing garbage cookies (but handles it)

During scenario 3 (`tamperAuthCookie`), the dev server logs:
```
TypeError: Cannot create property 'user' on string 'tampered-not-a-valid-jwt'
```

This comes from Supabase's internal cookie-to-session deserializer — it tried to treat the garbage string as a session object. The SDK's internal try/catch swallows the exception and `getUser()` returns `{ user: null }`. **The observable contract still holds** — middleware returns a 307, not a 500. The test passes.

**Why this is OK:** It's an internal SDK implementation detail. If Supabase ever tightens the decoder, the log noise goes away; if they loosen it and start returning a 500, scenario 3 catches it at the HTTP layer.

**If this log noise becomes a problem** (e.g., pollutes CI output), we can wrap `updateSession` in a try/catch that logs at a lower level, or we can pre-validate the cookie structure in middleware. Not urgent.

## How to run these tests

```bash
# Just session-refresh (4 tests + 2 auth-setup = 6 total)
cd apps/web
npx playwright test --project=admin session-refresh

# Full admin project (auth-setup + logout + session-refresh = 10 tests)
npx playwright test --project=admin

# Flake check
npx playwright test --project=admin session-refresh --repeat-each=3

# Full regression across all projects (Tier 1 complete — 23 tests total)
npx playwright test
```

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline (main context) | ✅ Spec written (`session-refresh-spec.md`), 4 scenarios locked, 6 clarifications documented, BUG-004 surfaced |
| 2 — Architect | inline | ✅ Plan: `LoginPage.ts` extended with 2 helpers, 1 new spec file, 0 testids needed, 0 source files modified |
| 3 — Engineer | inline | ✅ 4 tests written, TypeScript clean, 4/4 passing on first run (16.1s) |
| 4 — Sentinel | inline | ✅ PASS — zero forbidden patterns, 14/14 flake check, 10/10 full admin, 13/13 full anonymous. Surfaced pre-existing playwright.config.ts misconfig. |
| 5 — Healer | — | SKIPPED (no failures in Tier 1.4 tests themselves) |
| 5a — Pre-existing config fix | inline | ✅ Added `middleware-redirect.spec.ts` to admin `testIgnore` |
| 6 — Scribe | inline | ✅ This report |

**Run time (Engineer → Scribe):** single session. Total wall-clock for test execution: 16.1s (first run) + 21.1s (3× flake) + 20.0s (full admin) + 15.1s (full anonymous) = ~72s of Playwright time.

---

## Tier 1 cumulative summary (Auth & Session — COMPLETE)

| Run | Scenarios | Tests | Project | Status |
|---|---|---|---|---|
| 1.1 Login | 8 | 8 (5 P0 / 2 P1 / 1 P2) | anonymous | ✅ |
| 1.2 Middleware redirect | 5 | 5 (4 P0 / 1 P1) | anonymous | ✅ |
| 1.3 Logout | 4 | 4 (3 P0 / 1 P1) | admin | ✅ |
| 1.4 Session refresh | 4 | 4 (3 P0 / 1 P1) | admin | ✅ |
| **Tier 1 total** | **21** | **21** | **2 projects** | **✅ 4/4 runs** |

**Helpers / infrastructure built during Tier 1:**
- `LoginPage.ts` — the full auth POM: `goto`, `fillEmail`, `fillPassword`, `submit`, `signInWithPassword`, `toggleMode`, `clickUseDifferentEmail`, `expectError`, `expectSentPanel`, `expectSubmitDisabled/Enabled`, `passwordInput`, `emailInput`, `mockMagicLinkSuccess`, `mockLogoutServerCall`, `logout`, `clearAuthCookies`, `tamperAuthCookie` — 17 methods
- `BasePage.ts` — auth-shared: `expectRedirectToLogin(originalPath)` (added in Tier 1.2, used by Tier 1.2, 1.3, 1.4)
- `playwright.config.ts` — `anonymous` project created in Tier 1.1, `middleware-redirect` added to the `anonymous` testMatch in Tier 1.2, admin project's `testIgnore` corrected in Tier 1.4

**Bugs surfaced during Tier 1:**
- BUG-001 (pre-existing) — 43 admin pages hardcode `DEFAULT_STUDIO_ID` (Tier 0 discovery)
- BUG-002 — Login page ignores `?redirect=` param from middleware (Tier 1.2)
- BUG-003 — Employee portal has no logout button (Tier 1.3)
- BUG-004 — Login page doesn't redirect already-authenticated users (Tier 1.4)

**Tier 1 gate satisfied.** `LoginPage.logout()` + `BasePage.expectRedirectToLogin()` + full auth surface exercised. Ready for Tier 2 (Admin Smoke, 11 council runs).
