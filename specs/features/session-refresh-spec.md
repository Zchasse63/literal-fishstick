# Test Spec — Session Refresh / Expired Session

**Status:** Tier 1.4 council run — fourth and final feature in the Auth & Session tier.

**Pipeline ID:** `session-refresh`
**Project:** `admin` (requires pre-loaded admin session)
**Estimated tests:** 4 (3 P0, 1 P1)

---

## 1. Feature summary

- **Name:** Session refresh / expired session
- **Module:** Auth middleware + Supabase SSR cookie handling
- **Primary user roles:** Admin, Owner, Manager, Trainer — anyone with a session
- **One-line description:** When an authenticated user's session becomes invalid (cookies cleared, refresh token rejected, or cookie corrupted), their next request to a protected surface is re-enforced by the middleware — pages redirect to `/login?redirect=<path>`, APIs return `401 JSON`.
- **Related implementation files:**
  - `apps/web/src/middleware.ts` lines 35–93 — the enforcement decision tree
  - `apps/web/src/lib/supabase/middleware.ts` lines 4–36 — `updateSession()` which runs on every request and refreshes tokens
  - `apps/web/src/lib/supabase/client.ts` lines 21–38 — `handleSupabaseAuthError` helper (NOTE: currently dead code — no callers)
  - `apps/web/e2e/pages/LoginPage.ts` — POM being extended with auth-cookie tampering helpers

## 2. What happens when a session becomes invalid

### The request lifecycle

Every request to a protected route (page or API) goes through this chain:

1. **`middleware.ts:50`** — calls `updateSession(request)`
2. **`supabase/middleware.ts:33`** — internally calls `supabase.auth.getUser()` which:
   - Reads all `sb-<ref>-auth-token*` cookies from the request
   - Reassembles the chunked session JSON
   - If the access token is near expiry: calls `POST /auth/v1/token?grant_type=refresh_token` to refresh
   - Sets new cookies on the response via `setAll()`
   - Returns `{ data: { user } }` (user is null if anything failed)
3. **`middleware.ts:77`** — calls `supabase.auth.getUser()` AGAIN with a fresh client using only the request cookies (the ones updateSession may have just refreshed)
4. **`middleware.ts:80`** — if `!user && pathname.startsWith("/api/")` → return `401 JSON`
5. **`middleware.ts:85`** — if `!user` and pathname is a protected page → `307` redirect to `/login?redirect=<path>`

### The three ways a session can become invalid

1. **Cookies cleared** — user deleted them manually, or another tab did `clearAuthCookies`, or our `logout` cleared them. No cookies at all → `getUser()` returns `{ user: null }` immediately.
2. **Cookie corrupted/malformed** — cookie exists but the value can't be parsed as a JWT. Supabase's SDK treats parse failure as "no session" internally. `getUser()` returns `{ user: null }`.
3. **Refresh token rejected by GoTrue** — cookie is syntactically valid, but the refresh token has been invalidated server-side (e.g., global signOut from another device, admin revocation, GoTrue rotation). `POST /auth/v1/token?grant_type=refresh_token` returns 400 → SDK returns `{ user: null }`.

### What the user observes

| Scenario | Page request | API request |
|---|---|---|
| Cookies cleared | 307 → `/login?redirect=<path>` | 401 JSON `{"error":"Unauthorized"}` |
| Cookie corrupted | 307 → `/login?redirect=<path>` | 401 JSON |
| Refresh rejected | 307 → `/login?redirect=<path>` | 401 JSON |

The contract is identical across all three — the middleware only asks "is there a valid user?" and doesn't care WHY there isn't one.

### Observation about `handleSupabaseAuthError`

`src/lib/supabase/client.ts:21` exports a helper that's supposed to catch client-side Supabase query errors and redirect to login. **It's dead code** — `grep` for `handleSupabaseAuthError` finds zero callers outside the definition file. The real expiry path is purely server-side via middleware. Noted as a follow-up: either wire the helper into the query layer or delete it.

### Login page does NOT redirect away authenticated users

Read of `src/app/(auth)/login/page.tsx`: there is no `useEffect` or server-component check that redirects signed-in users to `/`. The form just renders. This is a real UX gap (BUG-004, to file) — if a user is already authenticated and accidentally navigates to `/login`, they'll see a login form that looks like they're signed out. Scenario 4 of this spec documents the current behavior as a regression guard.

## 3. Preconditions (data needed)

### Existing fixtures (no action needed)

- **ADMIN_USER** from `e2e/fixtures/test-data.ts` — seeded by `e2e/auth.setup.ts` with `roles: ['owner']` and a pre-loaded storage state at `e2e/.auth/admin.json`.
- The `admin` Playwright project loads `storageState: 'e2e/.auth/admin.json'` per test.

### No seeding needed

Session-refresh is pure cookie-state manipulation. No DB writes.

## 4. Test matrix

| # | Scenario | Priority | Type | Expected outcome |
|---|----------|----------|------|------------------|
| 1 | Admin loads `/`, clears auth cookies, navigates to `/members` | P0 | E2E page | Redirects to `/login?redirect=/members`, login form visible |
| 2 | Admin loads `/`, clears auth cookies, `page.request.get('/api/bookings')` | P0 | API (context-aware) | Returns 401 JSON `{"error":"Unauthorized"}` |
| 3 | Admin has auth cookie tampered (value replaced with garbage), navigates to `/` | P0 | E2E page + defensive | Redirects to `/login?redirect=/` (NOT a 500). Proves middleware handles parse errors gracefully. |
| 4 | Already-authenticated admin visits `/login` | P1 | E2E page (gap guard) | Login form renders (the page does NOT auto-redirect away). Documents current behavior — surfaces BUG-004. |

**Total: 4 scenarios (3 P0, 1 P1).**

### Why these and not more

- The roadmap allotted 4 tests. Scenarios 1–3 cover the three distinct "invalid session" triggers from the middleware's perspective (missing cookies, malformed cookies, and — via scenario 3 — the middleware's defensive behavior when Supabase's parser can't handle the input).
- Scenario 4 captures the "already authenticated visits /login" behavior so a future fix doesn't break silently.
- **NOT covered:** the `POST /auth/v1/token?grant_type=refresh_token` rejection path via route mock. Reason: with a fresh `admin.json`, the access token isn't near expiry, so no refresh call fires on the first page visit, and the mock would never trigger. Testing this properly would require either a time-travel helper or crafting a synthetic session with an already-expired access token. Deferred to Tier 8 or a dedicated Supabase mock infra run.
- **NOT covered:** multi-tab session invalidation propagation. Deferred to a separate Tier 1.x run if/when Meridian adopts `BroadcastChannel` or the Supabase `onAuthStateChange` listener is wired to cross-tab logout.

## 5. Edge cases & negative tests

| # | Edge case | Coverage |
|---|-----------|----------|
| A | Partial cookie corruption (chunk `.0` is valid JSON but `.1` is truncated) | **Not covered** — Supabase's chunk reassembler should fail, but we don't verify it explicitly. Scenario 3 tampers the whole-cookie path. |
| B | Refresh token rejected mid-session | **Not covered** — explained in §4 "Why these and not more". Deferred. |
| C | Cookie exists but has wrong project ref (e.g., `sb-wrong-auth-token`) | **Not covered** — middleware simply doesn't see it; equivalent to "no cookies" (scenario 1). |
| D | Session valid but profile row deleted | **Not covered** — `getUser()` only checks Supabase auth, not Meridian profile rows. A profile-deleted user would currently still pass middleware and get a 500 in the admin layout when the profile query fails. Worth a dedicated test once we understand the layout's error handling. |
| E | Access token signed by the wrong Supabase instance | **Not covered** — would require crafting JWTs manually. Belongs in Tier 8 adversarial. |
| F | Session refresh race: two parallel requests both trigger refresh | **Not covered** — Supabase SDK has internal locking, but testing it requires carefully timed parallel requests. Out of scope. |
| G | Authenticated admin navigates to `/login?redirect=/members` | **Not covered** — this is BUG-004 territory. Scenario 4 tests the plain `/login` case; adding a redirect param variant would be duplicative. |

## 6. Data-testid requirements

**Zero new testids needed.**

- Scenario 1 + 3 use `login-email-input` (existing, from Tier 1.1) to assert login form renders after redirect.
- Scenario 2 uses `page.request` — no DOM assertion.
- Scenario 4 uses `login-email-input` to assert form visible (no redirect).

## 7. Out of scope

- **Client-side `handleSupabaseAuthError` helper** — currently dead code, not wired in. File follow-up to either wire it in or delete it.
- **Session refresh timing / latency** — belongs in performance suite, not E2E.
- **`sb-<ref>-auth-token` cookie format stability** — Supabase owns this; if they change it, Meridian's auth breaks end-to-end and we'll notice.
- **Cross-browser session sharing** — single Playwright browser context per test.
- **iOS app session refresh** — Phase 5, separate test infra.

## 8. Clarification log

### CL-1 — "Cleared cookies" test journey differs from Tier 1.2

Tier 1.2 started from a cold, anonymous browser and tested the middleware's "no cookies" branch. Tier 1.4 scenario 1 starts from an **authenticated** browser, first proves the admin page loads, THEN clears cookies and observes the next navigation. This tests a different user journey (session expiring mid-browse), even though the code path in middleware is the same.

**Decision:** Keep scenario 1 despite middleware-code overlap. The user-observable contract — "your in-progress browsing session gets bounced on the next click when your session expires" — is worth a dedicated test.

### CL-2 — Tamper method: overwrite cookie value, not delete

For scenario 3, we need a session cookie that EXISTS but is INVALID. The implementation: read all `sb-<ref>-auth-token*` cookies, delete them, and then re-add them with value `"tampered-not-a-valid-jwt"`. This differs from scenario 1 (which just clears).

**Why not use a valid-looking-but-expired JWT?** Constructing one requires knowing Supabase's signing key format and an HMAC operation. `"tampered-not-a-valid-jwt"` is simpler and achieves the same "parser fails" outcome. The middleware should treat both identically.

### CL-3 — Scenario 3 is the defensive-path test

This is the ONLY scenario in Tier 1 that specifically targets middleware error handling for malformed input. If someone ever adds `try { await supabase.auth.getUser() } catch { return 500 }`, scenario 3 catches it. If they remove the implicit null handling, scenario 3 catches it.

**Decision:** Scenario 3 explicitly asserts a 307 redirect (not a 500 status code). The assertion should check the final URL ends with `/login?redirect=/` rather than trusting the redirect count or anything else that could mask a 500.

### CL-4 — Scenario 2 uses `page.request`, not the isolated `request` fixture

Same rationale as Tier 1.3 CL-4: we want the API call to come from the SAME browser context whose cookies we just cleared, so the test verifies the cookies are really gone from the client's perspective. `page.request` shares cookies with the browser context; the top-level `request` fixture doesn't.

### CL-5 — Scenario 4 asserts a "gap guard", not the ideal behavior

The ideal behavior: an already-authenticated user visiting `/login` should be redirected to `/` (or `/employee` if trainer) immediately. The current behavior: the login form renders. Scenario 4 asserts the CURRENT behavior, not the ideal.

**Rationale:** If we don't capture this, a future fix could ship silently and we'd have no regression protection for the intentional "gap preserved" state. When BUG-004 is fixed, scenario 4 flips to assert the new behavior — a 3-line change.

**Decision:** Name the test clearly (`@gap-guard` tag or explicit comment) so reviewers know it's asserting a known-broken state deliberately.

### CL-6 — Poisoning precaution

Tier 1.3 discovered that real `signOut()` calls poison `admin.json` because Supabase defaults to `scope: 'global'`. **Tier 1.4 tests do NOT call `signOut()`** — they only manipulate cookies on the browser context (Playwright's local context), which does not touch the Supabase server. Therefore no `mockLogoutServerCall` is needed. However, tests should use `page.context().clearCookies()` and `addCookies()` rather than triggering any UI flow that could fire a real `signOut`.

## 9. Out of scope

- **Fixing `handleSupabaseAuthError`** — dead code cleanup, separate ticket
- **Wiring login page to redirect authenticated users away** — BUG-004, separate ticket
- **Time-travel / clock-skew testing** — requires infrastructure
- **Refresh token rotation verification** — out of scope for E2E; Supabase SDK owns this

---

## Analyst summary

- **Feature:** Session refresh / expired session
- **Spec:** `specs/features/session-refresh-spec.md`
- **Scenarios:** 4 (3 P0, 1 P1)
- **Testids to seed:** 0 (reuses existing `login-email-input`)
- **New fixtures needed:** 0
- **New Playwright projects needed:** 0 (uses existing `admin` project)
- **New POM methods:** 2 — `LoginPage.clearAuthCookies()` and `LoginPage.tamperAuthCookie()`
- **Open questions:** 0
- **Follow-ups surfaced:**
  1. BUG-004 — Login page does not redirect already-authenticated users (to file)
  2. `handleSupabaseAuthError` dead-code cleanup (to file)
  3. Refresh token rejection mock path (deferred to Tier 8 or dedicated Supabase mock infra run)
  4. Profile-deleted-but-auth-valid edge case (deferred)
