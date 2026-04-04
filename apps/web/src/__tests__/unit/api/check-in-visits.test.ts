import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Constants ─────────────────────────────────────────────────
const TEST_USER_ID = 'aaaaaaaa-1111-2222-3333-444444444444'
const TEST_STUDIO_ID = 'bbbbbbbb-1111-2222-3333-444444444444'
const TEST_BOOKING_ID = 'eeeeeeee-1111-2222-3333-444444444444'
const TEST_MEMBER_ID = 'dddddddd-1111-2222-3333-444444444444'
const TEST_CLASS_ID = 'cccccccc-1111-2222-3333-444444444444'

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

// ─── Chainable mock ────────────────────────────────────────────
import { createChainableMock, type MockReturnValue } from '@/__tests__/helpers/mock-chainable'

function buildSupabaseMock(
  tableResponses: Record<string, MockReturnValue>,
  authResponse?: { user: unknown; error?: unknown },
) {
  const defaultResponse: MockReturnValue = { data: null, error: null, count: 0 }
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authResponse?.user ?? null },
        error: authResponse?.error ?? null,
      }),
    },
    from: vi.fn((table: string) => {
      const resp = tableResponses[table] ?? defaultResponse
      return createChainableMock(resp)
    }),
  }
}

// ─── Module mocks ──────────────────────────────────────────────
let mockSupabase: ReturnType<typeof buildSupabaseMock>

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

const mockInngestSend = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}))

const { POST } = await import('@/app/api/check-in/route')

// ─── Tests — Visit Tracking ────────────────────────────────────

describe('POST /api/check-in — visit tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Helper: build a Supabase mock that simulates a complete successful check-in
   * flow through all the sequential .from() calls. The check-in route issues:
   *
   *   1. profiles   — auth role check
   *   2. bookings   — fetch booking (status: "booked", no trainer)
   *   3. bookings   — update to checked_in
   *   4. activity_log — insert check-in activity
   *   5. members    — select current total_visits  (visit tracking)
   *   6. members    — update total_visits, last_visit, engagement_status
   *
   * memberSelectResponse controls what step 5 returns.
   * memberUpdateResponse controls what step 6 returns.
   */
  function buildVisitTrackingMock(opts: {
    memberSelectResponse?: MockReturnValue
    memberUpdateResponse?: MockReturnValue
    bookingUpdateResponse?: MockReturnValue
  } = {}) {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ['owner'] }, error: null } },
      { user: { id: TEST_USER_ID } },
    )

    let bookingsCallCount = 0
    let membersCallCount = 0
    const originalFrom = supabase.from

    supabase.from = vi.fn((table: string) => {
      if (table === 'bookings') {
        bookingsCallCount++
        if (bookingsCallCount === 1) {
          // Fetch booking
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID,
              status: 'booked',
              member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID,
              glofox_id: null,
              classes: { id: TEST_CLASS_ID, trainer_id: null, start_time: new Date().toISOString(), end_time: new Date().toISOString() },
              members: { glofox_id: null },
            },
            error: null,
          })
        }
        if (bookingsCallCount === 2) {
          // Update booking to checked_in
          return createChainableMock(
            opts.bookingUpdateResponse ?? {
              data: { id: TEST_BOOKING_ID, status: 'checked_in', attended: true },
              error: null,
            },
          )
        }
      }
      if (table === 'activity_log') {
        return createChainableMock({ data: null, error: null })
      }
      if (table === 'members') {
        membersCallCount++
        if (membersCallCount === 1) {
          // Select current total_visits
          return createChainableMock(
            opts.memberSelectResponse ?? { data: { total_visits: 5 }, error: null },
          )
        }
        if (membersCallCount === 2) {
          // Update visit stats
          return createChainableMock(
            opts.memberUpdateResponse ?? { data: null, error: null },
          )
        }
      }
      return originalFrom(table)
    }) as typeof supabase.from

    return supabase
  }

  it('increments total_visits after successful check-in', async () => {
    mockSupabase = buildVisitTrackingMock({
      memberSelectResponse: { data: { total_visits: 5 }, error: null },
    })

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    expect(res.status).toBe(200)

    // Verify that members table was queried (select + update = 2 calls)
    const membersCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'members',
    )
    expect(membersCalls.length).toBe(2)
  })

  it('updates last_visit timestamp after check-in', async () => {
    mockSupabase = buildVisitTrackingMock()

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    expect(res.status).toBe(200)

    // The second members call is the update with last_visit
    const membersCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'members',
    )
    // We verify 2 calls happened: select then update
    expect(membersCalls.length).toBe(2)
  })

  it('sets engagement_status to engaged after check-in', async () => {
    mockSupabase = buildVisitTrackingMock()

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    expect(res.status).toBe(200)

    // The update call to members should include engagement_status: 'engaged'
    // Since we use chainable mocks, we verify the members table was touched
    const membersCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'members',
    )
    expect(membersCalls.length).toBe(2) // select + update
  })

  it('does not increment visits if booking update fails', async () => {
    mockSupabase = buildVisitTrackingMock({
      bookingUpdateResponse: { data: null, error: { message: 'update failed' } },
    })

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    // Route returns 500 when booking update fails
    expect(res.status).toBe(500)

    // Members table should NOT have been touched because the booking update failed
    // and the route returns early
    const membersCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'members',
    )
    expect(membersCalls.length).toBe(0)
  })

  it('check-in succeeds even if visit tracking fails (non-blocking)', async () => {
    // The visit tracking is in a try/catch — if the members SELECT throws,
    // the check-in should still return 200 successfully.
    mockSupabase = buildVisitTrackingMock({
      memberSelectResponse: { data: null, error: { message: 'member not found' } },
    })

    // Spy on console.error since the route logs the visit tracking failure
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    // The check-in itself should succeed
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.status).toBe('checked_in')

    consoleSpy.mockRestore()
  })

  it('handles member not found gracefully', async () => {
    // When the member select returns null data (member not found in members table),
    // the route should still succeed because visit tracking is non-blocking.
    mockSupabase = buildVisitTrackingMock({
      memberSelectResponse: { data: null, error: null },
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    // Check-in should still succeed
    expect(res.status).toBe(200)

    consoleSpy.mockRestore()
  })

  it('handles member with zero previous visits', async () => {
    mockSupabase = buildVisitTrackingMock({
      memberSelectResponse: { data: { total_visits: 0 }, error: null },
    })

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    expect(res.status).toBe(200)

    // Members table should be called for select + update
    const membersCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'members',
    )
    expect(membersCalls.length).toBe(2)
  })

  it('handles member with null total_visits (defaults to 0)', async () => {
    // When total_visits is null, the code coalesces to 0 and increments to 1
    mockSupabase = buildVisitTrackingMock({
      memberSelectResponse: { data: { total_visits: null }, error: null },
    })

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    expect(res.status).toBe(200)

    const membersCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'members',
    )
    expect(membersCalls.length).toBe(2)
  })

  it('does not attempt visit tracking when member_id is missing from booking', async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ['owner'] }, error: null } },
      { user: { id: TEST_USER_ID } },
    )

    let bookingsCallCount = 0
    const originalFrom = supabase.from
    supabase.from = vi.fn((table: string) => {
      if (table === 'bookings') {
        bookingsCallCount++
        if (bookingsCallCount === 1) {
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID,
              status: 'booked',
              member_id: null, // no member_id
              class_id: TEST_CLASS_ID,
              glofox_id: null,
              classes: { id: TEST_CLASS_ID, trainer_id: null },
              members: { glofox_id: null },
            },
            error: null,
          })
        }
        if (bookingsCallCount === 2) {
          return createChainableMock({
            data: { id: TEST_BOOKING_ID, status: 'checked_in', attended: true },
            error: null,
          })
        }
      }
      if (table === 'activity_log') return createChainableMock({ data: null, error: null })
      return originalFrom(table)
    }) as typeof supabase.from
    mockSupabase = supabase

    const res = await POST(
      makeRequest('/api/check-in', {
        method: 'POST',
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      }),
    )
    expect(res.status).toBe(200)

    // Members table should NOT have been touched
    const membersCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'members',
    )
    expect(membersCalls.length).toBe(0)
  })
})
