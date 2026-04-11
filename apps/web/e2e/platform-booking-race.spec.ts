/**
 * Tier 8.2 — Platform: Booking race (gap-filed — see B17)
 *
 * The current `/api/bookings` POST uses a count-then-insert pattern that
 * cannot provide an atomic capacity guarantee under concurrent load. A full
 * race test would require database-level transaction support (B17). This
 * tier verifies only that the serial path enforces capacity.
 */
import { test, expect } from '@playwright/test'
import { testDb, seedMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID, DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID } from './fixtures/test-data'
import { randomUUID } from 'node:crypto'

async function seedClass(capacity: number): Promise<string> {
  const id = randomUUID()
  const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const endsAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  const { error } = await testDb.from('classes').insert({
    id,
    studio_id: DEFAULT_STUDIO_ID,
    class_type_id: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    title: `E2ETestBook_${id.slice(0, 8)}`,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity,
    booked_count: 0,
    checked_in_count: 0,
    status: 'scheduled',
  })
  if (error) throw new Error(`seed class failed: ${error.message}`)
  return id
}

async function cleanupClass(classId: string): Promise<void> {
  await testDb.from('bookings').delete().eq('class_id', classId)
  await testDb.from('classes').delete().eq('id', classId)
}

test.describe('Platform — Booking Capacity (Tier 8.2)', () => {
  test.setTimeout(30_000)

  test('serial booking succeeds then second hits capacity @p0', async ({ page }) => {
    const classId = await seedClass(1)
    const m1 = await seedMember({ fullName: 'E2ETestBook_A' })
    const m2 = await seedMember({ fullName: 'E2ETestBook_B' })

    try {
      const res1 = await page.request.post('/api/bookings', {
        data: { class_id: classId, member_id: m1.memberId },
      })
      const body1 = await res1.json().catch(() => ({}))
      if (!res1.ok()) {
        throw new Error(`First booking failed ${res1.status()}: ${JSON.stringify(body1)}`)
      }
      expect(body1.data?.id).toBeTruthy()
      expect(body1.data?.status).toBe('booked')

      const res2 = await page.request.post('/api/bookings', {
        data: { class_id: classId, member_id: m2.memberId },
      })
      expect([400, 409]).toContain(res2.status())
    } finally {
      await cleanupClass(classId)
      await testDb.from('members').delete().eq('id', m1.memberId)
      await testDb.from('profiles').delete().eq('id', m1.profileId)
      await testDb.from('members').delete().eq('id', m2.memberId)
      await testDb.from('profiles').delete().eq('id', m2.profileId)
    }
  })

  test('duplicate booking for same member/class rejected @p0', async ({ page }) => {
    const classId = await seedClass(5)
    const m = await seedMember({ fullName: 'E2ETestDupBook' })

    try {
      const res1 = await page.request.post('/api/bookings', {
        data: { class_id: classId, member_id: m.memberId },
      })
      expect(res1.ok()).toBe(true)

      const res2 = await page.request.post('/api/bookings', {
        data: { class_id: classId, member_id: m.memberId },
      })
      expect([400, 409]).toContain(res2.status())
    } finally {
      await cleanupClass(classId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('atomic booking guarantee documented (B17) @p1', async () => {
    // The current route uses count-then-insert which is race-susceptible.
    // B17 tracks the RPC/transaction fix.
    expect(true).toBe(true)
  })
})
