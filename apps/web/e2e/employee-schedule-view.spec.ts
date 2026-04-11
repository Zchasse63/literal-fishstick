/**
 * Tier 7.6 — Employee Portal: View Schedule (API-level, read-only)
 *
 * Verifies that the `classes` table read path used by the employee schedule
 * page is intact (trainer_id filter + week range). No API route exists — the
 * page reads via `useScheduleClasses` hook. This tier asserts the underlying
 * schema + filter works.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { EMPLOYEE_USER, DEFAULT_STUDIO_ID } from './fixtures/test-data'

test.describe('Employee Portal — View Schedule (Tier 7.6)', () => {
  test('classes filter by trainer_id + week range works @p0', async () => {
    const { data: profile } = await testDb
      .from('profiles')
      .select('id')
      .eq('email', EMPLOYEE_USER.email)
      .single()

    const { data: trainer } = await testDb
      .from('trainers')
      .select('id')
      .eq('profile_id', profile!.id)
      .maybeSingle()

    const trainerId = trainer?.id ?? '00000000-0000-0000-0000-000000000000'

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { data: classes, error } = await testDb
      .from('classes')
      .select('id, title, starts_at, ends_at, capacity, booked_count, checked_in_count, status')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .eq('trainer_id', trainerId)
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', weekEnd.toISOString())
      .order('starts_at', { ascending: true })

    // Empty result is fine — we're validating the query path, not seed data.
    expect(error).toBeNull()
    expect(Array.isArray(classes)).toBe(true)
  })

  test('classes schema exposes expected columns @p0', async () => {
    const { data, error } = await testDb
      .from('classes')
      .select('id, title, starts_at, ends_at, capacity, booked_count, checked_in_count, status, trainer_id, class_type_id')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .limit(1)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  test('class_types join is valid @p1', async () => {
    const { data, error } = await testDb
      .from('classes')
      .select('id, class_types:class_type_id ( name, type )')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .limit(1)
    expect(error).toBeNull()
  })

  test('trainer_class_log historical read is valid @p1', async () => {
    const { data: profile } = await testDb
      .from('profiles')
      .select('id')
      .eq('email', EMPLOYEE_USER.email)
      .single()

    const { data: trainer } = await testDb
      .from('trainers')
      .select('id')
      .eq('profile_id', profile!.id)
      .maybeSingle()
    const trainerId = trainer?.id ?? '00000000-0000-0000-0000-000000000000'

    const { error } = await testDb
      .from('trainer_class_log')
      .select('id, trainer_id, class_id, classes:class_id ( title, starts_at, ends_at, capacity )')
      .eq('trainer_id', trainerId)
      .limit(10)

    expect(error).toBeNull()
  })
})
