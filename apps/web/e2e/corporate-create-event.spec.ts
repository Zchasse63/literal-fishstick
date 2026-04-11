/**
 * Tier 4.6 — Corporate: Create Event (narrow scope, API-level)
 *
 * Five scenarios covering POST /api/events. Tests use page.request directly.
 *
 * BUG-025 (`'event_created'` not in activity_log enum + missing description)
 * fixed inline. The Tier 4.5 migration already added `corporate_event_*` to
 * the enum. The Tier 4.6 RLS mega-migration also fixed the events table's
 * silent breakage (BUG-026 — same pattern as BUG-024 on company_accounts).
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const TEST_NAME_PREFIX = 'E2ETestEvent_'

function uniqueEventName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${TEST_NAME_PREFIX}${label}_${tag}`
}

function tomorrowAt(hh: number, mm: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

async function cleanupTestEvents(): Promise<void> {
  const { data: events } = await testDb
    .from('events')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${TEST_NAME_PREFIX}%`)

  const ids = (events ?? []).map((e) => e.id)
  if (ids.length > 0) {
    await testDb
      .from('activity_log')
      .delete()
      .eq('subject_type', 'event')
      .in('subject_id', ids)
    await testDb.from('events').delete().in('id', ids)
  }
}

test.describe('Corporate — Create Event (Tier 4.6, API-level)', () => {
  test.beforeEach(async () => {
    await cleanupTestEvents()
  })

  test.afterAll(async () => {
    await cleanupTestEvents()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path
  // ---------------------------------------------------------------------

  test('creates an event with required fields @p0', async ({ page }) => {
    const name = uniqueEventName('Happy')
    await page.goto('/corporate')

    const res = await page.request.post('/api/events', {
      data: {
        name,
        event_type: 'private_party',
        start_time: tomorrowAt(18, 0),
        end_time: tomorrowAt(20, 0),
      },
    })

    expect(res.ok()).toBe(true)
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.name).toBe(name)
    expect(body.data.event_type).toBe('private_party')
    expect(body.data.status).toBe('inquiry')

    // DB: row exists
    const { data: event } = await testDb
      .from('events')
      .select('id, name, status, event_type')
      .eq('id', body.data.id)
      .single()
    expect(event?.name).toBe(name)

    // DB: activity_log row landed (BUG-025 fix)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, metadata')
      .eq('subject_id', body.data.id)
      .eq('type', 'corporate_event_created')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toBeTruthy()
    expect(logs![0].description).toContain('Event created')
    expect(logs![0].description).toContain(name)
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 explicit BUG-025 + BUG-026 proof
  // ---------------------------------------------------------------------

  test('events row is visible after create (BUG-026 RLS proof) @p0', async ({
    page,
  }) => {
    const name = uniqueEventName('RLSProof')
    await page.goto('/corporate')

    const createRes = await page.request.post('/api/events', {
      data: {
        name,
        event_type: 'corporate_wellness',
        start_time: tomorrowAt(9, 0),
        end_time: tomorrowAt(17, 0),
      },
    })
    expect(createRes.ok()).toBe(true)

    // GET via the API (which uses the same RLS that previously hid every row)
    const listRes = await page.request.get('/api/events')
    expect(listRes.ok()).toBe(true)
    const listBody = await listRes.json()

    // The just-created event should be in the list — proves BUG-026 fix
    const found = (listBody.data ?? []).find((e: { name: string }) => e.name === name)
    expect(found).toBeTruthy()
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P1 missing required fields rejected
  // ---------------------------------------------------------------------

  test('rejects request missing required name @p1', async ({ page }) => {
    await page.goto('/corporate')

    const res = await page.request.post('/api/events', {
      data: {
        event_type: 'private_party',
        start_time: tomorrowAt(18, 0),
        end_time: tomorrowAt(20, 0),
      },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P1 missing event_type rejected
  // ---------------------------------------------------------------------

  test('rejects request missing required event_type @p1', async ({ page }) => {
    const name = uniqueEventName('NoType')
    await page.goto('/corporate')

    const res = await page.request.post('/api/events', {
      data: {
        name,
        start_time: tomorrowAt(18, 0),
        end_time: tomorrowAt(20, 0),
      },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 default values applied correctly
  // ---------------------------------------------------------------------

  test('applies default values for setup_time, cleanup_time, min_guests @p1', async ({
    page,
  }) => {
    const name = uniqueEventName('Defaults')
    await page.goto('/corporate')

    const res = await page.request.post('/api/events', {
      data: {
        name,
        event_type: 'workshop',
        start_time: tomorrowAt(10, 0),
        end_time: tomorrowAt(11, 0),
      },
    })

    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.setup_time_minutes).toBe(0)
    expect(body.data.cleanup_time_minutes).toBe(0)
    expect(body.data.min_guests).toBe(1)
    expect(body.data.deposit_paid).toBe(false)
  })
})
