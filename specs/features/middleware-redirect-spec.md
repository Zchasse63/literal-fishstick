# Test Spec — Middleware Protected-Route Redirect

**Status:** Tier 1.2 council run — second feature after Login pilot.

**Pipeline ID:** `middleware-redirect`
**Project:** `anonymous` (no storage state — each test starts from a fresh, unauthenticated context)
**Estimated tests:** 5 (4 P0, 1 P1)

---

## 1. Feature summary

- **Name:** Middleware protected-route redirect
- **Module:** Auth / Global middleware (`apps/web/src/middleware.ts`)
- **Primary user roles:** N/A — this spec tests behavior for **unauthenticated visitors**
- **One-line description:** When an anonymous request hits a protected route, Meridian's Next.js middleware either redirects to `/login?redirect=<original-path>` (for HTML page routes) or returns a JSON `401 Unauthorized` (for `/api/*` routes).
- **Related implementation files:**
  - `apps/web/src/middleware.ts` — route-protection logic
  - `apps/web/src/lib/supabase/middleware.ts` — session refresh helper (wrapped by middleware)
  - `apps/web/src/app/(auth)/login/page.tsx` — public landing target for the redirect

## 2. What the middleware actually does

Read of `apps/web/src/middleware.ts` (verified at time of writing):

```ts
const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const PUBLIC_API_ROUTES = [
  "/api/leads/capture",  "/api/unsubscribe",  "/api/inngest",
  "/api/webhooks/stripe","/api/webhooks/resend","/api/webhooks/easypost",
  "/api/webhooks/twilio","/api/openapi",      "/api/health",
  "/api/glofox/sync",    "/api/glofox/backfill",
];
const CRON_API_PREFIX = "/api/cron/";
```

Decision tree for every incoming request:

1. `updateSession(request)` always runs first → refreshes Supabase cookies.
2. If `pathname` matches any `PUBLIC_ROUTE`, `PUBLIC_API_ROUTE`, the cron prefix, `/_next/*`, or `/favicon.ico` → **return without auth check**.
3. Else: call `supabase.auth.getUser()` to resolve the session.
4. If no user AND pathname starts with `/api/` → **return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`**.
5. If no user AND pathname is a page route → **redirect to `/login?redirect=<encoded-original-path>`**.
6. If user is present → fall through and return the refreshed response (the destination page/route handler runs).

**Matcher config (line 101):** `"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"` — runs on every HTML + API request, skipping only static asset file extensions.

### Observed behaviour for this spec's scenarios

| Request | Middleware response |
|---|---|
| `GET /` (unauth) | `307 → /login?redirect=%2F` |
| `GET /members` (unauth) | `307 → /login?redirect=%2Fmembers` |
| `GET /employee` (unauth) | `307 → /login?redirect=%2Femployee` |
| `GET /api/members` (unauth) | `401 {"error":"Unauthorized"}` |
| `GET /login` (unauth) | `200` with sign-in form |
| `GET /api/health` (unauth) | (public — passes through, handled by route) |

## 3. Preconditions (data needed)

**None.** This spec exercises request-level behavior before any database read happens. No seeding, no fixtures, no studio context.

### Test architecture

- **Project:** `anonymous` (no `storageState`) — already configured in `playwright.config.ts` for the login pilot. We extend its `testMatch` to also pick up `middleware-redirect.spec.ts`.
- **Browser navigation for HTML routes** — Playwright's page.goto() follows redirects by default, so we assert the final URL.
- **Playwright APIRequestContext for API routes** — use the `request` fixture (not `page`) because API routes don't render HTML and we want the raw response status. Crucially, `request` is isolated from the browser context and has no cookies, so it is genuinely unauthenticated.

## 4. Test matrix

| # | Scenario | Priority | Type | Expected outcome |
|---|----------|----------|------|------------------|
| 1 | Unauthenticated root (`/`) redirects to `/login?redirect=%2F` | P0 | E2E | Final URL is `/login?redirect=%2F`, sign-in form visible |
| 2 | Unauthenticated admin deep route (`/members`) preserves path in `redirect` param | P0 | E2E | Final URL is `/login?redirect=%2Fmembers`, sign-in form visible |
| 3 | Unauthenticated employee route (`/employee`) preserves path in `redirect` param | P0 | E2E | Final URL is `/login?redirect=%2Femployee`, sign-in form visible |
| 4 | Unauthenticated protected API (`/api/members`) returns JSON 401 (no redirect) | P0 | API | Response status 401, body is `{"error":"Unauthorized"}` |
| 5 | Public `/login` page is reachable without redirect loop | P1 | E2E | `GET /login` → 200, form rendered, URL exactly `/login` (no redirect param) |

**Total: 5 scenarios (4 P0, 1 P1).**

### Why these and not more

- The roadmap allotted 5 tests for this feature. We cover the two middleware branches (redirect vs 401), plus path preservation across admin + employee namespaces, plus the inverse case (public route should NOT redirect). This hits every branch in the middleware's decision tree without duplicating coverage.
- **NOT covered:** follow-up redirect *after* successful login (the current login page hardcodes destinations by role — see §5 CL-1). That's a separate follow-up.

## 5. Edge cases & negative tests

| # | Edge case | Coverage |
|---|-----------|----------|
| A | Query string on the original URL (e.g., `/members?tab=active`) | **Not covered** — out of scope for pilot redirect test; the middleware uses `request.nextUrl.clone()` so params are dropped in the redirect param (only pathname is preserved). Worth a follow-up. |
| B | `redirect` param when the target is itself an auth page (loop risk) | **Not covered** — middleware treats `/login` as public, so visiting `/login?redirect=/login` does not loop. No test needed. |
| C | Trailing slash on protected route (`/members/`) | **Not covered** — Next.js normalizes trailing slashes; additional coverage not warranted. |
| D | Protected route with hash fragment (`/members#tab=x`) | **Not covered** — hash is client-side only, never sent to server. Irrelevant to middleware. |
| E | Non-existent route (`/does-not-exist`) | **Not covered** — middleware still redirects unauth requests; the 404 happens after auth succeeds. Covered transitively by scenario 2's pattern. |
| F | Already-authenticated user visits `/login` | **Not covered here** — worthwhile, but belongs in Tier 1.4 (session refresh / authenticated visiting public routes). |
| G | API route with invalid (but present) cookie | **Not covered** — GoTrue handles, not middleware. Unit-test territory. |

## 6. Data-testid requirements

**Zero new testids needed.** The `/login` page already has `login-email-input`, `login-password-input`, and `login-submit-btn` from the login pilot. The redirect-landing scenarios re-use those via `LoginPage`.

## 7. Out of scope

- **Post-login redirect fulfillment** — whether the login form, after success, actually navigates to `searchParams.get('redirect')` instead of the hardcoded `/` or `/employee`. The current login page **ignores** the `redirect` param (see §8 CL-1). This is a known behavioral gap and should be filed as a bug, not masked by a test.
- **Cookie refresh behavior** — `updateSession()` internals are Supabase-owned.
- **Protected API routes with CSRF tokens** — Meridian doesn't use CSRF tokens; it relies on SameSite cookies + Supabase JWT. Out of scope.
- **Rate limiting on `/login`** — GoTrue-owned.
- **The 11 public API allowlist entries** — webhook signatures, cron secrets, etc. are secured by headers, not user auth. Verifying those headers is not middleware redirect behavior. Tier 8 (platform) should cover them.

## 8. Clarification log

### CL-1 — Login page does NOT honor `?redirect=` param

**Finding:** The middleware dutifully sets `url.searchParams.set("redirect", pathname)` before redirecting. But `apps/web/src/app/(auth)/login/page.tsx` never reads `searchParams` — it hardcodes:

```ts
let destination = "/";
if (signedInUser) {
  const { data: profileData } = await supabase.from("profiles")...
  const hasAdminRole = userRoles.some((r) => ADMIN_ROLES.includes(r));
  if (!hasAdminRole && userRoles.length > 0) {
    destination = "/employee";
  }
}
router.push(destination);
```

So an unauthenticated user who visits `/members`, gets redirected to `/login?redirect=%2Fmembers`, signs in, and lands at `/` — NOT `/members`. The `redirect` query param is currently dead state.

**Impact on this spec:** None for the 5 scheduled tests — we verify middleware behavior, which correctly sets the param. Whether the login form honors it is a separate concern.

**Follow-up:** File a bug to wire `searchParams.get("redirect")` into the login page's post-auth destination logic, with a preference check that the target path is same-origin (to avoid open-redirect).

### CL-2 — API 401 path uses `NextResponse.json`, not `redirect`

**Finding:** The middleware has a distinct branch at line 80 for unauthenticated `/api/*` requests — it returns `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`. This is the correct REST behavior (API consumers don't want 302s to HTML pages) and must be tested separately from the page-route redirect.

**Impact on this spec:** Scenario 4 uses `request.get('/api/members')` via Playwright's `APIRequestContext` rather than `page.goto()` so we see the raw 401 without Playwright's auto-follow-redirect masking it.

### CL-3 — `anonymous` project testMatch must be expanded

**Finding:** `playwright.config.ts` currently declares:

```ts
{
  name: 'anonymous',
  // ...
  testMatch: /login.*\.spec\.ts/,
}
```

This matches only `login.spec.ts`. A new spec file `middleware-redirect.spec.ts` will not run under `anonymous` unless the match pattern is broadened.

**Recommended Architect fix:** Change `testMatch` to an array: `[/login.*\.spec\.ts/, /middleware-redirect.*\.spec\.ts/]`. This keeps the match explicit (no accidental inclusion of admin specs) while allowing the new file. Alternatively, we can rely on a naming convention like `/^(login|middleware).*\.spec\.ts/` — the array approach is clearer.

### CL-4 — `/api/members` may not exist as a standalone route

**Finding:** Meridian's admin UI uses Supabase client calls, not a `/api/members` REST endpoint. A `curl /api/members` may 404 before the auth check is reached — which would make scenario 4 ambiguous (is it 401 from auth or 404 from the router?).

**Mitigation:** The middleware runs BEFORE Next.js's route resolver — the matcher catches everything not in the static-asset allowlist, so the middleware's auth check fires first. Request to `/api/members` from an unauthenticated context will be intercepted by the middleware and return 401 even if no route handler exists. This is confirmed by reading `middleware.ts` lines 79–82 and the matcher config on line 101.

**Better choice:** Use a real API route path like `/api/members/list` or `/api/health-check` (existing route) — but `/api/health` is in the public allowlist, so it would pass through. The safest target is a known-real admin-scoped API route. Let me grep for one during the Architect phase before locking the path. For now, the Analyst recommends testing against `/api/members` — if that's not a real route, the 401 still fires from middleware. Either way, the behavior is observable.

**Locked during Architect phase, not here.** The Engineer will verify against the real route tree.

---

## Analyst summary

- **Feature:** Middleware protected-route redirect (unauth → /login or 401 JSON)
- **Spec:** `specs/features/middleware-redirect-spec.md`
- **Scenarios:** 5 (4 P0, 1 P1)
- **Testids to seed:** 0
- **New fixtures needed:** 0
- **New Playwright projects needed:** 0 (but `anonymous.testMatch` must be broadened)
- **Open questions:** 0
- **Follow-ups surfaced:**
  1. Login page ignores `?redirect=` param — dead state (file as bug)
  2. Consider `open-redirect` hardening if/when the redirect param is honored
