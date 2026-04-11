/**
 * Tier 5.10 — AI: Email draft assist / campaign copy (API-level)
 *
 * Exercises POST /api/ai/campaign-copy. The generator has a rules-based
 * fallback when ANTHROPIC_API_KEY is unset.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

async function cleanup(): Promise<void> {
  await testDb
    .from('ai_cache')
    .delete()
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .eq('cache_type', 'campaign_copy')
}

test.describe('AI — Campaign Copy Draft (Tier 5.10)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('POST /api/ai/campaign-copy returns draft shape @p0', async ({ page }) => {
    const res = await page.request.post('/api/ai/campaign-copy', {
      data: {
        campaign_type: 'winback',
        audience_description: 'Members who have not checked in for 14+ days',
        tone: 'friendly',
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(typeof body.subject_line).toBe('string')
    expect(body.subject_line.length).toBeGreaterThan(0)
    expect(typeof body.preview_text).toBe('string')
    expect(typeof body.body_html).toBe('string')
    expect(typeof body.body_text).toBe('string')
    expect(Array.isArray(body.suggested_merge_tags)).toBe(true)
    expect(body.cached).toBe(false)
  })

  test('second request returns cached copy @p0', async ({ page }) => {
    const payload = {
      campaign_type: 'retention',
      audience_description: 'Active monthly members approaching 90 days',
      tone: 'professional',
    }
    const first = await page.request.post('/api/ai/campaign-copy', { data: payload })
    expect(first.ok()).toBe(true)
    const firstBody = await first.json()

    const second = await page.request.post('/api/ai/campaign-copy', { data: payload })
    expect(second.ok()).toBe(true)
    const secondBody = await second.json()
    expect(secondBody.cached).toBe(true)
    expect(secondBody.subject_line).toBe(firstBody.subject_line)
  })

  test('rejects missing campaign_type @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/campaign-copy', {
      data: { audience_description: 'anyone' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects missing audience_description @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/campaign-copy', {
      data: { campaign_type: 'promotion' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects invalid campaign_type @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/campaign-copy', {
      data: { campaign_type: 'bogus', audience_description: 'anyone' },
    })
    expect(res.status()).toBe(400)
  })
})
