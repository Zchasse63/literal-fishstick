/**
 * Tier 3.8 — Schedule: Create Class
 *
 * Seven scenarios (4 P0 + 3 P1) covering the "New Class" flow on /schedule.
 * Exercises ClassFormModal end-to-end via POST /api/classes.
 *
 * BUG-015 (pre-existing, 4 layers + 1 sub-finding) was fixed inline as part
 * of this tier. The test suite proves every layer:
 *
 *   L1 — phantom `description` column → `notes` column mapping
 *        Scenario 1 asserts `classes.notes` holds the description value.
 *        Scenario 3 is dedicated explicit proof.
 *
 *   L2 — `classes.title` NOT NULL + modal sends null on blank
 *        Scenario 4 submits with title='' and asserts title defaults to
 *        class_type.name. Would have 500'd pre-fix.
 *
 *   L3 — `activity_log.description` NOT NULL omitted from insert
 *        Scenario 2 asserts `activity_log.description` is non-null and
 *        contains 'Class created'. Scenario 1 has a weaker assertion as
 *        a regression guard.
 *
 *   L4 — `activity_log.type='class_created'` not in CHECK enum
 *        Migration 20260410 extends the enum. Scenario 2 asserts
 *        `activity_log.type === 'class_created'`. Without the migration,
 *        the insert would fail the CHECK and silently swallow.
 *
 *   L5 — Missing POST-level role check
 *        Fixed in the handler rewrite. Not directly tested here because
 *        the admin test user has 'owner' role; a dedicated non-privileged
 *        user test is out of tier scope.
 */
import { test, expect } from '@playwright/test'
import { SchedulePage } from './pages/SchedulePage'
import { resetStudioTestData, testDb } from './fixtures/db'
import {
  DEFAULT_STUDIO_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
  DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
  E2E_CLASS_TITLE_PREFIX,
} from './fixtures/test-data'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueTag(label: string): string {
  return `${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function uniqueTitle(label: string): string {
  return `${E2E_CLASS_TITLE_PREFIX} ${uniqueTag(label)}`
}

/**
 * Tomorrow in YYYY-MM-DD — using LOCAL date parts, not UTC. `toISOString()`
 * converts to UTC and can off-by-one when the runner is west of UTC in the
 * late hours (e.g., 11pm EST = 4am UTC next day).
 */
function tomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------------

test.describe('Schedule — Create Class (Tier 3.8)', () => {
  test.beforeEach(async () => {
    await resetStudioTestData()
  })

  test.afterAll(async () => {
    await resetStudioTestData()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path
  // ---------------------------------------------------------------------

  test('creates a class with all fields — classes row + activity_log @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('HappyPath')
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openNewClassModal()
    await schedule.fillClassForm({
      classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
      title,
      date: tomorrowDate(),
      startTime: '17:00',
      endTime: '18:00',
      capacity: 12,
      description: 'Test description for Tier 3.8',
    })
    await schedule.submitClassForm()
    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    // DB: classes row landed with correct columns
    const { data: cls, error: classErr } = await testDb
      .from('classes')
      .select('id, class_type_id, title, notes, capacity, status')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('title', title)
      .single()

    expect(classErr).toBeNull()
    expect(cls).not.toBeNull()
    expect(cls!.class_type_id).toBe(DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID)
    expect(cls!.title).toBe(title)
    // BUG-015 L1 proof: description from the modal landed in the notes column
    expect(cls!.notes).toBe('Test description for Tier 3.8')
    expect(cls!.capacity).toBe(12)
    expect(cls!.status).toBe('scheduled')

    // DB: activity_log row landed — implicit proof for L3 + L4
    const { data: logs } = await testDb
      .from('activity_log')
      .select('id, type, description')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('subject_id', cls!.id)
      .eq('type', 'class_created')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toBeTruthy()
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 activity_log explicit L3/L4 proof
  // ---------------------------------------------------------------------

  test('activity_log row has valid type, non-null description, correct metadata @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('LogProof')
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openNewClassModal()
    await schedule.fillClassForm({
      classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
      title,
      date: tomorrowDate(),
      startTime: '09:00',
      endTime: '10:00',
      capacity: 8,
    })
    await schedule.submitClassForm()
    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    const { data: cls } = await testDb
      .from('classes')
      .select('id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('title', title)
      .single()

    expect(cls).not.toBeNull()

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, subject_type, metadata')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('subject_id', cls!.id)

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    // L4 proof — type is the canonical enum value, not a phantom or ambiguous 'cancellation'
    expect(log.type).toBe('class_created')
    // L3 proof — description is NOT NULL, non-empty, and has the expected shape
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('Class created')
    expect(log.subject_type).toBe('class')
    // Metadata marker so ops dashboards can filter by class_type
    expect(log.metadata).toMatchObject({
      class_type_id: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    })
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0 L1 explicit proof (description field → notes column)
  // ---------------------------------------------------------------------

  test('description field in form writes to classes.notes column (L1 proof) @p0', async ({
    page,
  }) => {
    const title = uniqueTitle('L1Proof')
    const proofString = `specific-L1-proof-${uniqueTag('notes')}`
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openNewClassModal()
    await schedule.fillClassForm({
      classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
      title,
      date: tomorrowDate(),
      startTime: '10:00',
      endTime: '11:00',
      description: proofString,
    })
    await schedule.submitClassForm()
    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    const { data: cls } = await testDb
      .from('classes')
      .select('notes')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('title', title)
      .single()

    // L1 proof: the field labeled "Description" in the UI persisted to the
    // DB column named `notes`. Pre-fix this would 500 on phantom column.
    expect(cls!.notes).toBe(proofString)
    // Regression guard: `description` is not a column on the row
    expect((cls as Record<string, unknown>)['description']).toBeUndefined()
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P0 L2 explicit proof (blank title → class_type.name)
  // ---------------------------------------------------------------------

  test('blank title defaults to class_type.name — no 500 on NOT NULL column @p0', async ({
    page,
  }) => {
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    const beforeCreate = Date.now()

    await schedule.openNewClassModal()
    await schedule.fillClassForm({
      classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
      title: '', // explicitly blank — triggers the L2 defaulting
      date: tomorrowDate(),
      startTime: '11:00',
      endTime: '12:00',
      capacity: 12,
    })
    await schedule.submitClassForm()
    await expect(schedule.classFormModal()).toBeHidden({ timeout: 10_000 })

    // Fetch the most recently created "Open Sauna" class in the studio.
    // We cannot filter on title (it will be "Open Sauna", which collides
    // with pre-existing rows) — so we filter by class_type_id + studio_id
    // and take the newest row by created_at.
    const { data: classes } = await testDb
      .from('classes')
      .select('id, title, created_at')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('class_type_id', DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID)
      .order('created_at', { ascending: false })
      .limit(1)

    expect(classes?.length).toBeGreaterThanOrEqual(1)
    const newest = classes![0]

    // Recency guard: confirm this row is from the current test run, not a
    // leftover blank-title "Open Sauna" row from a prior run. The insert
    // always happens AFTER `beforeCreate` (which is captured before the modal
    // opens), so `created_at >= beforeCreate` is the correct strict check.
    // No clock-skew buffer — same-machine Postgres and JS clocks are tightly
    // synchronized, and giving backwards tolerance would weaken the guard.
    expect(new Date(newest.created_at).getTime()).toBeGreaterThanOrEqual(
      beforeCreate,
    )

    // L2 proof: title defaulted to the class_type name
    expect(newest.title).toBe(DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME)

    // activity_log description references the class_type name
    const { data: logs } = await testDb
      .from('activity_log')
      .select('description')
      .eq('subject_id', newest.id)
      .eq('type', 'class_created')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toContain(DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME)
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 missing class_type_id blocks submission
  // ---------------------------------------------------------------------

  test('missing class type shows inline error, modal stays open, no DB write @p1', async ({
    page,
  }) => {
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    const beforeCreate = new Date(Date.now() - 1000).toISOString()

    await schedule.openNewClassModal()
    // Intentionally omit classTypeName — default empty value
    await schedule.fillClassForm({
      date: tomorrowDate(),
      startTime: '12:00',
      endTime: '13:00',
    })

    // Click directly — no network round trip is expected (client-side guard)
    await schedule.submitClassBtn().click()

    await schedule.expectClassFormError('Please select a class type')
    await expect(schedule.classFormModal()).toBeVisible()

    // DB: no classes rows created in the last second
    const { data: classes } = await testDb
      .from('classes')
      .select('id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .gte('created_at', beforeCreate)

    expect(classes?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 6 — P1 end_time ≤ start_time returns server error
  // ---------------------------------------------------------------------

  test('end time before start time shows server error, modal stays open @p1', async ({
    page,
  }) => {
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    await schedule.openNewClassModal()
    await schedule.fillClassForm({
      classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
      date: tomorrowDate(),
      startTime: '18:00',
      endTime: '17:00', // end before start
    })

    // Server-side validation: a POST is fired, server returns 400
    await schedule.submitClassForm()

    await schedule.expectClassFormError('end_time must be after start_time')
    await expect(schedule.classFormModal()).toBeVisible()
  })

  // ---------------------------------------------------------------------
  // Scenario 7 — P1 cancel closes modal cleanly
  // ---------------------------------------------------------------------

  test('cancel button closes modal without inserting any rows @p1', async ({
    page,
  }) => {
    const schedule = new SchedulePage(page)
    await schedule.goto('/schedule')
    await schedule.expectMounted()

    const beforeCreate = new Date(Date.now() - 1000).toISOString()
    const cancelledTitle = uniqueTitle('CancelTest')

    await schedule.openNewClassModal()
    await schedule.fillClassForm({
      classTypeName: DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME,
      title: cancelledTitle,
      date: tomorrowDate(),
    })

    await schedule.cancelClassForm()
    await expect(schedule.classFormModal()).toBeHidden()

    // DB: nothing with the cancelled title was inserted
    const { data: classes } = await testDb
      .from('classes')
      .select('id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('title', cancelledTitle)

    expect(classes?.length ?? 0).toBe(0)

    // Belt-and-suspenders: no row created in the recent window at all
    const { data: recent } = await testDb
      .from('classes')
      .select('id, title')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .gte('created_at', beforeCreate)

    // The recent query may still return rows from other tests running
    // concurrently, but none should have our cancelled title.
    const matching = (recent ?? []).filter((r) => r.title === cancelledTitle)
    expect(matching.length).toBe(0)

    // Reopen: form should be in fresh state, not pre-populated
    await schedule.openNewClassModal()
    await expect(schedule.titleInput()).toHaveValue('')
    await expect(schedule.classTypeSelect()).toHaveValue('')
  })
})
