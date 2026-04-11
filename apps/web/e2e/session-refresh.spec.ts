/**
 * Session refresh / expired session E2E tests — middleware re-enforcement.
 *
 * Runs under the `admin` Playwright project, which pre-loads an owner session
 * via `storageState: 'e2e/.auth/admin.json'`. Each test starts already
 * authenticated, then mutates the cookie jar to simulate one of the three
 * ways a session can become invalid:
 *
 *   1. Cookies cleared (`clearAuthCookies`)      — scenarios 1 and 2
 *   2. Cookies tampered (`tamperAuthCookie`)     — scenario 3
 *   3. Refresh token rejected (deferred)         — see session-refresh-spec.md §4
 *
 * IMPORTANT: These tests do NOT call `signOut()` or any UI flow that hits
 * Supabase's server-side session invalidation. They manipulate cookies on
 * Playwright's browser context only, which leaves the refresh token in
 * `admin.json` valid server-side. No `mockLogoutServerCall` is needed.
 *
 * See `specs/features/session-refresh-spec.md` for the full spec,
 * clarifications, and the reasoning behind scenario choices.
 */
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Session Refresh — Expired / Invalidated Session', () => {
  // ---------------------------------------------------------------------
  // P0 — core expiry contract (client, middleware, API)
  // ---------------------------------------------------------------------

  test('after cookies are cleared mid-session, next protected page nav bounces to /login @p0', async ({
    page,
  }) => {
    // Prove the admin starts signed in — load /, wait for it to render.
    const login = new LoginPage(page)
    await page.goto('/')
    // Sanity check: we're NOT on /login (storage state is working).
    await expect(page).not.toHaveURL(/\/login/)

    // Simulate "session became invalid" by removing the auth cookies.
    const cleared = await login.clearAuthCookies()
    expect(cleared.length).toBeGreaterThan(0) // guard: we actually cleared something

    // Navigate to a DIFFERENT protected route. The middleware should see
    // no session cookies and redirect with the original path preserved.
    await page.goto('/members')
    await login.expectRedirectToLogin('/members')
  })

  test('after cookies are cleared mid-session, page.request to protected API returns 401 @p0', async ({
    page,
  }) => {
    // Same journey as the previous test, but the follow-up request is an
    // API call that shares the browser context's cookie jar. Proves the
    // cookies are really gone from the client's perspective.
    const login = new LoginPage(page)
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/login/)

    const cleared = await login.clearAuthCookies()
    expect(cleared.length).toBeGreaterThan(0)

    const response = await page.request.get('/api/bookings')
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  test('malformed auth cookie → middleware bounces to /login (no 500) @p0', async ({
    page,
  }) => {
    // Defensive path: if a future refactor wraps `supabase.auth.getUser()`
    // in a try/catch that returns 500 on parser failure, this test fails.
    // The middleware must treat parse errors as "no session" → 307 redirect,
    // matching the contract established by scenarios 1 and 2.
    //
    // SETTLE NOTE: Wait for command-center network to settle BEFORE tampering.
    // If we tamper while the page still has in-flight requests (KPI polling,
    // command-center-data hook), the follow-up `goto('/')` can hang waiting
    // for those requests to close out during the navigation abort. Observed
    // as a 60s timeout when this test runs after the Tier 2.1 command-center
    // suite — see specs/reports/command-center-report.md for context.
    const login = new LoginPage(page)
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/login/)
    // Settle all command-center async work before mutating cookies.
    await page.waitForLoadState('networkidle').catch(() => {
      // Some dev-mode background polling never fully idles — that's fine,
      // a best-effort wait is enough to avoid the race.
    })

    const tampered = await login.tamperAuthCookie()
    expect(tampered.length).toBeGreaterThan(0) // guard: we actually tampered something

    // Navigate back to / — same pathname so `redirect` param will be `/`.
    // Use `waitUntil: 'commit'` so we don't wait for /login's full load
    // event (which can take several seconds if the dev server is warming
    // up). We only need the navigation to have COMMITTED — the subsequent
    // `toHaveURL` polling from expectRedirectToLogin handles the rest.
    await page.goto('/', { waitUntil: 'commit' })
    await login.expectRedirectToLogin('/')
  })

  // ---------------------------------------------------------------------
  // P1 — current-behavior guard (BUG-004 follow-up)
  // ---------------------------------------------------------------------

  test('already-authenticated admin visiting /login sees the form (gap guard) @p1', async ({
    page,
  }) => {
    // CURRENT BEHAVIOR: the login page does NOT redirect authenticated users
    // away. It just renders the form. This test documents that behavior so a
    // future fix (redirect-if-authenticated) doesn't ship silently — when
    // that fix lands, this test flips to assert the new redirect contract.
    //
    // Filed as BUG-004: login page should redirect authenticated users to /
    // (or /employee for trainers) instead of rendering the form.
    await page.goto('/login')
    // We should NOT have been bounced anywhere — URL stays on /login.
    await expect(page).toHaveURL(/\/login$/)
    // The form renders — login-email-input is visible (seeded in Tier 1.1).
    await expect(page.getByTestId('login-email-input')).toBeVisible()
    // The sign-in heading is visible.
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })
})
