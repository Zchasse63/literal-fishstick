/**
 * Tier 6.2 — Analytics: Custom Report Create (API-level)
 *
 * Exercises POST /api/reports + GET /api/reports. Verifies CHECK constraint
 * enforcement, required-field validation, and activity_log write.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestReport_'

function uniqueName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('saved_reports')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${PREFIX}%`)
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length > 0) {
    await testDb.from('activity_log').delete().eq('subject_type', 'saved_report').in('subject_id', ids)
    await testDb.from('saved_reports').delete().in('id', ids)
  }
}

test.describe('Analytics — Custom Report Create (Tier 6.2)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('creates revenue report + activity_log @p0', async ({ page }) => {
    const name = uniqueName('Revenue')
    const res = await page.request.post('/api/reports', {
      data: {
        name,
        report_type: 'revenue',
        columns: ['date', 'amount', 'type'],
        filters: [],
        time_range: 'last_30_days',
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.name).toBe(name)
    expect(body.data.report_type).toBe('revenue')

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', body.data.id)
      .eq('type', 'report_created')
    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toContain('Report created')
    expect(logs![0].description).toContain(name)
  })

  test('creates attendance report @p0', async ({ page }) => {
    const name = uniqueName('Attendance')
    const res = await page.request.post('/api/reports', {
      data: {
        name,
        report_type: 'attendance',
        columns: ['date', 'class', 'check_ins'],
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.report_type).toBe('attendance')
  })

  test('rejects missing name @p1', async ({ page }) => {
    const res = await page.request.post('/api/reports', {
      data: { report_type: 'revenue', columns: ['amount'] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects missing columns @p1', async ({ page }) => {
    const res = await page.request.post('/api/reports', {
      data: { name: uniqueName('NoCols'), report_type: 'revenue' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects empty columns array @p1', async ({ page }) => {
    const res = await page.request.post('/api/reports', {
      data: { name: uniqueName('EmptyCols'), report_type: 'revenue', columns: [] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects invalid report_type @p1', async ({ page }) => {
    const res = await page.request.post('/api/reports', {
      data: { name: uniqueName('BadType'), report_type: 'bogus', columns: ['a'] },
    })
    expect(res.status()).toBe(400)
  })

  test('GET /api/reports lists created reports @p1', async ({ page }) => {
    const name = uniqueName('Listable')
    await page.request.post('/api/reports', {
      data: { name, report_type: 'membership', columns: ['tier', 'status'] },
    })

    const listRes = await page.request.get('/api/reports')
    expect(listRes.ok()).toBe(true)
    const body = await listRes.json()
    const found = (body.data ?? []).find((r: { name: string }) => r.name === name)
    expect(found).toBeTruthy()
  })
})
