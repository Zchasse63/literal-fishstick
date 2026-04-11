/**
 * Tier 3.9 — Schedule: Cancel Class
 *
 * Five scenarios (3 P0 + 2 P1) covering the Cancel Class flow on /schedule.
 * Exercises the ClassDetailPanel's "Cancel Class" button end-to-end via
 * PUT /api/classes/[id] with { status: 'cancelled' }.
 *
 * BUG-017 (pre-existing, PUT L1/L3/L5 + DELETE L3/L5) was fixed inline as
 * part of this tier. The test suite proves:
 *
 *   PUT L1 — body field `description` remaps to DB column `notes`
 *            (Scenario 5 — direct PUT with description field)
 *
 *   PUT L3 — activity_log.description NOT NULL is honored
 *            (Scenarios 1 + 2 assert non-null description on the log row)
 *
 *   PUT L5 — role check on PUT returns 403 for non-privileged users
 *            (Not directly tested — admin test user is 'owner' role. Out of
 *            tier scope. Fixed in handler for consistency with GET + POST.)
 *
 *   DELETE L3/L5 — not exercised by this tier (cancel uses PUT). Fixed
 *                  inline for consistency and Tier 3.10 reference.
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

/** ISO timestamp for tomorrow at HH:MM local time. */
function tomorrowAt(hh: number, mm: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

// ---------------------------------------------------------------------------

test.describe('Schedule — Cancel Class (Tier 3.9)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: cancel a class with no bookings
  // ---------------------------------------------------------------------

  test('cancels a class and writes status=cancelled + activity_log @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('CancelHappy')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(17, 0),
      endsAt: tomorrowAt(18, 0),
      capacity: 12,
    })

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openClassPanel(title)
    await schedule.cancelClassFromPanel(true)

    // Panel closes on successful cancel
    await expect(schedule.classDetailPanel()).toBeHidden({ timeout: 10_000 })

    // DB: status flipped to cancelled
    const { data: cls, error: clsErr } = await testDb
      .from('classes')
      .select('status')
      .eq('id', classId)
      .single()

    expect(clsErr).toBeNull()
    expect(cls?.status).toBe('cancelled')

    // DB: activity_log row with class_cancelled type
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', classId)
      .eq('type', 'class_cancelled')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toBeTruthy()
    expect(logs![0].description).toContain('Class cancelled')
    expect(logs![0].description).toContain(title)
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 activity log explicit L3 proof
  // ---------------------------------------------------------------------

  test('activity_log class_cancelled has non-null description + metadata @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('CancelLog')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(18, 0),
      endsAt: tomorrowAt(19, 0),
    })

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openClassPanel(title)
    await schedule.cancelClassFromPanel(true)

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, subject_type, metadata')
      .eq('subject_id', classId)

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs!.find((l) => l.type === 'class_cancelled')
    expect(log).toBeTruthy()

    // L3 proof — description is NOT NULL and non-empty
    expect(log!.description).toBeTruthy()
    expect(log!.description).toContain('Class cancelled')
    expect(log!.description).toContain(title)

    // Shape of the log row
    expect(log!.subject_type).toBe('class')

    // Metadata captures the status change
    expect((log!.metadata as Record<string, unknown>).status).toBe('cancelled')
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0 cancel class with existing bookings (bookings preserved)
  // ---------------------------------------------------------------------

  test('cancels a class with existing bookings — bookings stay intact @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('CancelWithBookings')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(19, 0),
      endsAt: tomorrowAt(20, 0),
      capacity: 12,
    })

    // Seed 2 members + 2 bookings on the class.
    // **bookings.member_id references members.id** (NOT profiles.id —
    // confirmed via pg_constraint probe during Tier 3.9 Sentinel).
    // Default status is 'booked' (validated against bookings_status_check
    // CHECK enum at Tier 3.9 Analyst time).
    // Note: the cleanup at db.ts:462 uses `.in('member_id', testProfileIds)`
    // which would never match due to the FK target being members.id — that's
    // a latent cleanup bug that is out of Tier 3.9 scope (the CASCADE on
    // bookings_member_id_fkey handles cleanup anyway when members rows are
    // deleted at db.ts step 6).
    const m1 = await seedMember({ studioId: DEFAULT_STUDIO_ID })
    const m2 = await seedMember({ studioId: DEFAULT_STUDIO_ID })
    for (const member of [m1, m2]) {
      const { error: insertErr } = await testDb.from('bookings').insert({
        id: randomUUID(),
        studio_id: DEFAULT_STUDIO_ID,
        class_id: classId,
        member_id: member.memberId,
        status: 'booked',
      })
      if (insertErr) {
        throw new Error(`Failed to seed booking: ${insertErr.message}`)
      }
    }

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openClassPanel(title)
    await schedule.cancelClassFromPanel(true)

    // Panel closes — PUT succeeds even with bookings present (this is the
    // whole point of using PUT-status-update vs DELETE-hard-delete: the
    // soft-cancel path preserves historical attendance data).
    await expect(schedule.classDetailPanel()).toBeHidden({ timeout: 10_000 })

    // DB: class status is now cancelled
    const { data: cls } = await testDb
      .from('classes')
      .select('status')
      .eq('id', classId)
      .single()
    expect(cls?.status).toBe('cancelled')

    // DB: bookings are NOT deleted — the soft-cancel flow preserves them
    const { data: bookings } = await testDb
      .from('bookings')
      .select('id, status')
      .eq('class_id', classId)

    expect(bookings?.length).toBe(2)
    // Booking statuses are untouched — they're still 'booked'. A separate
    // flow (out of tier scope) would transition each booking's own status
    // to 'cancelled' and notify the member. Tier 3.9 only cancels the class.
    expect(bookings!.every((b) => b.status === 'booked')).toBe(true)
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P1 dismissing the dialog leaves the class scheduled
  // ---------------------------------------------------------------------

  test('dismissing the confirm dialog leaves class scheduled @p1', async ({
    page,
  }) => {
    const title = uniqueTitle('CancelDismiss')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(14, 0),
      endsAt: tomorrowAt(15, 0),
    })

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openClassPanel(title)
    await schedule.cancelClassFromPanel(false) // dismiss the dialog

    // Panel stays open
    await expect(schedule.classDetailPanel()).toBeVisible()

    // DB: status unchanged
    const { data: cls } = await testDb
      .from('classes')
      .select('status')
      .eq('id', classId)
      .single()
    expect(cls?.status).toBe('scheduled')

    // DB: no class_cancelled log row was written
    const { data: logs } = await testDb
      .from('activity_log')
      .select('id')
      .eq('subject_id', classId)
      .eq('type', 'class_cancelled')
    expect(logs?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 direct PUT with description field (L1 regression guard)
  // ---------------------------------------------------------------------

  test('PUT /api/classes/[id] description field remaps to notes column (L1 proof) @p1', async ({
    page,
  }) => {
    const title = uniqueTitle('L1Regression')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(10, 0),
      endsAt: tomorrowAt(11, 0),
    })

    // Navigate first to establish auth cookies for page.request
    await page.goto('/schedule')

    const proofString = `L1-regression-proof-${Date.now()}`
    const res = await page.request.put(`/api/classes/${classId}`, {
      data: { description: proofString },
    })

    // L1 proof: no 500 from phantom column write
    expect(res.ok()).toBe(true)

    // DB: the description field was remapped to the notes column
    const { data: cls } = await testDb
      .from('classes')
      .select('notes')
      .eq('id', classId)
      .single()

    expect(cls?.notes).toBe(proofString)
  })
})
