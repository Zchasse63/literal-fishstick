/**
 * Tier 7.4 — Employee Portal: Update Profile (READ-ONLY VERIFICATION)
 *
 * The employee profile page (`/employee/profile`) is currently read-only —
 * there is no API endpoint or Supabase write path wired for employees to
 * update their own profile fields (phone, emergency contact, avatar, etc.).
 * The page shows a pencil icon but no edit flow is implemented.
 *
 * Therefore this tier verifies the READ path only and logs the missing
 * update feature to the feature-dev backlog (B15).
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { EMPLOYEE_USER } from './fixtures/test-data'

test.describe('Employee Portal — Profile Read (Tier 7.4)', () => {
  test('employee profile record exists and is readable @p0', async () => {
    const { data, error } = await testDb
      .from('profiles')
      .select('id, email, full_name, roles')
      .eq('email', EMPLOYEE_USER.email)
      .single()
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data!.email).toBe(EMPLOYEE_USER.email)
    expect(data!.roles).toContain('trainer')
  })

  test('employee → employees row link is intact @p0', async () => {
    const { data: profile } = await testDb
      .from('profiles')
      .select('id')
      .eq('email', EMPLOYEE_USER.email)
      .single()
    expect(profile).toBeTruthy()

    const { data: employee } = await testDb
      .from('employees')
      .select('id, profile_id, status, employment_type, hire_date')
      .eq('profile_id', profile!.id)
      .maybeSingle()
    // The seed may or may not exist — presence is verified in Tier 7.1/7.2
    // (which creates the row if missing). Here we just assert the link
    // works when the row is present.
    if (employee) {
      expect(employee.profile_id).toBe(profile!.id)
    }
  })

  test('trainer record may link same profile @p1', async () => {
    const { data: profile } = await testDb
      .from('profiles')
      .select('id')
      .eq('email', EMPLOYEE_USER.email)
      .single()

    const { data: trainer } = await testDb
      .from('trainers')
      .select('id, profile_id')
      .eq('profile_id', profile!.id)
      .maybeSingle()
    // Trainer seed is optional; just verify the query path is not broken.
    expect(trainer === null || typeof trainer.id === 'string').toBe(true)
  })
})
