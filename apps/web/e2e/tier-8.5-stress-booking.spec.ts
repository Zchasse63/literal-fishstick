/**
 * T36 — Stress/load test for atomic booking RPC.
 *
 * Fires 100 concurrent POST /api/bookings against a single class with
 * capacity=12 and verifies:
 *   - Exactly 12 succeed
 *   - All 88 rejections are 409 (class_full), not 500s
 *   - Final DB state shows exactly 12 bookings
 *
 * This is a higher-scale version of tier-8.5-atomic-booking-concurrency
 * designed to flush out any race windows that only show up under heavier
 * contention (lock queue depth, connection pool starvation, etc.).
 */
import { test, expect } from '@playwright/test'
import { testDb, seedMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID, DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID } from './fixtures/test-data'
import { randomUUID } from 'node:crypto'

const CONCURRENCY = 100
const CAPACITY = 12

test.describe('Platform — Stress: 100 concurrent bookings (T36)', () => {
  test.setTimeout(180_000)

  test('100 concurrent bookings vs capacity=12 → exactly 12 succeed @stress', async ({
    page,
  }) => {
    // Seed class + members
    const classId = randomUUID()
    const startsAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    const endsAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()

    {
      const { error } = await testDb.from('classes').insert({
        id: classId,
        studio_id: DEFAULT_STUDIO_ID,
        class_type_id: DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID,
        title: `E2EStress100_${classId.slice(0, 8)}`,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: CAPACITY,
        booked_count: 0,
        checked_in_count: 0,
        status: 'scheduled',
      })
      if (error) throw new Error(`seedClass: ${error.message}`)
    }

    const members = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        seedMember({ fullName: `E2EStress100_M${String(i).padStart(3, '0')}` })
      )
    )

    try {
      const startTime = Date.now()

      // Fire all 100 requests in parallel
      const results = await Promise.all(
        members.map((m) =>
          page.request.post('/api/bookings', {
            data: { class_id: classId, member_id: m.memberId },
          })
        )
      )

      const elapsedMs = Date.now() - startTime

      // Classify responses
      const statuses = results.map((r) => r.status())
      const okCount = statuses.filter((s) => s === 201).length
      const conflictCount = statuses.filter((s) => s === 409).length
      const serverErrorCount = statuses.filter((s) => s >= 500).length
      const unauthorizedCount = statuses.filter((s) => s === 401 || s === 403).length

      console.log(
        `[T36] ${CONCURRENCY} requests in ${elapsedMs}ms: ` +
          `${okCount} ok, ${conflictCount} 409, ${serverErrorCount} 5xx, ${unauthorizedCount} auth`
      )

      // Atomic RPC guarantee: exactly CAPACITY successes
      expect(okCount).toBe(CAPACITY)
      // The rest must be 409 conflicts — never server errors
      expect(serverErrorCount).toBe(0)
      // 409s account for all rejections (minus any auth failures; should be 0 in test env)
      expect(conflictCount).toBe(CONCURRENCY - CAPACITY - unauthorizedCount)

      // Verify DB state matches
      const { count: actual } = await testDb
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .in('status', ['booked', 'checked_in'])
      expect(actual).toBe(CAPACITY)

      // Soft SLA: 100 concurrent bookings should complete in < 30s
      // (atomic RPC with FOR UPDATE is serialized, so bounded by latency*CAPACITY)
      expect(elapsedMs).toBeLessThan(30_000)
    } finally {
      await testDb.from('bookings').delete().eq('class_id', classId)
      await testDb.from('classes').delete().eq('id', classId)
      for (const m of members) {
        await testDb.from('members').delete().eq('id', m.memberId)
        await testDb.from('profiles').delete().eq('id', m.profileId)
      }
    }
  })
})
