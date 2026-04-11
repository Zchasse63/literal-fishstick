/**
 * Tier 5.8 — AI: Churn prediction (API-level narrow scope)
 *
 * Exercises POST /api/ai/churn-prediction. The `predictChurn` generator has
 * a rules-based fallback when ANTHROPIC_API_KEY is unset.
 */
import { test, expect } from '@playwright/test'
import { testDb, seedMember, deleteMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

async function clearCache(memberId: string): Promise<void> {
  await testDb
    .from('ai_cache')
    .delete()
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .eq('cache_key', `churn_narrative:${memberId}`)
}

test.describe('AI — Churn Prediction (Tier 5.8)', () => {
  test('POST /api/ai/churn-prediction returns prediction shape @p0', async ({ page }) => {
    const seeded = await seedMember({ fullName: 'E2ETestChurn_Basic' })
    try {
      const res = await page.request.post('/api/ai/churn-prediction', {
        data: { member_id: seeded.memberId },
      })
      expect(res.ok()).toBe(true)
      const body = await res.json()
      expect(typeof body.churn_probability).toBe('number')
      expect(body.churn_probability).toBeGreaterThanOrEqual(0)
      expect(body.churn_probability).toBeLessThanOrEqual(100)
      expect(['low', 'moderate', 'high', 'critical']).toContain(body.risk_level)
      expect(typeof body.narrative).toBe('string')
      expect(Array.isArray(body.contributing_factors)).toBe(true)
      expect(Array.isArray(body.recommended_interventions)).toBe(true)
      expect(['winback', 're-engage', 'save', 'nurture']).toContain(body.retention_playbook)
      expect(body.cached).toBe(false)
    } finally {
      await clearCache(seeded.memberId)
      await deleteMember(seeded.memberId, seeded.profileId)
    }
  })

  test('second request returns cached prediction @p0', async ({ page }) => {
    const seeded = await seedMember({ fullName: 'E2ETestChurn_Cache' })
    try {
      const first = await page.request.post('/api/ai/churn-prediction', {
        data: { member_id: seeded.memberId },
      })
      expect(first.ok()).toBe(true)
      const firstBody = await first.json()

      const second = await page.request.post('/api/ai/churn-prediction', {
        data: { member_id: seeded.memberId },
      })
      expect(second.ok()).toBe(true)
      const secondBody = await second.json()
      expect(secondBody.cached).toBe(true)
      expect(secondBody.churn_probability).toBe(firstBody.churn_probability)
    } finally {
      await clearCache(seeded.memberId)
      await deleteMember(seeded.memberId, seeded.profileId)
    }
  })

  test('rejects missing member_id @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/churn-prediction', {
      data: {},
    })
    expect(res.status()).toBe(400)
  })

  test('returns 404 for non-existent member @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/churn-prediction', {
      data: { member_id: '00000000-0000-4000-a000-000000000099' },
    })
    expect(res.status()).toBe(404)
  })
})
