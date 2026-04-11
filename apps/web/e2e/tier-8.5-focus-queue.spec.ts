/**
 * T9 — Tier 8.5.A9 Command Center "Today's Focus" queue.
 */
import { test, expect } from '@playwright/test'

test.describe('Command Center — Focus Queue (Tier 8.5.A9)', () => {
  test('focus queue card renders on command center @p0', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="command-focus-queue"]')).toBeVisible({ timeout: 10_000 })
  })

  test('GET /api/command-center/focus returns shaped response @p0', async ({ page }) => {
    const res = await page.request.get('/api/command-center/focus')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('generated_at')
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('each focus item has required fields @p0', async ({ page }) => {
    const res = await page.request.get('/api/command-center/focus')
    const body = await res.json()
    for (const item of body.items) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('kind')
      expect(item).toHaveProperty('priority')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('description')
      expect(item).toHaveProperty('href')
      expect(item).toHaveProperty('cta')
      expect(typeof item.priority).toBe('number')
      expect(
        [
          'failed_payment',
          'credit_expiring',
          'at_risk_member',
          'class_low_capacity',
          'unassigned_lead',
          'class_oversold',
        ].includes(item.kind)
      ).toBe(true)
    }
  })

  test('items are sorted by priority DESC @p0', async ({ page }) => {
    const res = await page.request.get('/api/command-center/focus')
    const body = await res.json()
    const priorities = body.items.map((i: { priority: number }) => i.priority)
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1])
    }
  })

  test('default limit is 5 items max @p1', async ({ page }) => {
    const res = await page.request.get('/api/command-center/focus')
    const body = await res.json()
    expect(body.items.length).toBeLessThanOrEqual(5)
  })

  test('limit param caps at 10 @p1', async ({ page }) => {
    const res = await page.request.get('/api/command-center/focus?limit=50')
    const body = await res.json()
    expect(body.items.length).toBeLessThanOrEqual(10)
  })

  test('focus items have expected CTA link format @p1', async ({ page }) => {
    const res = await page.request.get('/api/command-center/focus')
    const body = await res.json()
    for (const item of body.items) {
      expect(typeof item.href).toBe('string')
      expect(item.href.length).toBeGreaterThan(1)
      expect(item.href.startsWith('/')).toBe(true)
    }
  })
})
