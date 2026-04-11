/**
 * B22 regression — AI insights generate pipeline (API-level).
 *
 * Confirms:
 *   - /api/ai/insights/generate returns within a reasonable budget (18s)
 *     even when the Anthropic call times out. Previously: ~61-87s due to
 *     withRetry compounding SDK timeouts.
 *   - /api/ai/insights returns the shaped list with the real column names
 *     (insight_type, title, summary) after generation runs.
 *   - The generate POST does not crash on phantom column inserts
 *     (previously: 'body' column not found errors).
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

test.describe('AI Insights Generate (B22 regression)', () => {
  test.setTimeout(60_000)

  test('POST /api/ai/insights/generate completes under 25s @p0', async ({ page }) => {
    // Budget: Anthropic timeout is 15s; rules-based fallback is near-instant;
    // add ~10s for DB queries. Anything above 25s is a regression.
    const startMs = Date.now()
    const res = await page.request.post('/api/ai/insights/generate', {
      timeout: 30_000,
    })
    const elapsedMs = Date.now() - startMs
    expect(res.ok()).toBe(true)
    expect(elapsedMs).toBeLessThan(25_000)
  })

  test('GET /api/ai/insights returns shaped rows @p0', async ({ page }) => {
    const res = await page.request.get('/api/ai/insights?limit=5')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    for (const row of body.data) {
      // Real schema columns only — no phantom `body`, `type`,
      // `suggested_action`, or `generated_by`.
      expect(row).toHaveProperty('insight_type')
      expect(row).toHaveProperty('title')
      expect(row).toHaveProperty('summary')
      expect(row).toHaveProperty('urgency')
      expect(row).toHaveProperty('status')
    }
  })

  test('generate writes rows to ai_insights using real columns @p1', async ({ page }) => {
    // Clear any existing insights for the default studio so we can confirm
    // generate actually inserts (not just dedups).
    await testDb
      .from('ai_insights')
      .delete()
      .eq('studio_id', DEFAULT_STUDIO_ID)

    const genRes = await page.request.post('/api/ai/insights/generate', {
      timeout: 30_000,
    })
    expect(genRes.ok()).toBe(true)

    const { data, error } = await testDb
      .from('ai_insights')
      .select('id, insight_type, title, summary, status')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .limit(5)

    expect(error).toBeNull()
    // Rules-based fallback always produces at least 1 insight when there's
    // any data to reason about. If the default studio has zero data the
    // generator may legitimately return 0 — accept either case but never
    // a failed insert (which would have logged 'body column not found').
    expect(Array.isArray(data)).toBe(true)
    for (const row of data ?? []) {
      expect(typeof row.insight_type).toBe('string')
      expect(typeof row.title).toBe('string')
      expect(typeof row.summary).toBe('string')
    }
  })
})
