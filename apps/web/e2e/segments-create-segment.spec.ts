/**
 * Tier 4.8 — Smart Segments: Create Segment (narrow scope, API-level)
 *
 * Six scenarios covering POST /api/segments + GET /api/segments.
 *
 * Tier 4.8 fixes (inline): the POST handler was missing a role check
 * and was missing the activity_log entry entirely. Both added.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestSegment_'

function uniqueName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('smart_segments')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${PREFIX}%`)
  const ids = (data ?? []).map((s) => s.id)
  if (ids.length > 0) {
    await testDb
      .from('activity_log')
      .delete()
      .eq('subject_type', 'smart_segment')
      .in('subject_id', ids)
    await testDb.from('smart_segments').delete().in('id', ids)
  }
}

test.describe('Smart Segments — Create Segment (Tier 4.8, API-level)', () => {
  test.beforeEach(async () => {
    await cleanup()
  })

  test.afterAll(async () => {
    await cleanup()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: create a simple segment
  // ---------------------------------------------------------------------

  test('creates a smart segment with rules + activity_log @p0', async ({
    page,
  }) => {
    const name = uniqueName('HighValue')
    const res = await page.request.post('/api/segments', {
      data: {
        name,
        description: 'Members who spent over $500 lifetime',
        rules: {
          all: [
            { field: 'lifetime_value', operator: '>=', value: 500 },
          ],
        },
        color: '#10B981',
        icon: 'trending-up',
      },
    })

    expect(res.ok()).toBe(true)
    expect(res.status()).toBe(201)
    const segment = await res.json()
    expect(segment.id).toBeTruthy()
    expect(segment.name).toBe(name)
    expect(segment.description).toBe('Members who spent over $500 lifetime')
    expect(segment.color).toBe('#10B981')
    expect(segment.icon).toBe('trending-up')
    expect(segment.is_system).toBe(false)

    // DB: activity_log row landed
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, metadata')
      .eq('subject_id', segment.id)
      .eq('type', 'settings_updated')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toBeTruthy()
    expect(logs![0].description).toContain('Smart segment created')
    expect(logs![0].description).toContain(name)
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 defaults applied when color/icon omitted
  // ---------------------------------------------------------------------

  test('applies defaults for color and icon when not provided @p0', async ({
    page,
  }) => {
    const name = uniqueName('Defaults')
    const res = await page.request.post('/api/segments', {
      data: {
        name,
        rules: { all: [{ field: 'status', operator: '==', value: 'active' }] },
      },
    })

    expect(res.ok()).toBe(true)
    const segment = await res.json()
    expect(segment.color).toBe('#4F46E5')
    expect(segment.icon).toBe('users')
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0 GET /api/segments returns the created segment
  // ---------------------------------------------------------------------

  test('GET /api/segments returns the created segment in the list @p0', async ({
    page,
  }) => {
    const name = uniqueName('Listable')
    await page.goto('/segments')

    await page.request.post('/api/segments', {
      data: {
        name,
        rules: { all: [] },
      },
    })

    const listRes = await page.request.get('/api/segments')
    expect(listRes.ok()).toBe(true)
    const segments = await listRes.json()

    const found = (segments as { name: string }[]).find((s) => s.name === name)
    expect(found).toBeTruthy()
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P1 missing name rejected
  // ---------------------------------------------------------------------

  test('rejects request missing name @p1', async ({ page }) => {
    const res = await page.request.post('/api/segments', {
      data: {
        rules: { all: [] },
      },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('name')
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 missing rules rejected
  // ---------------------------------------------------------------------

  test('rejects request missing rules @p1', async ({ page }) => {
    const name = uniqueName('NoRules')
    const res = await page.request.post('/api/segments', {
      data: { name },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('rules')
  })

  // ---------------------------------------------------------------------
  // Scenario 6 — P1 blank name rejected
  // ---------------------------------------------------------------------

  test('rejects request with whitespace-only name @p1', async ({ page }) => {
    const res = await page.request.post('/api/segments', {
      data: {
        name: '   ',
        rules: { all: [] },
      },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
  })
})
