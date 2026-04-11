/**
 * Tier 6.4 — Analytics: Pricing Simulator Create (API-level)
 *
 * Exercises POST /api/pricing-simulator + GET /api/pricing-simulator and the
 * analyze subroute.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestPricing_'

function uniqueName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('pricing_simulations')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${PREFIX}%`)
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length > 0) {
    await testDb.from('activity_log').delete().eq('subject_type', 'pricing_simulation').in('subject_id', ids)
    await testDb.from('pricing_simulations').delete().in('id', ids)
  }
}

function sampleChanges() {
  return [
    {
      plan_id: '00000000-0000-4000-a000-000000000011',
      plan_name: 'Monthly Unlimited',
      current_price: 15900,
      new_price: 17900,
    },
    {
      plan_id: '00000000-0000-4000-a000-000000000012',
      plan_name: '10-Class Pack',
      current_price: 22000,
      new_price: 24000,
    },
  ]
}

test.describe('Analytics — Pricing Simulator Create (Tier 6.4)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('creates pricing simulation + activity_log @p0', async ({ page }) => {
    const name = uniqueName('PriceBump')
    const res = await page.request.post('/api/pricing-simulator', {
      data: {
        name,
        description: 'Test: 12% bump on unlimited + class pack',
        changes: sampleChanges(),
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.name).toBe(name)
    expect(body.data.status).toBe('draft')
    expect(Array.isArray(body.data.changes)).toBe(true)
    expect(body.data.changes.length).toBe(2)

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', body.data.id)
      .eq('type', 'pricing_simulation_created')
    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toContain('Pricing simulation created')
    expect(logs![0].description).toContain(name)
  })

  test('rejects missing name @p1', async ({ page }) => {
    const res = await page.request.post('/api/pricing-simulator', {
      data: { changes: sampleChanges() },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects missing changes @p1', async ({ page }) => {
    const res = await page.request.post('/api/pricing-simulator', {
      data: { name: uniqueName('NoChanges') },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects empty changes array @p1', async ({ page }) => {
    const res = await page.request.post('/api/pricing-simulator', {
      data: { name: uniqueName('Empty'), changes: [] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects incomplete change entry @p1', async ({ page }) => {
    const res = await page.request.post('/api/pricing-simulator', {
      data: {
        name: uniqueName('Incomplete'),
        changes: [{ plan_id: 'x' }],
      },
    })
    expect(res.status()).toBe(400)
  })

  test('GET /api/pricing-simulator lists simulations @p1', async ({ page }) => {
    const name = uniqueName('Listable')
    await page.request.post('/api/pricing-simulator', {
      data: { name, changes: sampleChanges() },
    })

    const listRes = await page.request.get('/api/pricing-simulator')
    expect(listRes.ok()).toBe(true)
    const body = await listRes.json()
    const found = (body.data ?? []).find((s: { name: string }) => s.name === name)
    expect(found).toBeTruthy()
  })
})
