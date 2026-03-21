import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock setup — intercept `createClient` so `getAdminClient()` returns our mock
// ---------------------------------------------------------------------------

/**
 * We need per-call control over query results because functions like
 * `canEnrollMember` issue multiple sequential queries. The approach:
 * a single chainable builder whose `.then()` pulls from a FIFO queue
 * of responses. Each test pushes the expected responses *in order*.
 */
const responseQueue: Array<{ data: unknown; error: unknown; count: number | null }> = []

function enqueue(data: unknown, error: unknown = null, count: number | null = null) {
  responseQueue.push({ data, error, count })
}

function dequeue() {
  return responseQueue.shift() ?? { data: null, error: null, count: null }
}

// Build a self-returning chainable object whose terminal `.then()` drains the queue.
function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'is', 'not', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'offset',
    'single', 'maybeSingle',
    'match', 'contains', 'containedBy', 'overlaps',
    'textSearch', 'csv', 'returns', 'throwOnError',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => {
      // Return a thenable (awaitable) that drains the queue
      return {
        ...chain,
        then(resolve: (v: unknown) => void) {
          resolve(dequeue())
        },
      }
    })
  }
  return chain
}

const mockChain = makeChain()
const mockFrom = vi.fn().mockReturnValue(mockChain)

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// Import AFTER mock is established
import {
  canEnrollMember,
  checkExitConditions,
  checkAutomationCooldown,
  updateCooldown,
  recordStepExecution,
  completeEnrollment,
  exitEnrollment,
  failEnrollment,
} from '@/lib/inngest/helpers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STUDIO = 'studio-1'
const MEMBER = 'member-1'
const FLOW_ID = 'flow-1'
const ENROLLMENT_ID = 'enroll-1'

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_ID,
    member_id: MEMBER,
    automation_id: FLOW_ID,
    studio_id: STUDIO,
    enrolled_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset queue + call tracking between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  responseQueue.length = 0
  mockFrom.mockClear()
  for (const m of Object.keys(mockChain)) {
    if (typeof mockChain[m] === 'function' && 'mockClear' in (mockChain[m] as object)) {
      (mockChain[m] as ReturnType<typeof vi.fn>).mockClear()
    }
  }
})

// =========================================================================
// canEnrollMember
// =========================================================================

describe('canEnrollMember', () => {
  const flow = { id: FLOW_ID, studio_id: STUDIO }

  it('returns false when an active enrollment exists', async () => {
    enqueue({ id: 'existing-enrollment' }) // active/paused query returns a row
    const result = await canEnrollMember(flow, MEMBER)
    expect(result).toBe(false)
  })

  it('returns false when a paused enrollment exists', async () => {
    enqueue({ id: 'paused-enrollment' })
    const result = await canEnrollMember(flow, MEMBER)
    expect(result).toBe(false)
  })

  it('returns false when allow_reenrollment=false and a completed enrollment exists', async () => {
    enqueue(null) // no active enrollment
    enqueue({ id: 'past-completed' }) // completed enrollment exists
    const result = await canEnrollMember({ ...flow, allow_reenrollment: false }, MEMBER)
    expect(result).toBe(false)
  })

  it('returns true when allow_reenrollment=false but only a failed enrollment exists', async () => {
    enqueue(null) // no active enrollment
    enqueue(null) // no completed enrollment (failed ones aren't queried)
    const result = await canEnrollMember({ ...flow, allow_reenrollment: false }, MEMBER)
    expect(result).toBe(true)
  })

  it('returns true when allow_reenrollment=true and no cooldown', async () => {
    enqueue(null) // no active enrollment
    const result = await canEnrollMember({ ...flow, allow_reenrollment: true }, MEMBER)
    expect(result).toBe(true)
  })

  it('returns false when cooldown_days=30 and completed within cooldown window', async () => {
    enqueue(null) // no active enrollment
    enqueue({ id: 'recent-completion' }) // recent completed within 30 days
    const result = await canEnrollMember(
      { ...flow, allow_reenrollment: true, cooldown_days: 30 },
      MEMBER,
    )
    expect(result).toBe(false)
  })

  it('returns true when cooldown_days=30 and completed 31+ days ago', async () => {
    enqueue(null) // no active enrollment
    enqueue(null) // no recent completion within cooldown window
    const result = await canEnrollMember(
      { ...flow, allow_reenrollment: true, cooldown_days: 30 },
      MEMBER,
    )
    expect(result).toBe(true)
  })

  it('returns true when no enrollments exist at all', async () => {
    enqueue(null) // no active enrollment
    const result = await canEnrollMember(flow, MEMBER)
    expect(result).toBe(true)
  })
})

// =========================================================================
// checkExitConditions
// =========================================================================

describe('checkExitConditions', () => {
  const enrollment = makeEnrollment()

  it('returns null for empty exit conditions array', async () => {
    const result = await checkExitConditions(enrollment, [])
    expect(result).toBeNull()
  })

  it('returns null for undefined-ish exit conditions', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkExitConditions(enrollment, undefined as any)
    expect(result).toBeNull()
  })

  it('returns "booking_made" when member has a booking since enrolled_at', async () => {
    enqueue(null, null, 1) // count = 1
    const result = await checkExitConditions(enrollment, [{ type: 'booking_made' }])
    expect(result).toBe('booking_made')
  })

  it('returns null when booking_made condition has no bookings', async () => {
    enqueue(null, null, 0) // count = 0
    const result = await checkExitConditions(enrollment, [{ type: 'booking_made' }])
    expect(result).toBeNull()
  })

  it('returns "membership_active" when member status is active', async () => {
    enqueue({ membership_status: 'active' })
    const result = await checkExitConditions(enrollment, [{ type: 'membership_active' }])
    expect(result).toBe('membership_active')
  })

  it('returns null when membership_active condition and member status is expired', async () => {
    enqueue({ membership_status: 'expired' })
    const result = await checkExitConditions(enrollment, [{ type: 'membership_active' }])
    expect(result).toBeNull()
  })

  it('returns "checked_in" when member checked in since enrollment', async () => {
    enqueue(null, null, 3) // count = 3
    const result = await checkExitConditions(enrollment, [{ type: 'checked_in' }])
    expect(result).toBe('checked_in')
  })

  it('returns null for checked_in when no check-ins', async () => {
    enqueue(null, null, 0)
    const result = await checkExitConditions(enrollment, [{ type: 'checked_in' }])
    expect(result).toBeNull()
  })

  it('returns "payment_succeeded" when a completed transaction exists', async () => {
    enqueue(null, null, 2) // count = 2
    const result = await checkExitConditions(enrollment, [{ type: 'payment_succeeded' }])
    expect(result).toBe('payment_succeeded')
  })

  it('returns null for payment_succeeded when no completed transactions', async () => {
    enqueue(null, null, 0)
    const result = await checkExitConditions(enrollment, [{ type: 'payment_succeeded' }])
    expect(result).toBeNull()
  })

  it('returns null for manual condition (never auto-resolves)', async () => {
    const result = await checkExitConditions(enrollment, [{ type: 'manual' }])
    expect(result).toBeNull()
  })

  it('returns the first matching condition when multiple conditions exist', async () => {
    enqueue(null, null, 0) // booking_made: no match
    enqueue({ membership_status: 'active' }) // membership_active: match!
    // payment_succeeded would be third but shouldn't be reached
    const result = await checkExitConditions(enrollment, [
      { type: 'booking_made' },
      { type: 'membership_active' },
      { type: 'payment_succeeded' },
    ])
    expect(result).toBe('membership_active')
  })

  it('continues checking other conditions when one throws an error', async () => {
    // Force the first condition to throw by providing an error response
    // We'll use a mock that throws for the first call
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Make the booking query throw
    const originalSelect = mockChain.select as ReturnType<typeof vi.fn>
    let callCount = 0
    originalSelect.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call (booking_made) — return object whose chain methods throw
        throw new Error('DB connection failed')
      }
      return {
        ...mockChain,
        then(resolve: (v: unknown) => void) {
          resolve(dequeue())
        },
      }
    })

    enqueue({ membership_status: 'active' }) // for the second condition

    const result = await checkExitConditions(enrollment, [
      { type: 'booking_made' },
      { type: 'membership_active' },
    ])

    expect(result).toBe('membership_active')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

// =========================================================================
// checkAutomationCooldown
// =========================================================================

describe('checkAutomationCooldown', () => {
  it('returns false when no cooldown record exists', async () => {
    enqueue(null)
    const result = await checkAutomationCooldown(MEMBER, STUDIO, 'email')
    expect(result).toBe(false)
  })

  it('returns false when last sent more than 24 hours ago', async () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
    enqueue({ last_sent_at: thirtyHoursAgo })
    const result = await checkAutomationCooldown(MEMBER, STUDIO, 'email')
    expect(result).toBe(false)
  })

  it('returns true when last sent less than 24 hours ago (blocked)', async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    enqueue({ last_sent_at: oneHourAgo })
    const result = await checkAutomationCooldown(MEMBER, STUDIO, 'sms')
    expect(result).toBe(true)
  })
})

// =========================================================================
// updateCooldown
// =========================================================================

describe('updateCooldown', () => {
  it('calls upsert with the correct parameters', async () => {
    enqueue(null) // upsert result
    await updateCooldown(MEMBER, STUDIO, 'email')

    expect(mockFrom).toHaveBeenCalledWith('automation_cooldowns')
    expect(mockChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: MEMBER,
        studio_id: STUDIO,
        channel: 'email',
        last_sent_at: expect.any(String),
      }),
      { onConflict: 'member_id,studio_id,channel' },
    )
  })
})

// =========================================================================
// recordStepExecution
// =========================================================================

describe('recordStepExecution', () => {
  it('appends to empty history and sets current_step', async () => {
    enqueue({ step_history: null }) // fetch current enrollment
    enqueue(null) // update result

    await recordStepExecution(ENROLLMENT_ID, 0, 'send_email', 'completed')

    expect(mockFrom).toHaveBeenCalledWith('automation_enrollments')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        step_history: [
          expect.objectContaining({
            step_index: 0,
            step_type: 'send_email',
            status: 'completed',
            executed_at: expect.any(String),
          }),
        ],
        current_step: 0,
        last_processed_at: expect.any(String),
      }),
    )
  })

  it('appends to existing history', async () => {
    const existingRecord = {
      step_index: 0,
      step_type: 'delay',
      status: 'completed',
      executed_at: '2026-01-01T00:00:00.000Z',
    }
    enqueue({ step_history: [existingRecord] })
    enqueue(null)

    await recordStepExecution(ENROLLMENT_ID, 1, 'send_email', 'completed', { email_id: 'e-1' })

    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        step_history: [
          existingRecord,
          expect.objectContaining({
            step_index: 1,
            step_type: 'send_email',
            status: 'completed',
            metadata: { email_id: 'e-1' },
          }),
        ],
        current_step: 1,
      }),
    )
  })

  it('includes error field when provided', async () => {
    enqueue({ step_history: [] })
    enqueue(null)

    await recordStepExecution(ENROLLMENT_ID, 2, 'send_sms', 'failed', undefined, 'Provider timeout')

    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        step_history: [
          expect.objectContaining({
            step_index: 2,
            step_type: 'send_sms',
            status: 'failed',
            error: 'Provider timeout',
          }),
        ],
      }),
    )
  })
})

// =========================================================================
// completeEnrollment
// =========================================================================

describe('completeEnrollment', () => {
  it('sets status to completed with timestamps', async () => {
    enqueue(null)
    await completeEnrollment(ENROLLMENT_ID)

    expect(mockFrom).toHaveBeenCalledWith('automation_enrollments')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completed_at: expect.any(String),
        last_processed_at: expect.any(String),
      }),
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', ENROLLMENT_ID)
  })
})

// =========================================================================
// exitEnrollment
// =========================================================================

describe('exitEnrollment', () => {
  it('sets status to exited with reason and timestamps', async () => {
    enqueue(null)
    await exitEnrollment(ENROLLMENT_ID, 'booking_made')

    expect(mockFrom).toHaveBeenCalledWith('automation_enrollments')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'exited',
        exit_reason: 'booking_made',
        exited_at: expect.any(String),
        last_processed_at: expect.any(String),
      }),
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', ENROLLMENT_ID)
  })
})

// =========================================================================
// failEnrollment
// =========================================================================

describe('failEnrollment', () => {
  it('sets status to failed with reason and last_processed_at', async () => {
    enqueue(null)
    await failEnrollment(ENROLLMENT_ID, 'Max retries exceeded')

    expect(mockFrom).toHaveBeenCalledWith('automation_enrollments')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        exit_reason: 'Max retries exceeded',
        last_processed_at: expect.any(String),
      }),
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', ENROLLMENT_ID)
  })

  it('does not set completed_at or exited_at', async () => {
    enqueue(null)
    await failEnrollment(ENROLLMENT_ID, 'Unrecoverable error')

    const updateArg = (mockChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('completed_at')
    expect(updateArg).not.toHaveProperty('exited_at')
  })
})
