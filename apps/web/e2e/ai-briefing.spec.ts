/**
 * Tier 5.6 — AI: Command Center Briefing (API-level narrow scope)
 *
 * Exercises GET /api/ai/briefing. Route has a built-in rules-based fallback
 * when ANTHROPIC_API_KEY is unset, so we assert on the deterministic fallback
 * shape rather than mocking Anthropic. When the real LLM is configured in
 * staging, the same shape is returned and tests still pass.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

async function cleanup(): Promise<void> {
  // Clear cached briefings for the default studio so each test regenerates.
  await testDb
    .from('ai_briefings')
    .delete()
    .eq('studio_id', DEFAULT_STUDIO_ID)
}

test.describe('AI — Command Center Briefing (Tier 5.6)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('GET /api/ai/briefing returns briefing + metrics @p0', async ({ page }) => {
    const res = await page.request.get('/api/ai/briefing')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(typeof body.briefing).toBe('string')
    expect(body.briefing.length).toBeGreaterThan(0)
    expect(body.metrics).toBeTruthy()
    expect(typeof body.metrics.active_members).toBe('number')
    expect(typeof body.metrics.today_classes).toBe('number')
    expect(body.cached).toBe(false)
  })

  test('second request within 30 minutes returns cached briefing @p0', async ({ page }) => {
    // First request populates cache.
    const first = await page.request.get('/api/ai/briefing')
    expect(first.ok()).toBe(true)
    const firstBody = await first.json()

    // Second request — must be served from ai_briefings cache.
    const second = await page.request.get('/api/ai/briefing')
    expect(second.ok()).toBe(true)
    const secondBody = await second.json()
    expect(secondBody.cached).toBe(true)
    expect(secondBody.briefing).toBe(firstBody.briefing)
  })

  test('metrics structure is stable @p1', async ({ page }) => {
    const res = await page.request.get('/api/ai/briefing')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const keys = [
      'today_classes',
      'today_bookings',
      'total_capacity',
      'checkins_today',
      'revenue_today',
      'revenue_mtd',
      'active_members',
      'at_risk_members',
      'new_members_this_week',
      'expiring_credits_7d',
      'waitlisted_today',
    ]
    for (const key of keys) {
      expect(body.metrics).toHaveProperty(key)
      expect(typeof body.metrics[key]).toBe('number')
    }
  })

  test('writes cache row to ai_briefings @p1', async ({ page }) => {
    const res = await page.request.get('/api/ai/briefing')
    expect(res.ok()).toBe(true)
    const { data } = await testDb
      .from('ai_briefings')
      .select('id, briefing, generated_at')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .order('generated_at', { ascending: false })
      .limit(1)
    expect(data?.length).toBeGreaterThanOrEqual(1)
    expect(data![0].briefing).toBeTruthy()
  })

  test('briefing includes structured bullet points @p1', async ({ page }) => {
    const res = await page.request.get('/api/ai/briefing')
    const body = await res.json()
    // The rules-based fallback always starts lines with a "•" bullet.
    // The LLM is instructed to do the same. Either way we expect bullets.
    expect(body.briefing).toMatch(/[•\u2022]/)
  })
})
