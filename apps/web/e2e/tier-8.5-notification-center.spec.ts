/**
 * T8 — Tier 8.5.A8 Notification center dropdown + /api/notifications.
 */
import { test, expect } from '@playwright/test'

test.describe('Global — Notification Center (Tier 8.5.A8)', () => {
  test('header bell button renders @p0', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-notifications-btn"]', { timeout: 10_000 })
    await expect(page.locator('[data-testid="header-notifications-btn"]')).toBeVisible()
  })

  test('clicking bell opens the dropdown @p0', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-notifications-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-notifications-btn"]').click()
    await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeVisible()
  })

  test('GET /api/notifications returns shaped response @p0', async ({ page }) => {
    const res = await page.request.get('/api/notifications')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('unread_count')
    expect(body).toHaveProperty('last_read_at')
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('each notification item has title + timestamp + type @p0', async ({ page }) => {
    const res = await page.request.get('/api/notifications')
    const body = await res.json()
    for (const item of body.items) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('timestamp')
      expect(['event', 'alert']).toContain(item.type)
    }
  })

  test('POST /api/notifications marks all read @p1', async ({ page }) => {
    const res = await page.request.post('/api/notifications')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test('dropdown closes on outside click @p1', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-notifications-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-notifications-btn"]').click()
    await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeVisible()
    await page.locator('body').click({ position: { x: 400, y: 400 } })
    await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeHidden({ timeout: 2_000 })
  })
})
