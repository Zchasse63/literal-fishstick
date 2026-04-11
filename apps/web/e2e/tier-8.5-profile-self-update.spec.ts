/**
 * T28 / B15 — Self-service profile update.
 *
 * Exercises PUT /api/profile for the authenticated admin. Verifies:
 *   - GET returns the shaped profile
 *   - PUT updates allowed fields
 *   - PUT refuses empty payload (400)
 *   - PUT refuses empty full_name (400)
 *   - PUT normalizes phone numbers
 *   - PUT never touches email/roles/studio_id even when sent
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { ADMIN_USER } from './fixtures/test-data'

async function resetAdminProfile(): Promise<void> {
  // Restore the admin's canonical name so tests are idempotent
  await testDb
    .from('profiles')
    .update({
      full_name: ADMIN_USER.fullName,
      phone: null,
      avatar_url: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
    })
    .eq('email', ADMIN_USER.email)
}

test.describe('Profile Self-Update (T28 / B15)', () => {
  test.beforeEach(async () => { await resetAdminProfile() })
  test.afterAll(async () => { await resetAdminProfile() })

  test('GET /api/profile returns caller profile @p0', async ({ page }) => {
    const res = await page.request.get('/api/profile')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data).toBeTruthy()
    expect(body.data.email).toBe(ADMIN_USER.email)
    expect(body.data.full_name).toBeTruthy()
  })

  test('PUT updates full_name @p0', async ({ page }) => {
    const res = await page.request.put('/api/profile', {
      data: { full_name: 'E2E Admin Updated' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.full_name).toBe('E2E Admin Updated')
  })

  test('PUT updates phone + normalizes @p0', async ({ page }) => {
    const res = await page.request.put('/api/profile', {
      data: { phone: '(555) 123-4567' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    // normalizePhone strips everything except digits and +
    expect(body.data.phone).toMatch(/^\+?[\d]+$/)
  })

  test('PUT updates emergency contact fields @p0', async ({ page }) => {
    const res = await page.request.put('/api/profile', {
      data: {
        emergency_contact_name: 'Jane Smith',
        emergency_contact_phone: '+15551234567',
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.emergency_contact_name).toBe('Jane Smith')
    expect(body.data.emergency_contact_phone).toMatch(/^\+?[\d]+$/)
  })

  test('PUT rejects empty full_name with 400 @p1', async ({ page }) => {
    const res = await page.request.put('/api/profile', {
      data: { full_name: '   ' },
    })
    expect(res.status()).toBe(400)
  })

  test('PUT rejects empty body with 400 @p1', async ({ page }) => {
    const res = await page.request.put('/api/profile', { data: {} })
    expect(res.status()).toBe(400)
  })

  test('PUT silently ignores email field (cannot change email) @p1', async ({ page }) => {
    const res = await page.request.put('/api/profile', {
      data: { full_name: 'E2E Admin', email: 'attacker@evil.com' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.email).toBe(ADMIN_USER.email) // unchanged
  })

  test('PUT silently ignores roles field (cannot self-promote) @p1', async ({ page }) => {
    const res = await page.request.put('/api/profile', {
      data: { full_name: 'E2E Admin', roles: ['owner', 'superadmin'] },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.roles).toEqual(['owner']) // original role preserved
  })

  test('PUT writes activity_log @p1', async ({ page }) => {
    const res = await page.request.put('/api/profile', {
      data: { full_name: 'E2E Admin (activity test)' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()

    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description')
      .eq('subject_id', body.data.id)
      .eq('type', 'profile')
      .order('created_at', { ascending: false })
      .limit(1)
    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toContain('Profile updated')
  })
})
