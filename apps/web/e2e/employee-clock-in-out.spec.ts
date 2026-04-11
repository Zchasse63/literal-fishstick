/**
 * Tier 7.1 — Employee Portal: Clock In/Out (API-level)
 *
 * Runs under the `employee` project (trainer auth). Exercises POST /api/clock
 * for both clock_in and clock_out actions, with and without geofence.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { EMPLOYEE_USER, DEFAULT_STUDIO_ID } from './fixtures/test-data'

async function ensureEmployeeRow(): Promise<string> {
  // 1. Look up the trainer's profile id from email.
  const { data: profile, error: profileError } = await testDb
    .from('profiles')
    .select('id, studio_id')
    .eq('email', EMPLOYEE_USER.email)
    .single()
  if (profileError || !profile) {
    throw new Error(`Could not find employee profile: ${profileError?.message ?? 'not found'}`)
  }

  // 2. Upsert an employees row linked to that profile.
  const { data: existing } = await testDb
    .from('employees')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (existing) return existing.id

  const { data: inserted, error: insertError } = await testDb
    .from('employees')
    .insert({
      profile_id: profile.id,
      studio_id: profile.studio_id ?? DEFAULT_STUDIO_ID,
      employment_type: 'full_time',
      pay_rate: 2500,
      pay_type: 'hourly',
      status: 'active',
      hire_date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()
  if (insertError || !inserted) {
    throw new Error(`Failed to seed employees row: ${insertError?.message ?? 'unknown'}`)
  }
  return inserted.id
}

async function cleanupClockEntries(employeeId: string): Promise<void> {
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

test.describe('Employee Portal — Clock In/Out (Tier 7.1)', () => {
  let employeeId = ''

  test.beforeAll(async () => {
    employeeId = await ensureEmployeeRow()
  })

  test.beforeEach(async () => {
    if (employeeId) await cleanupClockEntries(employeeId)
  })

  test.afterAll(async () => {
    if (employeeId) await cleanupClockEntries(employeeId)
  })

  test('clock_in without geofence creates entry @p0', async ({ page }) => {
    const res = await page.request.post('/api/clock', {
      data: { action: 'clock_in' },
    })
    const body = await res.json()
    if (!res.ok()) {
      throw new Error(`clock_in failed ${res.status()}: ${JSON.stringify(body)}`)
    }
    expect(body.data.id).toBeTruthy()
    expect(body.data.clock_in).toBeTruthy()
    expect(body.data.clock_out).toBeNull()
    expect(body.data.status).toBe('active')
    expect(body.geofence_verified).toBe(false)
  })

  test('clock_out after clock_in completes the shift @p0', async ({ page }) => {
    // Clock in
    const inRes = await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    expect(inRes.ok()).toBe(true)

    // Clock out
    const outRes = await page.request.post('/api/clock', { data: { action: 'clock_out' } })
    const body = await outRes.json()
    if (!outRes.ok()) {
      throw new Error(`clock_out failed ${outRes.status()}: ${JSON.stringify(body)}`)
    }
    expect(body.data.clock_out).toBeTruthy()
    expect(body.data.status).toBe('completed')
    expect(typeof body.total_hours).toBe('number')
    expect(body.total_hours).toBeGreaterThanOrEqual(0)
  })

  test('double clock_in returns 409 conflict @p0', async ({ page }) => {
    await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    const res = await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    expect(res.status()).toBe(409)
  })

  test('clock_out without active shift returns 400 @p1', async ({ page }) => {
    const res = await page.request.post('/api/clock', { data: { action: 'clock_out' } })
    expect(res.status()).toBe(400)
  })

  test('invalid action rejected @p1', async ({ page }) => {
    const res = await page.request.post('/api/clock', { data: { action: 'bogus' } })
    expect(res.status()).toBe(400)
  })

  test('invalid coordinates rejected @p1', async ({ page }) => {
    const res = await page.request.post('/api/clock', {
      data: { action: 'clock_in', latitude: 999, longitude: 999 },
    })
    expect(res.status()).toBe(400)
  })

  test('clock_in writes activity_log @p1', async ({ page }) => {
    const res = await page.request.post('/api/clock', { data: { action: 'clock_in' } })
    expect(res.ok()).toBe(true)
    const body = await res.json()

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type')
      .eq('subject_id', body.data.id)
      .eq('type', 'employee_clocked_in')
    expect(logs?.length).toBeGreaterThanOrEqual(1)
  })
})
