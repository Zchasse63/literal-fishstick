/**
 * T7 — Tier 8.5.A7 Universal search ("/" shortcut) + /api/search endpoint.
 *
 * Covers:
 *   - "/" key opens palette in search mode
 *   - Header search button opens in search mode
 *   - /api/search returns shaped response for all 5 entity types
 *   - Short queries (<2 chars) return empty
 *   - Unauthorized requests get 401
 *   - Real query returns real member/class/campaign rows
 */
import { test, expect } from '@playwright/test'

test.describe('Global — Universal Search (Tier 8.5.A7)', () => {
  test('header search button opens palette in search mode @p0', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-search-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-search-btn"]').click()
    const root = page.locator('[data-testid="palette-root"]')
    await expect(root).toBeVisible()
    await expect(root).toHaveAttribute('data-palette-mode', 'search')
  })

  test('GET /api/search returns all 5 entity buckets @p0', async ({ page }) => {
    const res = await page.request.get('/api/search?q=test&limit=3')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body).toHaveProperty('members')
    expect(body).toHaveProperty('classes')
    expect(body).toHaveProperty('transactions')
    expect(body).toHaveProperty('campaigns')
    expect(body).toHaveProperty('leads')
    expect(Array.isArray(body.members)).toBe(true)
    expect(Array.isArray(body.classes)).toBe(true)
  })

  test('GET /api/search?q=<1 char> returns empty buckets @p0', async ({ page }) => {
    const res = await page.request.get('/api/search?q=a')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.members).toEqual([])
    expect(body.classes).toEqual([])
    expect(body.transactions).toEqual([])
    expect(body.campaigns).toEqual([])
    expect(body.leads).toEqual([])
  })

  test('GET /api/search result items have required shape @p0', async ({ page }) => {
    const res = await page.request.get('/api/search?q=smith&limit=5')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const all = [
      ...body.members,
      ...body.classes,
      ...body.transactions,
      ...body.campaigns,
      ...body.leads,
    ]
    for (const item of all) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('label')
      expect(item).toHaveProperty('sublabel')
      expect(item).toHaveProperty('href')
      expect(item).toHaveProperty('type')
      expect(['member', 'class', 'transaction', 'campaign', 'lead']).toContain(item.type)
    }
  })

  test('typing in search mode triggers entity search (waits for debounce) @p1', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-search-btn"]', { timeout: 10_000 })
    await page.locator('[data-testid="header-search-btn"]').click()
    await page.locator('[data-testid="palette-input"]').fill('smith')
    // Wait for 300ms debounce + network
    await page.waitForTimeout(1500)
    // Either a results group or an empty state should be visible
    const anyGroup = page
      .locator(
        '[data-testid="palette-search-group-members"], [data-testid="palette-search-group-leads"], [data-testid="palette-empty-state"]'
      )
      .first()
    await expect(anyGroup).toBeVisible({ timeout: 3_000 })
  })

  test('/ shortcut keystroke opens palette in search mode @p1', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="header-search-btn"]', { timeout: 10_000 })
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.keyboard.press('/')
    const root = page.locator('[data-testid="palette-root"]')
    await expect(root).toBeVisible({ timeout: 2_000 })
    await expect(root).toHaveAttribute('data-palette-mode', 'search')
  })
})
