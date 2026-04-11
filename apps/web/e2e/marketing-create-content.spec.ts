/**
 * Tier 5.4 — Marketing: Content Hub Create (API-level)
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestContent_'

function uniqueTitle(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('content_posts')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('title', `${PREFIX}%`)
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length > 0) {
    await testDb.from('activity_log').delete().eq('subject_type', 'content_post').in('subject_id', ids)
    await testDb.from('content_posts').delete().in('id', ids)
  }
}

test.describe('Marketing — Content Hub Create (Tier 5.4)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('staff creates auto-approved post @p0', async ({ page }) => {
    const title = uniqueTitle('StaffPost')
    const res = await page.request.post('/api/content', {
      data: { title, body: 'Hello everyone, welcome back!', type: 'post' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.title).toBe(title)
    expect(body.data.is_approved).toBe(true) // staff = auto-approved
    expect(body.data.is_published).toBe(true)

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', body.data.id)
      .eq('type', 'content_post_created')
    expect(logs?.length).toBeGreaterThanOrEqual(1)
  })

  test('rejects missing title @p1', async ({ page }) => {
    const res = await page.request.post('/api/content', {
      data: { body: 'No title' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects missing body @p1', async ({ page }) => {
    const res = await page.request.post('/api/content', {
      data: { title: uniqueTitle('NoBody') },
    })
    expect(res.status()).toBe(400)
  })

  test('GET /api/content lists posts @p1', async ({ page }) => {
    const title = uniqueTitle('Listable')
    await page.request.post('/api/content', {
      data: { title, body: 'Test content' },
    })
    const listRes = await page.request.get('/api/content')
    expect(listRes.ok()).toBe(true)
    const body = await listRes.json()
    const found = (body.data ?? []).find((p: { title: string }) => p.title === title)
    expect(found).toBeTruthy()
  })
})
