import { vi } from 'vitest'

/**
 * Creates a mock GlofoxClient instance.
 * All write methods are no-op stubs. Read methods return empty paginated responses.
 *
 * CRITICAL: No tests should ever hit the real Glofox API for writes.
 * Reads can optionally be configured to return specific data.
 *
 * Usage:
 *   const mockGlofox = vi.hoisted(() => createMockGlofoxClient())
 *   vi.mock('@/lib/glofox/client', () => ({
 *     GlofoxClient: vi.fn(() => mockGlofox),
 *   }))
 */
export function createMockGlofoxClient() {
  return {
    // ── Write methods (always mocked, never hit real API) ──
    createBooking: vi.fn().mockResolvedValue({ id: 'glofox-booking-mock', status: 'confirmed' }),
    cancelBooking: vi.fn().mockResolvedValue({ success: true }),
    markAttendance: vi.fn().mockResolvedValue({ success: true }),
    registerMember: vi.fn().mockResolvedValue({ id: 'glofox-member-mock' }),
    purchaseMembership: vi.fn().mockResolvedValue({ id: 'glofox-membership-mock' }),
    cancelMembership: vi.fn().mockResolvedValue({ success: true }),
    createEvent: vi.fn().mockResolvedValue({ id: 'glofox-event-mock' }),
    updateEvent: vi.fn().mockResolvedValue({ success: true }),

    // ── Read methods (configurable responses) ──
    getMembers: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getMember: vi.fn().mockResolvedValue({ data: null }),
    getEvents: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getBookings: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getClasses: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getTrainers: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getMemberships: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getProducts: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getBranches: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    getAnalytics: vi.fn().mockResolvedValue({ data: {} }),
  }
}

/**
 * Reset all mock calls between tests.
 */
export function resetGlofoxMock(mock: ReturnType<typeof createMockGlofoxClient>) {
  Object.values(mock).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as ReturnType<typeof vi.fn>).mockClear()
    }
  })
}
