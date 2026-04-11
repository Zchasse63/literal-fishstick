/**
 * T29 / B17 — True concurrent booking test.
 *
 * Fires 10 simultaneous POST /api/bookings requests for 10 different
 * members against a class with capacity=1. With the atomic RPC, exactly
 * 1 should succeed and the other 9 should get 409. Without it, 2+ could
 * race through the count-then-insert window.
 */
import { test, expect } from '@playwright/test'
import { testDb, seedMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID, DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID } from './fixtures/test-data'
import { randomUUID } from 'node:crypto'

async function seedClass(capacity: number): Promise<string> {
  const id = randomUUID()
  const startsAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  const endsAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  const { error } = await testDb.from('classes').insert({
    id,
    studio_id: DEFAULT_STUDIO_ID,
    class_type_id: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
    title: `E2EAtomicRace_${id.slice(0, 8)}`,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity,
    booked_count: 0,
    checked_in_count: 0,
    status: 'scheduled',
  })
  if (error) throw new Error(`seedClass: ${error.message}`)
  return id
}

test.describe('Platform — Atomic Booking Concurrency (T29/B17)', () => {
  test.setTimeout(60_000)

  test('10 concurrent bookings vs capacity=1 → exactly 1 succeeds @p0', async ({ page }) => {
    const classId = await seedClass(1)
    const members = await Promise.all(
      Array.from({ length: 10 }, (_, i) => seedMember({ fullName: `E2EAtomicRace_M${i}` }))
    )

    try {
      const results = await Promise.all(
        members.map((m) =>
          page.request.post('/api/bookings', {
            data: { class_id: classId, member_id: m.memberId },
          })
        )
      )

      const okCount = results.filter((r) => r.ok()).length
      const rejectedCount = results.filter((r) => !r.ok()).length

      // Atomic guarantee: exactly 1 success.
      expect(okCount).toBe(1)
      expect(rejectedCount).toBe(9)

      // Verify DB state matches
      const { count: actual } = await testDb
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .in('status', ['booked', 'checked_in'])
      expect(actual).toBe(1)
    } finally {
      await testDb.from('bookings').delete().eq('class_id', classId)
      await testDb.from('classes').delete().eq('id', classId)
      for (const m of members) {
        await testDb.from('members').delete().eq('id', m.memberId)
        await testDb.from('profiles').delete().eq('id', m.profileId)
      }
    }
  })

  test('4 concurrent bookings vs capacity=2 → exactly 2 succeed @p0', async ({ page }) => {
    const classId = await seedClass(2)
    const members = await Promise.all(
      Array.from({ length: 4 }, (_, i) => seedMember({ fullName: `E2EAtomicCap2_M${i}` }))
    )

    try {
      const results = await Promise.all(
        members.map((m) =>
          page.request.post('/api/bookings', {
            data: { class_id: classId, member_id: m.memberId },
          })
        )
      )

      const okCount = results.filter((r) => r.ok()).length
      expect(okCount).toBe(2)

      const { count: actual } = await testDb
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .in('status', ['booked', 'checked_in'])
      expect(actual).toBe(2)
    } finally {
      await testDb.from('bookings').delete().eq('class_id', classId)
      await testDb.from('classes').delete().eq('id', classId)
      for (const m of members) {
        await testDb.from('members').delete().eq('id', m.memberId)
        await testDb.from('profiles').delete().eq('id', m.profileId)
      }
    }
  })

  test('duplicate member booking rejected in concurrent burst @p1', async ({ page }) => {
    const classId = await seedClass(5)
    const m = await seedMember({ fullName: 'E2EAtomicDup' })

    try {
      // Fire 3 booking requests for the same member + class
      const results = await Promise.all([
        page.request.post('/api/bookings', { data: { class_id: classId, member_id: m.memberId } }),
        page.request.post('/api/bookings', { data: { class_id: classId, member_id: m.memberId } }),
        page.request.post('/api/bookings', { data: { class_id: classId, member_id: m.memberId } }),
      ])

      const okCount = results.filter((r) => r.ok()).length
      expect(okCount).toBe(1)

      const { count: actual } = await testDb
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('member_id', m.memberId)
        .in('status', ['booked', 'checked_in'])
      expect(actual).toBe(1)
    } finally {
      await testDb.from('bookings').delete().eq('class_id', classId)
      await testDb.from('classes').delete().eq('id', classId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })
})
