/**
 * Tier 3.10 — Schedule: Reschedule Class
 *
 * Five scenarios (4 P0 + 1 P1) covering the edit-time flow on /schedule.
 * Exercises the ClassFormModal in edit mode via PUT /api/classes/[id].
 *
 * BUG-018 (Edit modal phantom `description` field that wiped notes on
 * every save) was fixed inline as part of this tier. Scenario 3 is the
 * regression guard for that fix.
 *
 * The PUT handler also gained an end-after-start validation block
 * (mirror of POST handler's check) to support Scenario 5.
 */
import { test, expect } from '@playwright/test'
import { SchedulePage } from './pages/SchedulePage'
import { resetStudioTestData, testDb, seedClass } from './fixtures/db'
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

/** Tomorrow at HH:MM local time as an ISO timestamp (UTC-aware via Date). */
function tomorrowAt(hh: number, mm: number): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

/** Local YYYY-MM-DD for tomorrow (matches the modal's date input format). */
function tomorrowDateLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------------

test.describe('Schedule — Reschedule Class (Tier 3.10)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: reschedule a class to new times
  // ---------------------------------------------------------------------

  test('reschedules a class and persists new times + activity_log @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('RescheduleHappy')
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

    await schedule.openEditClassModalFromPanel(title)
    await schedule.fillClassForm({
      date: tomorrowDateLocal(),
      startTime: '19:00',
      endTime: '20:00',
    })
    await schedule.submitClassForm('PUT')

    // Modal closes on successful save
    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    // DB: times are updated; title and class_type preserved
    const { data: cls } = await testDb
      .from('classes')
      .select('title, class_type_id, capacity, starts_at, ends_at, status')
      .eq('id', classId)
      .single()

    expect(cls).not.toBeNull()
    expect(cls!.title).toBe(title)
    expect(cls!.class_type_id).toBe(DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID)
    expect(cls!.capacity).toBe(12)
    expect(cls!.status).toBe('scheduled')

    // Times: check hour/minute match the new values (local tz)
    const starts = new Date(cls!.starts_at)
    const ends = new Date(cls!.ends_at)
    expect(starts.getHours()).toBe(19)
    expect(starts.getMinutes()).toBe(0)
    expect(ends.getHours()).toBe(20)
    expect(ends.getMinutes()).toBe(0)

    // DB: activity_log class_updated row landed
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', classId)
      .eq('type', 'class_updated')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toBeTruthy()
    expect(logs![0].description).toContain('Class updated')
    expect(logs![0].description).toContain(title)
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 activity log proof (type + metadata)
  // ---------------------------------------------------------------------

  test('activity_log class_updated has non-null description and metadata @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('RescheduleLog')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(10, 0),
      endsAt: tomorrowAt(11, 0),
    })

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openEditClassModalFromPanel(title)
    await schedule.fillClassForm({
      date: tomorrowDateLocal(),
      startTime: '14:00',
      endTime: '15:00',
    })
    await schedule.submitClassForm('PUT')

    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, subject_type, metadata')
      .eq('subject_id', classId)
      .eq('type', 'class_updated')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('Class updated')
    expect(log.description).toContain(title)
    expect(log.subject_type).toBe('class')

    // Metadata captures the new times (serialized as starts_at/ends_at
    // by the PUT handler's remap; the underlying body sent start_time
    // which was remapped before being stored in `updates`).
    const metadata = log.metadata as Record<string, unknown>
    expect(metadata.starts_at).toBeTruthy()
    expect(metadata.ends_at).toBeTruthy()

    // Explicit regression guard: type should NOT be class_cancelled
    // (proves the wasCancelled conditional is correct for non-cancel edits)
    expect(log.type).toBe('class_updated')
    expect(log.type).not.toBe('class_cancelled')
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0 BUG-018 regression: notes preserved across edits
  // ---------------------------------------------------------------------

  test('rescheduling a class with notes preserves the notes (BUG-018) @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('RescheduleNotes')
    const originalNotes = 'Important: bring extra towels + ice baths'
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(12, 0),
      endsAt: tomorrowAt(13, 0),
      notes: originalNotes,
    })

    // Pre-check: seeded class has notes
    const { data: pre } = await testDb
      .from('classes')
      .select('notes')
      .eq('id', classId)
      .single()
    expect(pre?.notes).toBe(originalNotes)

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    // Open the edit modal — BUG-018 fix means the description field is
    // pre-populated with the existing notes.
    await schedule.openEditClassModalFromPanel(title)

    // Verify the description textarea is pre-populated
    await expect(schedule.descriptionTextarea()).toHaveValue(originalNotes)

    // Change only the start/end time — do NOT touch the description
    await schedule.fillClassForm({
      date: tomorrowDateLocal(),
      startTime: '16:00',
      endTime: '17:00',
    })
    await schedule.submitClassForm('PUT')

    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    // BUG-018 proof: notes are still intact after the save
    const { data: post } = await testDb
      .from('classes')
      .select('notes')
      .eq('id', classId)
      .single()

    expect(post?.notes).toBe(originalNotes)
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P0 other fields preserved during reschedule
  // ---------------------------------------------------------------------

  test('rescheduling only changes the edited fields @p0', async ({ page }) => {
    const title = uniqueTitle('ReschedulePreserve')
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: tomorrowAt(8, 0),
      endsAt: tomorrowAt(9, 0),
      capacity: 8, // non-default capacity to prove it's preserved
      trainerId: null, // seeding trainer_id=null to avoid needing a trainer profile
    })

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openEditClassModalFromPanel(title)
    // Only change the times
    await schedule.fillClassForm({
      date: tomorrowDateLocal(),
      startTime: '20:00',
      endTime: '21:00',
    })
    await schedule.submitClassForm('PUT')

    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    // DB: everything except times is unchanged
    const { data: cls } = await testDb
      .from('classes')
      .select('title, class_type_id, capacity, trainer_id, status')
      .eq('id', classId)
      .single()

    expect(cls!.title).toBe(title)
    expect(cls!.class_type_id).toBe(DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID)
    expect(cls!.capacity).toBe(8)
    expect(cls!.trainer_id).toBeNull()
    expect(cls!.status).toBe('scheduled')
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 server rejects end before start
  // ---------------------------------------------------------------------

  test('end time before start time returns 400 on PUT @p1', async ({
    page,
  }) => {
    const title = uniqueTitle('RescheduleBadTime')
    const originalStart = tomorrowAt(10, 0)
    const originalEnd = tomorrowAt(11, 0)
    const { classId } = await seedClass({
      title,
      classTypeId: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
      startsAt: originalStart,
      endsAt: originalEnd,
    })

    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openEditClassModalFromPanel(title)
    // Set end BEFORE start
    await schedule.fillClassForm({
      date: tomorrowDateLocal(),
      startTime: '18:00',
      endTime: '17:00',
    })
    // Server validates — POST goes through, 400 returned
    await schedule.submitClassForm('PUT')

    // Modal stays open with inline error
    await schedule.expectClassFormError('end_time must be after start_time')
    await expect(schedule.classFormModal()).toBeVisible()

    // DB: class times are unchanged
    const { data: cls } = await testDb
      .from('classes')
      .select('starts_at, ends_at')
      .eq('id', classId)
      .single()

    expect(new Date(cls!.starts_at).getTime()).toBe(
      new Date(originalStart).getTime(),
    )
    expect(new Date(cls!.ends_at).getTime()).toBe(
      new Date(originalEnd).getTime(),
    )
  })
})
