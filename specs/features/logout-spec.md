# Test Spec — Logout Flow

**Status:** Tier 1.3 council run — third feature in the Auth & Session tier.

**Pipeline ID:** `logout`
**Project:** `admin` (requires pre-loaded admin session)
**Estimated tests:** 4 (3 P0, 1 P1)

---

## 1. Feature summary

- **Name:** Logout (admin shell sidebar)
- **Module:** Admin shell / global navigation (`apps/web/src/components/layout/sidebar.tsx`)
- **Primary user roles:** Admin, Owner, Manager — anyone who sees the admin sidebar
- **One-line description:** A signed-in admin can click the sign-out button in the sidebar to clear their Supabase session and be returned to `/login`.
- **Related implementation files:**
  - `apps/web/src/components/layout/sidebar.tsx` lines 138–151 — the actual logout button
  - `apps/web/src/middleware.ts` — re-enforces auth after logout (proves the session is gone)
  - `apps/web/e2e/pages/LoginPage.ts` — POM being extended with the `logout()` helper (per Tier 1 gate)

## 2. What the logout actually does

Read of `sidebar.tsx` lines 138–151:

```tsx
<button
  onClick={async () => {
    const { createBrowserClient } = await import('@/lib/supabase/client')
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }}
  aria-label="Sign out"
  className="..."
>
  <LogOut className="w-4 h-4" />
</button>
```

Observations:

1. **Dynamic import** of the Supabase browser client. Only the signed-out path pays the cost.
2. **`supabase.auth.signOut()`** — clears the GoTrue cookies (via Supabase's cookie chunking) and fires the `signed_out` auth event.
3. **`window.location.href = '/login'`** — a HARD navigation. This is deliberate: it tears down every React Context (auth, theme, etc.) and forces a full re-render on `/login` so no stale state survives.
4. **No `redirect` query param** on the destination — logout always returns to a clean `/login` URL.
5. **aria-label="Sign out"** — stable accessible selector. No testid is required; `getByRole('button', { name: 'Sign out' })` is reliable.
6. **Visibility condition:** the button is only rendered when `!collapsed` (line 138). The Sidebar's default state is `collapsed = false` per the layout's `useState(false)`, so it is visible by default. Tests that collapse the sidebar must expand it before calling logout.

### Employee portal does NOT have a logout button

Read of `apps/web/src/app/(employee)/layout.tsx` (lines 170–206) confirms:

- No `signOut` reference anywhere in the file
- No `LogOut` icon imported
- Bottom of sidebar has a "Switch to Admin" link + dark-mode toggle + user identity pill — nothing else
- The employee shell is read-only w.r.t. auth state

**This is a UX gap.** Employees are stranded once signed in — they must close the browser tab or manually visit `/login` to re-authenticate. Noted as a follow-up bug, not covered by this spec (no employee-side logout surface to test).

## 3. Preconditions (data needed)

### Existing fixtures (no action needed)

- **ADMIN_USER** from `e2e/fixtures/test-data.ts` — seeded by `e2e/auth.setup.ts` with `roles: ['owner']` and a pre-loaded storage state at `e2e/.auth/admin.json`.
- Playwright's `admin` project uses `storageState: 'e2e/.auth/admin.json'` so every test starts already authenticated.

### No seeding needed

Logout is a pure auth-state operation. It does not write application rows. `db.ts` is not exercised.

## 4. Test matrix

| # | Scenario | Priority | Type | Expected outcome |
|---|----------|----------|------|------------------|
| 1 | Admin clicks sidebar "Sign out" → lands on `/login` (no `redirect` param) | P0 | E2E page | Final URL is exactly `/login`, sign-in form visible |
| 2 | After logout, revisiting `/` bounces back to `/login?redirect=%2F` | P0 | E2E page | Middleware re-enforces auth → redirect to login with the same path preservation asserted in Tier 1.2 |
| 3 | After logout, protected API request (`/api/bookings`) returns `401` via `page.request` | P0 | API (context-aware) | `page.request.get('/api/bookings')` returns 401 because the browser context's cookies were cleared by logout |
| 4 | The "Sign out" button is accessible — visible, enabled, has aria-label, keyboard-reachable | P1 | E2E a11y | Button passes `toBeVisible`, `toBeEnabled`, `toBeFocused` after tab navigation from the user block |

**Total: 4 scenarios (3 P0, 1 P1).**

### Why these and not more

- The roadmap allotted 4 tests. Scenarios 1–3 cover the three observable contracts: client (URL), server (middleware re-enforcement), server (API session invalidation). Scenario 4 provides an accessibility contract that protects the aria-label selector from silent regressions.
- **NOT covered:** explicit cookie-jar inspection. The client + server re-enforcement tests transitively prove the cookies are gone — inspecting `context.cookies()` directly adds brittleness with no additional guarantee. (Supabase's cookie chunking scheme can change; what we actually care about is the behavior.)

## 5. Edge cases & negative tests

| # | Edge case | Coverage |
|---|-----------|----------|
| A | Clicking logout twice in rapid succession | **Not covered** — second click lands on `/login` where the button doesn't exist. Worth a follow-up once we have multi-click race coverage in Tier 8. |
| B | Logout while a background request is in-flight | **Not covered** — would require mocking a slow API. Out of scope for pilot logout. |
| C | Logout with collapsed sidebar | **Not covered** — the button is hidden when `collapsed=true`. Tests assume default (expanded) state. |
| D | Logout from a non-root admin route (e.g., `/members`, `/revenue`) | **Partially covered** — scenario 1 uses `/` as the starting point, but the button lives in a global sidebar component rendered on every admin route. Adding a parallel test from `/members` would be duplicative. |
| E | Logout from the employee portal | **Not applicable** — no logout UI exists. Filed as follow-up. |
| F | Logout when Supabase is unreachable | **Not covered** — `signOut()` error path. Meridian swallows errors and still runs `window.location.href = '/login'`. Out of scope. |
| G | Logout clears ALL tabs (multi-tab session invalidation) | **Not covered** — Supabase's broadcast auth state would handle this across tabs, but testing it requires two browser contexts. Deferred to Tier 1.4 (session refresh / expired session). |

## 6. Data-testid requirements

**Zero new testids needed.** The sidebar logout button already has `aria-label="Sign out"` which yields a stable accessible name. Per `apps/web/AGENTS.md` §6: "Prefer `getByRole` / `getByLabel` / `getByText` when the element has a clear accessible identity." We use `page.getByRole('button', { name: 'Sign out' })`.

## 7. Out of scope

- **Toast confirmation on logout** — Meridian does not show a toast on logout today. Nothing to assert.
- **Server-side session invalidation across all devices** — Supabase's `signOut()` is local by default. A global `signOut({ scope: 'global' })` flow would be a separate feature.
- **Audit logging of logout events** — Meridian does not write a row to an `auth_events` table on logout. If added in future, a new test should cover it.
- **Accessibility audit (full a11y tree)** — scenario 4 covers the specific logout control; a broader audit belongs in the dedicated A11y pipeline.

## 8. Clarification log

### CL-1 — `LoginPage.logout()` is semantically awkward but matches the Tier 1 gate

The roadmap's Tier 1 gate says: "`LoginPage.ts` extended with `logout()`." But the logout button is not on `/login` — it's on every admin page's sidebar. The natural OOP home for `logout()` is an `AdminShellPage` POM that wraps the sidebar, or `BasePage` since the sidebar is admin-global.

**Decision:** Stick with `LoginPage.logout()` per the roadmap gate. Rationale: the helper's *destination* is the login page, and every test that calls logout will want to follow up with a LoginPage assertion ("am I back on /login?"). Putting the helper on LoginPage keeps the import list short and matches the user-facing mental model ("to log out, I end up on the login page"). Implementation will use `getByRole('button', { name: 'Sign out' })` directly since `LoginPage` already has `this.page` via `BasePage`.

### CL-2 — Hard navigation requires `waitForURL`, not `waitForLoadState`

The logout handler uses `window.location.href = '/login'`, which is a synchronous browser navigation that tears down and rebuilds the entire page context. Playwright's `waitForLoadState('networkidle')` is unreliable across this boundary because there is a brief window where the page transitions between "committed to unload" and "committed to new document."

**Decision:** Use `page.waitForURL(/\/login/, { timeout: ANIM_TIMEOUT })` followed by a visibility assertion on `login-email-input`. This is the same pattern used in `LoginPage.signInWithPassword()` and matches the real contract.

### CL-3 — Employee portal logout is a documented gap, not a spec failure

Exploration of `apps/web/src/app/(employee)/layout.tsx` confirmed there is NO logout button in the employee portal. This spec does not attempt to test employee logout because there is no surface to test.

**Follow-up:** File BUG-003 — "Employee portal has no logout button." The fix should add a parallel sign-out button in the employee sidebar with `aria-label="Sign out"` so this same POM helper can handle both roles.

### CL-4 — Scenario 3 uses `page.request`, not the isolated `request` fixture

Tier 1.2 used the top-level `request` fixture (a fresh APIRequestContext with no cookies) to verify middleware API behavior without a session. Tier 1.3 scenario 3 needs the OPPOSITE: use the *same* browser context whose cookies were just cleared by logout, and verify that a subsequent API request from that context is also unauthenticated. For this, `page.request` is correct — it shares cookies with the browser context.

**Invariant to verify:** after `logout()`, `page.request.get('/api/bookings')` should return 401. If it returns 200, the client-side cookies weren't actually cleared.

### CL-5 — Default sidebar state is expanded

`sidebar.tsx` line 39 accepts `collapsed` as a prop. The parent `AdminLayout` passes `collapsed={sidebarCollapsed}` from `useState(false)`. So on fresh page loads, the sidebar is expanded and the logout button (only rendered when `!collapsed`) is visible. Tests can rely on this without manually expanding.

---

## Analyst summary

- **Feature:** Logout (admin sidebar → /login)
- **Spec:** `specs/features/logout-spec.md`
- **Scenarios:** 4 (3 P0, 1 P1)
- **Testids to seed:** 0 (aria-label is stable enough)
- **New fixtures needed:** 0
- **New Playwright projects needed:** 0 (uses existing `admin` project)
- **Open questions:** 0
- **Follow-ups surfaced:**
  1. BUG-003 — Employee portal has no logout button (file separately)
  2. Multi-tab logout behavior (deferred to Tier 1.4 session refresh)
  3. Logout during in-flight request (deferred to Tier 8 stress)
