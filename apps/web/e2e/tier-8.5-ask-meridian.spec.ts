/**
 * T10 — Tier 8.5.A10 Ask Meridian NL query surface.
 */
import { test, expect } from '@playwright/test'

test.describe('Command Center — Ask Meridian (Tier 8.5.A10)', () => {
  test('ask meridian card renders on command center @p0', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="ask-meridian-root"]')).toBeVisible({ timeout: 10_000 })
  })

  test('input + submit button + examples render @p0', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="ask-meridian-root"]', { timeout: 10_000 })
    await expect(page.locator('[data-testid="ask-meridian-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="ask-meridian-submit"]')).toBeVisible()
    await expect(page.locator('[data-testid="ask-meridian-examples"]')).toBeVisible()
  })

  test('example prompts buttons are clickable @p1', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="ask-meridian-examples"]', { timeout: 10_000 })
    const examples = page.locator('[data-testid="ask-meridian-examples"] button')
    expect(await examples.count()).toBeGreaterThanOrEqual(3)
  })

  test('POST /api/ai/search returns shaped response for stats query @p0', async ({ page }) => {
    const res = await page.request.post('/api/ai/search', {
      data: { query: 'How many members joined in the last 30 days?' },
      timeout: 30_000,
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body).toHaveProperty('sql')
    expect(body).toHaveProperty('explanation')
    expect(body).toHaveProperty('result_type')
    expect(body).toHaveProperty('data')
  })

  test('rejects empty query with 400 @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/search', {
      data: { query: '' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects query over 500 chars with 400 @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/search', {
      data: { query: 'x'.repeat(501) },
    })
    expect(res.status()).toBe(400)
  })
})
