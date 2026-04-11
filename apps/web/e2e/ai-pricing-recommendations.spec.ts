/**
 * Tier 5.9 — AI: Pricing recommendations (API-level narrow scope)
 *
 * Exercises GET /api/ai/recommendations?type=pricing and other types.
 * The underlying `generateRecommendations` has a rules-based fallback
 * when ANTHROPIC_API_KEY is unset.
 */
import { test, expect } from '@playwright/test'

test.describe('AI — Pricing Recommendations (Tier 5.9)', () => {
  test('GET /api/ai/recommendations?type=pricing returns list @p0', async ({ page }) => {
    const res = await page.request.get('/api/ai/recommendations?type=pricing')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.type).toBe('pricing')
    expect(Array.isArray(body.recommendations)).toBe(true)
    expect(body.recommendations.length).toBeGreaterThan(0)
    // Each recommendation should be a non-empty numbered string
    for (const rec of body.recommendations) {
      expect(typeof rec).toBe('string')
      expect(rec).toMatch(/^\d+\./)
    }
    expect(body.metrics).toBeTruthy()
    expect(typeof body.metrics.monthly_revenue).toBe('number')
    expect(typeof body.metrics.active_members).toBe('number')
  })

  test('GET /api/ai/recommendations?type=scheduling returns list @p1', async ({ page }) => {
    const res = await page.request.get('/api/ai/recommendations?type=scheduling')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.type).toBe('scheduling')
    expect(Array.isArray(body.recommendations)).toBe(true)
    expect(typeof body.metrics.recent_classes).toBe('number')
  })

  test('GET /api/ai/recommendations?type=retention returns list @p1', async ({ page }) => {
    const res = await page.request.get('/api/ai/recommendations?type=retention')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.type).toBe('retention')
    expect(typeof body.metrics.at_risk_members).toBe('number')
  })

  test('rejects invalid type @p1', async ({ page }) => {
    const res = await page.request.get('/api/ai/recommendations?type=bogus')
    expect(res.status()).toBe(400)
  })
})
