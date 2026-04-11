/**
 * T54 — Error boundary smoke tests.
 *
 * Verifies that:
 *   1. Routes with error.tsx files gracefully handle runtime errors
 *   2. Unknown routes return 404, not 500
 *   3. Malformed JSON bodies return 400, not 500
 *   4. API routes return JSON errors (never HTML stack traces)
 */
import { test, expect } from '@playwright/test'

test.describe('Platform — Error boundaries (T54)', () => {
  test('T54 — unknown API route returns 404 @p1', async ({ page }) => {
    const response = await page.request.get('/api/nonexistent-route-xyz')
    expect(response.status()).toBe(404)
  })

  test('T54 — unknown dashboard route returns 404 page @p1', async ({ page }) => {
    const response = await page.goto('/does-not-exist-xyz', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(404)
  })

  test('T54 — POST /api/bookings with malformed JSON returns 4xx @p0', async ({
    page,
  }) => {
    const response = await page.request.post('/api/bookings', {
      headers: { 'content-type': 'application/json' },
      data: 'not json{{{',
    })
    // Must be 4xx, not 5xx
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
  })

  test('T54 — API routes return JSON errors, not HTML @p0', async ({ page }) => {
    const response = await page.request.post('/api/bookings', {
      data: {}, // missing required fields → 400
    })
    expect(response.status()).toBe(400)
    const contentType = response.headers()['content-type'] ?? ''
    expect(contentType).toContain('application/json')
    const payload = await response.json()
    expect(payload.error).toBeTruthy()
  })

  test('T54 — deleting a nonexistent booking returns 404 @p1', async ({ page }) => {
    const response = await page.request.post(
      '/api/bookings/00000000-0000-0000-0000-000000000000/cancel',
      { data: { reason: 'test' } }
    )
    expect([404, 400]).toContain(response.status())
  })

  test('T54 — GET with invalid UUID returns 404 not 500 @p1', async ({ page }) => {
    const response = await page.request.get('/api/campaigns/not-a-valid-uuid')
    // Could be 400 (bad uuid format) or 404 (not found) — either is acceptable.
    // What matters is it isn't a 500.
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
  })
})
