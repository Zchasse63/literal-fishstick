/**
 * Tier 5.1 — Marketing: Create Campaign (API-level narrow scope)
 *
 * Six scenarios covering POST /api/campaigns + GET /api/campaigns.
 * Tier 5.1 adds description + capture-and-log, and aligns the route
 * with the real campaigns schema (body_html, ab_variants jsonb).
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestCampaign_'

function uniqueName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('campaigns')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${PREFIX}%`)
  const ids = (data ?? []).map((c) => c.id)
  if (ids.length > 0) {
    await testDb.from('activity_log').delete().eq('subject_type', 'campaign').in('subject_id', ids)
    await testDb.from('campaigns').delete().in('id', ids)
  }
}

test.describe('Marketing — Create Campaign (Tier 5.1)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('creates email campaign + activity_log @p0', async ({ page }) => {
    const name = uniqueName('Email')
    const res = await page.request.post('/api/campaigns', {
      data: { name, type: 'email', subject: 'Test Subject', body_html: '<p>Hi</p>' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.name).toBe(name)
    expect(body.data.type).toBe('email')
    expect(body.data.status).toBe('draft')
    expect(body.data.body_html).toBe('<p>Hi</p>')

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', body.data.id)
      .eq('type', 'campaign_created')
    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toContain('Campaign created')
    expect(logs![0].description).toContain(name)
  })

  test('creates SMS campaign @p0', async ({ page }) => {
    const name = uniqueName('SMS')
    const res = await page.request.post('/api/campaigns', {
      data: { name, type: 'sms', sms_body: 'Hi from TSG!' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.type).toBe('sms')
    expect(body.data.sms_body).toBe('Hi from TSG!')
  })

  test('creates A/B test campaign with variants @p0', async ({ page }) => {
    const name = uniqueName('ABTest')
    const res = await page.request.post('/api/campaigns', {
      data: {
        name,
        type: 'email',
        ab_test_enabled: true,
        ab_variants: {
          a: { subject: 'Variant A', body_html: '<p>A</p>' },
          b: { subject: 'Variant B', body_html: '<p>B</p>' },
          split_percentage: 50,
          auto_select_winner: false,
        },
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.ab_test_enabled).toBe(true)
    expect(body.data.ab_variants).toBeTruthy()
    expect(body.data.ab_variants.a.subject).toBe('Variant A')
    expect(body.data.ab_variants.b.subject).toBe('Variant B')
  })

  test('rejects campaign missing name @p1', async ({ page }) => {
    const res = await page.request.post('/api/campaigns', {
      data: { type: 'email' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects invalid type @p1', async ({ page }) => {
    const res = await page.request.post('/api/campaigns', {
      data: { name: uniqueName('BadType'), type: 'postal_mail' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects A/B test missing variant fields @p1', async ({ page }) => {
    const res = await page.request.post('/api/campaigns', {
      data: {
        name: uniqueName('ABMissing'),
        type: 'email',
        ab_test_enabled: true,
        ab_variants: { a: { subject: 'A only' } },
      },
    })
    expect(res.status()).toBe(400)
  })
})
