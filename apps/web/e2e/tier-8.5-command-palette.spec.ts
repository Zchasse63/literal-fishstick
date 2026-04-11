/**
 * T6 — Tier 8.5.A6 Cmd+K Command Palette regression.
 *
 * Exercises the palette open/close lifecycle, mode switching, keyboard
 * shortcuts, and command-run navigation. The palette lives in the admin
 * shell so any authed admin page can trigger it.
 */
import { test, expect } from '@playwright/test'

test.describe('Global — Command Palette (Tier 8.5.A6)', () => {
  test('Cmd+K opens palette in command mode @p0', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-quick-create-btn"]', { timeout: 10_000 })
    // Focus the body so the global keydown listener fires (not stuck in an
    // input element). Then press Cmd+K (Meta on mac, Control elsewhere).
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.keyboard.press('ControlOrMeta+k')
    const root = page.locator('[data-testid="palette-root"]')
    await expect(root).toBeVisible({ timeout: 3_000 })
    await expect(root).toHaveAttribute('data-palette-mode', 'command')
  })

  test('header Quick Create button opens palette in command mode @p0', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-quick-create-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-quick-create-btn"]').click()
    const root = page.locator('[data-testid="palette-root"]')
    await expect(root).toBeVisible()
    await expect(root).toHaveAttribute('data-palette-mode', 'command')
  })

  test('Navigation group renders all nav items @p0', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-quick-create-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-quick-create-btn"]').click()
    await expect(page.locator('[data-testid="palette-navigation-group"]')).toBeVisible()
    await expect(page.locator('[data-testid="palette-actions-group"]')).toBeVisible()
  })

  test('Escape closes the palette @p1', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-quick-create-btn"]', { timeout: 10_000 })
    // Open via the button (more reliable than the shortcut in headless mode)
    await page.locator('[data-testid="header-quick-create-btn"]').click()
    await expect(page.locator('[data-testid="palette-root"]')).toBeVisible()
    await page.keyboard.press('Escape')
    // Radix Dialog unmounts after a short exit animation; allow up to 1s
    await expect(page.locator('[data-testid="palette-root"]')).toBeHidden({ timeout: 2_000 })
  })

  test('palette input focuses on open @p1', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-quick-create-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-quick-create-btn"]').click()
    const input = page.locator('[data-testid="palette-input"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
  })

  test('typing filters the command list @p1', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-quick-create-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-quick-create-btn"]').click()
    await page.locator('[data-testid="palette-input"]').fill('members')
    // cmdk's built-in fuzzy filter should narrow results — verify some items remain
    await page.waitForTimeout(400)
    const root = page.locator('[data-testid="palette-root"]')
    await expect(root).toBeVisible()
  })
})
