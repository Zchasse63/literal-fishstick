/**
 * Logout E2E tests — admin sidebar "Sign out" button.
 *
 * Runs under the `admin` Playwright project, which pre-loads an owner session
 * via `storageState: 'e2e/.auth/admin.json'`. Each test starts already
 * authenticated, clicks sign out, and asserts the full post-logout contract:
 *   - client-side: URL bounces to /login, session form visible
 *   - server-side (same browser): middleware re-enforces on subsequent navigation
 *   - server-side (same browser): page.request API calls return 401 (cookies really gone)
 *
 * IMPORTANT: every test calls `mockLogoutServerCall()` BEFORE navigating, so
 * Supabase's real `POST /auth/v1/logout` never fires. Without the mock, the
 * SDK's default `scope: 'global'` signOut invalidates the refresh token in
 * `e2e/.auth/admin.json` server-side, which poisons every subsequent admin
 * test. See `LoginPage.mockLogoutServerCall` for the full explanation.
 *
 * See `specs/features/logout-spec.md` for the full spec, clarifications, and
 * the reasoning behind scenario choices.
 */
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Logout — Admin Sidebar', () => {
  // ---------------------------------------------------------------------
  // P0 — core logout contract (client, middleware, API)
  // ---------------------------------------------------------------------

  test('admin clicks sidebar sign out and lands on /login @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.mockLogoutServerCall()
    await page.goto('/')
    await login.logout()
    // Logout's contract is a clean /login URL with NO redirect param — this is
    // different from the middleware-redirect flow, which always sets one.
    await expect(page).toHaveURL('http://localhost:3000/login')
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBeNull()
  })

  test('after logout, revisiting / bounces back to /login?redirect=/ @p0', async ({ page }) => {
    // Prove the session was actually cleared by exercising the middleware
    // protected-route branch covered in Tier 1.2 — if local cookies weren't
    // cleared, /  would load the command center instead of bouncing.
    const login = new LoginPage(page)
    await login.mockLogoutServerCall()
    await page.goto('/')
    await login.logout()
    // Now try to re-enter a protected route. The middleware must redirect
    // because Supabase JS cleared local cookies even with the mocked response.
    await page.goto('/')
    await login.expectRedirectToLogin('/')
  })

  test('after logout, protected API request via page.request returns 401 @p0', async ({ page }) => {
    // `page.request` shares cookies with the browser context, so this verifies
    // that `signOut()` really cleared the local auth cookies. If the cookies
    // survived, the API would return 200 (or at least not 401).
    const login = new LoginPage(page)
    await login.mockLogoutServerCall()
    await page.goto('/')
    await login.logout()
    const response = await page.request.get('/api/bookings')
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  // ---------------------------------------------------------------------
  // P1 — accessibility contract on the logout control itself
  // ---------------------------------------------------------------------

  test('sign out button is visible, enabled, and has correct aria-label @p1', async ({ page }) => {
    // Selector stability guard: tests and the LoginPage.logout() helper both
    // rely on `aria-label="Sign out"`. If a future refactor renames the label
    // or removes the button entirely, this test fails loudly at that point
    // instead of silently breaking every downstream admin spec.
    //
    // Mock the logout endpoint defensively even though this test doesn't
    // click the button — if a flaky render bounces us through the form it's
    // one less source of noise.
    const login = new LoginPage(page)
    await login.mockLogoutServerCall()
    await page.goto('/')
    const signOutBtn = page.getByRole('button', { name: 'Sign out' })
    await expect(signOutBtn).toBeVisible()
    await expect(signOutBtn).toBeEnabled()
    // Playwright's getByRole with { name } already matches aria-label — but we
    // assert the attribute explicitly so the failure message is unambiguous
    // about WHY the selector stopped working.
    await expect(signOutBtn).toHaveAttribute('aria-label', 'Sign out')
  })
})
