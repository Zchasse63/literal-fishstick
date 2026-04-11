/**
 * Tier 5.7 — AI: Member profile health-score insights (API-level)
 *
 * Exercises POST /api/ai/health-score. The underlying generator has a
 * rules-based fallback when ANTHROPIC_API_KEY is unset, so we assert on the
 * deterministic shape.
 */
import { test, expect } from '@playwright/test'
import { testDb, seedMember, deleteMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

type Seeded = { memberId: string; profileId: string }

async function cleanup(seeded: Seeded[]): Promise<void> {
  for (const s of seeded) {
    await testDb.from('ai_cache').delete().eq('studio_id', DEFAULT_STUDIO_ID).eq('entity_id', s.memberId)
    await deleteMember(s.memberId, s.profileId)
  }
}

test.describe('AI — Member Health Score (Tier 5.7)', () => {
  test('POST /api/ai/health-score returns score + risk_level @p0', async ({ page }) => {
    const seeded = await seedMember({ fullName: 'E2ETestHS_Basic' })
    try {
      const res = await page.request.post('/api/ai/health-score', {
        data: { member_id: seeded.memberId },
      })
      expect(res.ok()).toBe(true)
      const body = await res.json()
      expect(typeof body.score).toBe('number')
      expect(body.score).toBeGreaterThanOrEqual(0)
      expect(body.score).toBeLessThanOrEqual(100)
      expect(['healthy', 'watch', 'at_risk', 'critical']).toContain(body.risk_level)
      expect(typeof body.narrative).toBe('string')
      expect(Array.isArray(body.top_factors)).toBe(true)
      expect(typeof body.recommended_action).toBe('string')
      expect(body.cached).toBe(false)
    } finally {
      await cleanup([{ memberId: seeded.memberId, profileId: seeded.profileId }])
    }
  })

  test('second request returns cached result @p0', async ({ page }) => {
    const seeded = await seedMember({ fullName: 'E2ETestHS_Cache' })
    try {
      const first = await page.request.post('/api/ai/health-score', {
        data: { member_id: seeded.memberId },
      })
      expect(first.ok()).toBe(true)
      const firstBody = await first.json()

      const second = await page.request.post('/api/ai/health-score', {
        data: { member_id: seeded.memberId },
      })
      expect(second.ok()).toBe(true)
      const secondBody = await second.json()
      expect(secondBody.cached).toBe(true)
      expect(secondBody.score).toBe(firstBody.score)
      expect(secondBody.risk_level).toBe(firstBody.risk_level)
    } finally {
      await cleanup([{ memberId: seeded.memberId, profileId: seeded.profileId }])
    }
  })

  test('rejects missing member_id @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/health-score', {
      data: {},
    })
    expect(res.status()).toBe(400)
  })

  test('returns 404 for non-existent member @p1', async ({ page }) => {
    const res = await page.request.post('/api/ai/health-score', {
      data: { member_id: '00000000-0000-4000-a000-000000000099' },
    })
    expect(res.status()).toBe(404)
  })
})
