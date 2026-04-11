/**
 * Tier 7.2 — Employee Portal: Timesheet read (API-level)
 *
 * Note: There is no dedicated "submit timesheet" action in Meridian. The
 * clock_entries rows created by Tier 7.1 ARE the timesheet. This tier
 * verifies that an employee can retrieve their own entries for a date range
 * (the read path powering `/employee/timesheets`).
 *
 * Since the page reads via a Supabase client hook (not an API route), we
 * verify the equivalent data path by (a) seeding known entries via testDb
 * and (b) asserting the raw shape via testDb filtered by date.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { EMPLOYEE_USER, DEFAULT_STUDIO_ID } from './fixtures/test-data'

async function getEmployeeRow(): Promise<{ id: string; profile_id: string }> {
  const { data: profile, error: profileError } = await testDb
    .from('profiles')
    .select('id')
    .eq('email', EMPLOYEE_USER.email)
    .single()
  if (profileError || !profile) {
    throw new Error(`Could not find employee profile: ${profileError?.message ?? 'not found'}`)
  }

  const { data: existing } = await testDb
    .from('employees')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle()
  if (existing) return { id: existing.id, profile_id: profile.id }

  const { data: inserted } = await testDb
    .from('employees')
    .insert({
      profile_id: profile.id,
      studio_id: DEFAULT_STUDIO_ID,
      employment_type: 'full_time',
      pay_rate: 2500,
      pay_type: 'hourly',
      status: 'active',
      hire_date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()
  if (!inserted) throw new Error('Failed to seed employee')
  return { id: inserted.id, profile_id: profile.id }
}

async function cleanupEntries(employeeId: string): Promise<void> {
  const { data: entries } = await testDb
    .from('clock_entries')
    .select('id')
    .eq('employee_id', employeeId)
  const ids = (entries ?? []).map((e) => e.id)
  if (ids.length > 0) {
    await testDb.from('activity_log').delete().eq('subject_type', 'clock_entry').in('subject_id', ids)
    await testDb.from('clock_entries').delete().in('id', ids)
  }
}

test.describe('Employee Portal — Timesheet Read (Tier 7.2)', () => {
  let employeeId = ''

  test.beforeAll(async () => {
    const row = await getEmployeeRow()
    employeeId = row.id
  })

  test.beforeEach(async () => {
    if (employeeId) await cleanupEntries(employeeId)
  })

  test.afterAll(async () => {
    if (employeeId) await cleanupEntries(employeeId)
  })

  test('clock_in then clock_out appears in week range @p0', async ({ page }) => {
    // Use the real API path to create an entry (Tier 7.1 guarantees this works).
    const inRes = await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    expect(inRes.ok()).toBe(true)
    const outRes = await page.request.post('/api/clock', { data: { action: 'clock_out' } })
    expect(outRes.ok()).toBe(true)

    // Query the same week's entries via testDb (the employee hook uses
    // supabase-client directly; this mirrors the read path).
    const now = new Date()
    const weekStart = new Date(now)
    const day = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { data: entries, error } = await testDb
      .from('clock_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('clock_in', weekStart.toISOString())
      .lt('clock_in', weekEnd.toISOString())
      .order('clock_in', { ascending: false })

    expect(error).toBeNull()
    expect(entries?.length).toBeGreaterThanOrEqual(1)
    const entry = entries![0]
    expect(entry.clock_in).toBeTruthy()
    expect(entry.clock_out).toBeTruthy()
    expect(entry.status).toBe('completed')
    expect(typeof entry.total_hours).toBe('number')
  })

  test('open shift (no clock_out) still appears in entries @p0', async ({ page }) => {
    const inRes = await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    expect(inRes.ok()).toBe(true)

    const { data: entries } = await testDb
      .from('clock_entries')
      .select('id, clock_in, clock_out, status')
      .eq('employee_id', employeeId)
      .is('clock_out', null)

    expect(entries?.length).toBeGreaterThanOrEqual(1)
    expect(entries![0].status).toBe('active')
  })

  test('entries filter by date range works @p1', async ({ page }) => {
    await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    await page.request.post('/api/clock', { data: { action: 'clock_out' } })

    // Range in the past should return zero for this newly-created entry.
    const farPast = new Date(Date.now() - 365 * 86400000).toISOString()
    const alsoPast = new Date(Date.now() - 364 * 86400000).toISOString()
    const { data: entries } = await testDb
      .from('clock_entries')
      .select('id')
      .eq('employee_id', employeeId)
      .gte('clock_in', farPast)
      .lt('clock_in', alsoPast)

    expect(entries?.length ?? 0).toBe(0)
  })

  test('total_hours computed at clock_out time @p1', async ({ page }) => {
    await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    const outRes = await page.request.post('/api/clock', { data: { action: 'clock_out' } })
    const body = await outRes.json()
    expect(typeof body.data.total_hours).toBe('number')
    expect(body.data.total_hours).toBeGreaterThanOrEqual(0)
    expect(body.data.total_hours).toBeLessThan(1) // clocked in and out immediately
  })
})
