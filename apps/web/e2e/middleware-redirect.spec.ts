/**
 * Middleware protected-route redirect E2E tests.
 *
 * Exercises `apps/web/src/middleware.ts`: when an unauthenticated request hits
 * a protected route, the middleware should either:
 *   - Redirect page requests to `/login?redirect=<original-path>` (307), OR
 *   - Return a JSON `401 Unauthorized` for `/api/*` requests (no redirect).
 *
 * Runs under the `anonymous` Playwright project — no storage state, no auth
 * cookies. Both the browser `page` and the standalone `request` contexts are
 * genuinely unauthenticated, so middleware behavior is observable.
 *
 * See `specs/features/middleware-redirect-spec.md` for the full spec + scope.
 */
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Middleware — Protected Route Redirect', () => {
  // ---------------------------------------------------------------------
  // P0 — core middleware branches (page redirect + API 401 + path preserved)
  // ---------------------------------------------------------------------

  test('unauthenticated root (/) redirects to /login with redirect=/ @p0', async ({ page }) => {
    // Navigate directly to the protected root. Playwright follows the 307 and
    // lands on /login. We then assert the destination URL and verify the form
    // is actually rendered (not a blank bounce).
    await page.goto('/')
    const login = new LoginPage(page)
    await login.expectRedirectToLogin('/')
    // Landing proof: the email input from the sign-in card is visible.
    await expect(page.getByTestId('login-email-input')).toBeVisible()
  })

  test('unauthenticated admin route /members preserves path in redirect param @p0', async ({ page }) => {
    await page.goto('/members')
    const login = new LoginPage(page)
    await login.expectRedirectToLogin('/members')
    await expect(page.getByTestId('login-email-input')).toBeVisible()
  })

  test('unauthenticated employee route /employee preserves path in redirect param @p0', async ({ page }) => {
    await page.goto('/employee')
    const login = new LoginPage(page)
    await login.expectRedirectToLogin('/employee')
    await expect(page.getByTestId('login-email-input')).toBeVisible()
  })

  test('unauthenticated protected API returns JSON 401 (no redirect) @p0', async ({ request }) => {
    // Use the `request` fixture (not `page`) so there is no browser cookie jar
    // and no auto-follow-redirect. The middleware's API branch
    // (`middleware.ts` line 80) should fire and return a JSON 401.
    //
    // `/api/bookings` is a real admin-scoped route (`apps/web/src/app/api/bookings/route.ts`)
    // and is NOT in PUBLIC_API_ROUTES, so the middleware intercepts it before
    // the route handler runs.
    const response = await request.get('/api/bookings')
    expect(response.status()).toBe(401)
    // JSON body, not HTML — API clients should never see the login page.
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  // ---------------------------------------------------------------------
  // P1 — inverse case: public /login must NOT be redirected
  // ---------------------------------------------------------------------

  test('public /login renders without redirect loop @p1', async ({ page }) => {
    // Direct navigation to /login should serve the sign-in form with no
    // `redirect` query param — this proves the middleware's PUBLIC_ROUTES
    // allowlist is working and that there is no redirect loop for auth pages.
    await page.goto('/login')
    await expect(page).toHaveURL('http://localhost:3000/login')
    // Assert no redirect param snuck in (would happen if middleware
    // mistakenly ran the protected-route branch on /login itself).
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBeNull()
    // Form must actually render — not just the URL being right.
    await expect(page.getByTestId('login-email-input')).toBeVisible()
  })
})
