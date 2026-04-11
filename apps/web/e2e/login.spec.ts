/**
 * Login E2E tests — Meridian's password + magic-link auth flow.
 *
 * Runs under the `anonymous` Playwright project (no storage state). Each test
 * begins with a fresh browser context and navigates to /login from an
 * unauthenticated state.
 *
 * Pre-flight: The ADMIN_USER and EMPLOYEE_USER accounts must exist in Supabase.
 * Run `cd apps/web && npx playwright test --project=auth-setup` once per
 * environment to seed them. Subsequent runs reuse the users (idempotent).
 *
 * No DB assertions are performed — Supabase manages the auth session outside
 * Meridian's tables, so URL transitions are the observable contract.
 */
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { ADMIN_USER, EMPLOYEE_USER } from './fixtures/test-data'

test.describe('Login', () => {
  // --- P0 (5) -----------------------------------------------------------

  test('admin password login redirects to / @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signInWithPassword(ADMIN_USER.email, ADMIN_USER.password)
    // Admin roles (owner) route to the command center at /.
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/)
  })

  test('employee password login redirects to /employee @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signInWithPassword(EMPLOYEE_USER.email, EMPLOYEE_USER.password)
    // Non-admin roles (trainer) route to the employee portal.
    await expect(page).toHaveURL(/\/employee/)
  })

  test('invalid credentials show error message @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.fillEmail(ADMIN_USER.email)
    await login.fillPassword('definitely-wrong-password-2026')
    await login.submit()
    // The UI maps Supabase's "Invalid login credentials" to the copy below.
    // Match via regex to stay resilient to future wording tweaks.
    await login.expectError(/invalid email or password/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('submit button disabled when form is empty @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    // On first load the button should be disabled — both email and password empty.
    await login.expectSubmitDisabled()
  })

  test('submit button disabled with email only @p0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.fillEmail(ADMIN_USER.email)
    // Still disabled — password required in password mode.
    await login.expectSubmitDisabled()
  })

  // --- P1 (2) -----------------------------------------------------------

  test('toggle to magic link mode hides password field @p1', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.toggleMode()
    // Password input is conditionally rendered in password mode only; after
    // toggling, it should be removed from the DOM. toBeHidden() handles both
    // "not present" and "present but hidden" cases.
    await expect(login.passwordInput()).toBeHidden()
    // Primary submit button text flips to "Send Magic Link".
    await expect(page.getByTestId('login-submit-btn')).toHaveText(/send magic link/i)
  })

  test('magic link submit shows "Check your email" confirmation @p1', async ({ page }) => {
    const login = new LoginPage(page)
    // Mock Supabase's OTP endpoint — see LoginPage.mockMagicLinkSuccess doc.
    // The UI's "sent" state is the contract; real email delivery is explicitly
    // out of scope per specs/features/login-spec.md §7.
    await login.mockMagicLinkSuccess()
    await login.goto()
    await login.toggleMode()
    await login.fillEmail(ADMIN_USER.email)
    await login.submit()
    await login.expectSentPanel(ADMIN_USER.email)
  })

  // --- P2 (1) -----------------------------------------------------------

  test('"Use a different email" returns from sent panel to form @p2', async ({ page }) => {
    const login = new LoginPage(page)
    // Mock the OTP endpoint — same reasoning as test 7 above.
    await login.mockMagicLinkSuccess()
    await login.goto()
    await login.toggleMode()
    await login.fillEmail(ADMIN_USER.email)
    await login.submit()
    await login.expectSentPanel(ADMIN_USER.email)
    await login.clickUseDifferentEmail()
    // After clicking, state resets: sent=false, email="" — the form is re-shown
    // with the email input empty. Verify both.
    await expect(login.emailInput()).toBeVisible()
    await expect(login.emailInput()).toHaveValue('')
  })
})
