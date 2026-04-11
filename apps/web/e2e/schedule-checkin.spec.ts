/**
 * Tier 3.12 — Check-in (narrow scope)
 *
 * Three scenarios covering the AS-SHIPPED "Check In All" UI flow on
 * /schedule. The UI button performs a direct Supabase client UPDATE
 * instead of calling the /api/check-in POST handler (BUG-020), so
 * these tests assert the DB state directly without asserting on any
 * API-side-effects (activity_log, total_visits, trainer bonus).
 *
 * BUG-019 and BUG-020 are documented in
 * `specs/bugs/checkin-handler-and-ui-divergence.md` for future fix.
 */
import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { SchedulePage } from './pages/SchedulePage'
import { resetStudioTestData, testDb, seedClass, seedMember } from './fixtures/db'
import {
  DEFAULT_STUDIO_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
  E2E_CLASS_TITLE_PREFIX,
} from './fixtures/test-data'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueTitle(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${E2E_CLASS_TITLE_PREFIX} ${label}_${tag}`
}

function tomorrowAt(hh: number, mm: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

async function seedBooking(opts: {
  classId: string
  memberId: string
  status?: 'booked' | 'checked_in'
}): Promise<string> {
  const bookingId = randomUUID()
  const { error } = await testDb.from('bookings').insert({
    id: bookingId,
    studio_id: DEFAULT_STUDIO_ID,
    class_id: opts.classId,
    member_id: opts.memberId,
    status: opts.status ?? 'booked',
  })
  if (error) {
    throw new Error(`seedBooking: ${error.message}`)
  }
  return bookingId
}

// ---------------------------------------------------------------------------

test.describe('Schedule — Check-in (Tier 3.12)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path
  // ---------------------------------------------------------------------

  test('Check In All flips booked attendees to checked_in @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('CheckInHappy')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(17, 0),
      endsAt: tomorrowAt(18, 0),
      capacity: 12,
    })

    // Seed 2 booked members
    const m1 = await seedMember({ studioId: DEFAULT_STUDIO_ID })
    const m2 = await seedMember({ studioId: DEFAULT_STUDIO_ID })
    const b1 = await seedBooking({ classId, memberId: m1.memberId })
    const b2 = await seedBooking({ classId, memberId: m2.memberId })

    // Sanity: both bookings start as 'booked'
    const { data: pre } = await testDb
      .from('bookings')
      .select('id, status')
      .in('id', [b1, b2])
    expect(pre?.length).toBe(2)
    expect(pre!.every((b) => b.status === 'booked')).toBe(true)

    // Open the class panel and click Check In All
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()
    await schedule.openClassPanel(title)
    await schedule.clickCheckInAll()

    // DB: both bookings are now checked_in, attended=true, checked_in_at set
    const { data: post } = await testDb
      .from('bookings')
      .select('id, status, attended, checked_in_at')
      .in('id', [b1, b2])

    expect(post?.length).toBe(2)
    for (const booking of post ?? []) {
      expect(booking.status).toBe('checked_in')
      expect(booking.attended).toBe(true)
      expect(booking.checked_in_at).toBeTruthy()
    }
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 already-checked-in rows are not re-processed
  // ---------------------------------------------------------------------

  test('already checked_in bookings are not re-processed @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('CheckInIdempotent')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(10, 0),
      endsAt: tomorrowAt(11, 0),
    })

    const m1 = await seedMember({ studioId: DEFAULT_STUDIO_ID })
    const m2 = await seedMember({ studioId: DEFAULT_STUDIO_ID })

    // One booking starts already checked in (simulating a prior check-in)
    const earlyCheckedInAt = new Date(Date.now() - 3600_000).toISOString()
    const b1 = randomUUID()
    await testDb.from('bookings').insert({
      id: b1,
      studio_id: DEFAULT_STUDIO_ID,
      class_id: classId,
      member_id: m1.memberId,
      status: 'checked_in',
      attended: true,
      checked_in_at: earlyCheckedInAt,
    })
    // The other is booked (will be flipped)
    const b2 = await seedBooking({ classId, memberId: m2.memberId })

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()
    await schedule.openClassPanel(title)
    await schedule.clickCheckInAll()

    // DB: b1's checked_in_at is UNCHANGED (not re-stamped), b2 is now checked_in
    const { data: rows } = await testDb
      .from('bookings')
      .select('id, status, checked_in_at')
      .in('id', [b1, b2])

    const row1 = rows!.find((r) => r.id === b1)!
    const row2 = rows!.find((r) => r.id === b2)!

    expect(row1.status).toBe('checked_in')
    // The UI's filter `.in('status', ['booked', 'confirmed'])` excludes already-
    // checked-in rows, so row1's checked_in_at timestamp should match the
    // pre-seeded value (compared via Date because Postgres returns +00:00
    // and JS toISOString() returns Z — same instant, different format).
    expect(new Date(row1.checked_in_at as string).getTime()).toBe(
      new Date(earlyCheckedInAt).getTime(),
    )

    expect(row2.status).toBe('checked_in')
    expect(row2.checked_in_at).toBeTruthy()
    expect(new Date(row2.checked_in_at as string).getTime()).not.toBe(
      new Date(earlyCheckedInAt).getTime(),
    )
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0 field-level assertions
  // ---------------------------------------------------------------------

  test('Check In All sets attended=true and checked_in_at on each flipped row @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('CheckInFields')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(19, 0),
      endsAt: tomorrowAt(20, 0),
    })

    const m = await seedMember({ studioId: DEFAULT_STUDIO_ID })
    const bookingId = await seedBooking({ classId, memberId: m.memberId })

    // Pre-check: attended and checked_in_at are null (default)
    const { data: pre } = await testDb
      .from('bookings')
      .select('attended, checked_in_at')
      .eq('id', bookingId)
      .single()
    // seedBooking uses defaults; attended may be false, checked_in_at null
    expect(pre?.checked_in_at).toBeNull()

    const beforeClick = Date.now()

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()
    await schedule.openClassPanel(title)
    await schedule.clickCheckInAll()

    const { data: post } = await testDb
      .from('bookings')
      .select('status, attended, checked_in_at')
      .eq('id', bookingId)
      .single()

    expect(post?.status).toBe('checked_in')
    expect(post?.attended).toBe(true)
    expect(post?.checked_in_at).toBeTruthy()

    // Recency check: checked_in_at should be within the current test window
    const checkedInMs = new Date(post!.checked_in_at as string).getTime()
    expect(checkedInMs).toBeGreaterThanOrEqual(beforeClick - 1000)
    expect(checkedInMs).toBeLessThanOrEqual(Date.now() + 1000)
  })
})
