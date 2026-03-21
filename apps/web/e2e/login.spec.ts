import { test, expect } from '@playwright/test'

// Override to NOT use any storage state — login page tests need unauthenticated access
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login Page', () => {
  test('renders with Meridian branding', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Page should contain Meridian branding
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.toLowerCase()).toContain('meridian')
  })

  test('email input and Send Magic Link button are visible', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Email input should be present
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    await expect(emailInput.first()).toBeVisible({ timeout: 15000 })

    // Magic link / sign in button should be visible
    const submitButton = page.locator('button[type="submit"], button:has-text("Magic Link"), button:has-text("Sign In"), button:has-text("Send")')
    await expect(submitButton.first()).toBeVisible({ timeout: 15000 })
  })

  test('submit button is disabled when email is empty', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    await expect(emailInput.first()).toBeVisible({ timeout: 15000 })

    // Clear the input to ensure it's empty
    await emailInput.first().clear()

    // Submit button should be disabled or clicking it should not navigate away
    const submitButton = page.locator('button[type="submit"], button:has-text("Magic Link"), button:has-text("Sign In"), button:has-text("Send")')
    const btn = submitButton.first()
    await expect(btn).toBeVisible()

    // Check if button is disabled, or if form validation prevents submission
    const isDisabled = await btn.isDisabled()
    if (!isDisabled) {
      // If not explicitly disabled, clicking should not leave the login page
      await btn.click()
      await page.waitForTimeout(500)
      expect(page.url()).toContain('/login')
    }
  })

  test('shows confirmation after submitting email', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    await expect(emailInput.first()).toBeVisible({ timeout: 15000 })

    // Fill in a test email
    await emailInput.first().fill('test-e2e-noreply@meridian.app')

    // Click submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Magic Link"), button:has-text("Sign In"), button:has-text("Send")')
    await submitButton.first().click()

    // Should show confirmation message (check email, magic link sent, etc.)
    const confirmation = page.locator('text=/check your email|magic link|email sent|link sent|check your inbox/i')
    await expect(confirmation.first()).toBeVisible({ timeout: 15000 })
  })
})
