import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// FIFO response queue — mirrors helpers.test.ts pattern
// ---------------------------------------------------------------------------

const responseQueue: Array<{ data: unknown; error: unknown; count: number | null }> = []

function enqueue(data: unknown, error: unknown = null, count: number | null = null) {
  responseQueue.push({ data, error, count })
}

function dequeue() {
  return responseQueue.shift() ?? { data: null, error: null, count: null }
}

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
    'like',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => {
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

// Mock canEnrollMember — allow enrollment by default
const mockCanEnrollMember = vi.fn().mockResolvedValue(true)

vi.mock('@/lib/inngest/helpers', () => ({
  getAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
  canEnrollMember: (...args: unknown[]) => mockCanEnrollMember(...args),
}))

// Mock inngest client for send
const mockInngestSend = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: mockInngestSend,
    createFunction: vi.fn((_config: unknown, handler: unknown) => {
      // Expose the handler so tests can invoke it directly
      return { _handler: handler, fn: handler }
    }),
  },
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { evaluateTriggers } from '@/lib/inngest/functions/evaluate-triggers'

// Extract the raw handler function from the inngest wrapper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = (evaluateTriggers as any)._handler ?? (evaluateTriggers as any).fn

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const STUDIO_ID = 'studio-1'
const FLOW_ID = 'flow-1'

function makeStepMock() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn(),
    sendEvent: vi.fn(),
  }
}

function makeFlow(overrides: Record<string, unknown> = {}) {
  return {
    id: FLOW_ID,
    studio_id: STUDIO_ID,
    trigger_type: 'signup',
    trigger_config: {},
    steps: [{ type: 'email', subject: 'Test', body: 'Test body' }],
    exit_conditions: { conditions: [{ type: 'booking_made' }] },
    version: 1,
    allow_reenrollment: false,
    cooldown_days: null,
    is_active: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  responseQueue.length = 0
  mockFrom.mockClear()
  mockCanEnrollMember.mockReset().mockResolvedValue(true)
  mockInngestSend.mockReset().mockResolvedValue(undefined)

  for (const m of Object.keys(mockChain)) {
    if (typeof mockChain[m] === 'function' && 'mockClear' in (mockChain[m] as object)) {
      (mockChain[m] as ReturnType<typeof vi.fn>).mockClear()
    }
  }
})

// =========================================================================
// Tests
// =========================================================================

describe('evaluate-triggers', () => {
  // -----------------------------------------------------------------------
  // Multi-tenancy
  // -----------------------------------------------------------------------
  describe('multi-tenancy', () => {
    it('queries all studios from database', async () => {
      const step = makeStepMock()

      // load-studios returns two studios
      enqueue([{ id: 'studio-a' }, { id: 'studio-b' }])
      // load-flows for studio-a (empty)
      enqueue([])
      // load-flows for studio-b (empty)
      enqueue([])

      const result = await handler({ step })

      // Verify studios table was queried
      expect(mockFrom).toHaveBeenCalledWith('studios')
      expect(result.studios_evaluated).toBe(2)
    })

    it('evaluates flows per studio independently', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: 'studio-a' }, { id: 'studio-b' }])
      // load-flows for studio-a — one active flow
      enqueue([makeFlow({ id: 'flow-a', studio_id: 'studio-a', trigger_type: 'signup' })])
      // evaluate-flow-a-signup — finds qualifying members
      enqueue([{ id: 'profile-1' }])
      // enroll-flow-a: insert enrollment
      enqueue({ id: 'enroll-1' }, null)
      // dispatch events for flow-a (inngest.send call)

      // load-flows for studio-b — one active flow
      enqueue([makeFlow({ id: 'flow-b', studio_id: 'studio-b', trigger_type: 'signup' })])
      // evaluate-flow-b-signup
      enqueue([{ id: 'profile-2' }])
      // enroll-flow-b: insert enrollment
      enqueue({ id: 'enroll-2' }, null)

      const result = await handler({ step })

      expect(result.studios_evaluated).toBe(2)
      expect(result.flows_evaluated).toBe(2)
      expect(result.enrollments_created).toBe(2)
    })

    it('returns no_studios when studios table is empty', async () => {
      const step = makeStepMock()

      // load-studios returns empty array
      enqueue([])

      const result = await handler({ step })

      expect(result.status).toBe('no_studios')
      expect(result.enrollments_created).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Existing triggers
  // -----------------------------------------------------------------------
  describe('signup trigger', () => {
    it('finds profiles created in the last 10 minutes', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'signup' })])
      // evaluate: profiles query returns new signups
      enqueue([{ id: 'profile-new-1' }, { id: 'profile-new-2' }])
      // enroll member 1
      enqueue({ id: 'enroll-1' }, null)
      // enroll member 2
      enqueue({ id: 'enroll-2' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(2)
      // Verify the profiles table was queried with gte on created_at
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })
  })

  describe('no_show trigger', () => {
    it('finds bookings marked no_show in window', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'no_show' })])
      // evaluate: bookings query with join to members
      enqueue([
        { member_id: 'm-1', members: { profile_id: 'profile-ns-1' } },
        { member_id: 'm-2', members: { profile_id: 'profile-ns-2' } },
      ])
      // enroll both
      enqueue({ id: 'enroll-1' }, null)
      enqueue({ id: 'enroll-2' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(2)
      expect(mockFrom).toHaveBeenCalledWith('bookings')
    })
  })

  describe('inactivity trigger', () => {
    it('finds active members with no recent check-in', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'inactivity', trigger_config: { inactivity_days: 30 } })])
      // evaluate: active members
      enqueue([
        { id: 'member-1', profile_id: 'profile-1' },
        { id: 'member-2', profile_id: 'profile-2' },
      ])
      // recent bookings batch — only member-1 has checked in recently
      enqueue([{ member_id: 'member-1' }])
      // enroll member-2 (inactive)
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      // Only member-2 is inactive, so 1 enrollment
      expect(result.enrollments_created).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // NEW behavioral triggers
  // -----------------------------------------------------------------------

  describe('never_booked trigger', () => {
    it('finds members joined >48h ago with zero bookings', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'never_booked', trigger_config: { hours_since_join: 48 } })])
      // evaluate: members who joined before cutoff
      enqueue([
        { id: 'member-1', profile_id: 'profile-1' },
        { id: 'member-2', profile_id: 'profile-2' },
      ])
      // bookings check — member-1 has bookings, member-2 does not
      enqueue([{ member_id: 'member-1' }])
      // enroll member-2 (never booked)
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('members')
      expect(mockFrom).toHaveBeenCalledWith('bookings')
    })

    it('respects configurable hours_since_join', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows — custom 72-hour window
      enqueue([makeFlow({ trigger_type: 'never_booked', trigger_config: { hours_since_join: 72 } })])
      // evaluate: members query (no members match the 72h cutoff)
      enqueue([])
      // No qualifying members — no enrollments needed

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
      // The members query was still made
      expect(mockFrom).toHaveBeenCalledWith('members')
    })

    it('excludes members who have at least one booking', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'never_booked', trigger_config: { hours_since_join: 48 } })])
      // evaluate: all three members joined >48h ago
      enqueue([
        { id: 'member-1', profile_id: 'profile-1' },
        { id: 'member-2', profile_id: 'profile-2' },
        { id: 'member-3', profile_id: 'profile-3' },
      ])
      // All three have bookings
      enqueue([
        { member_id: 'member-1' },
        { member_id: 'member-2' },
        { member_id: 'member-3' },
      ])

      const result = await handler({ step })

      // Everyone has bookings, so no enrollments
      expect(result.enrollments_created).toBe(0)
    })

    it('excludes members who joined less than 48h ago', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'never_booked', trigger_config: { hours_since_join: 48 } })])
      // evaluate: members query returns empty (no one joined before the cutoff)
      enqueue([])

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
    })
  })

  describe('classpass_repeat trigger', () => {
    it('finds classpass members with 2+ visits', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'classpass_repeat', trigger_config: { min_visits: 2 } })])
      // evaluate: profiles with classpass + inner join on members
      enqueue([
        { id: 'profile-cp-1', members: [{ total_visits: 3 }] },
        { id: 'profile-cp-2', members: [{ total_visits: 5 }] },
      ])
      // enroll both
      enqueue({ id: 'enroll-1' }, null)
      enqueue({ id: 'enroll-2' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(2)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    it('excludes non-classpass members even with many visits', async () => {
      // The query filters on acquisition_source='classpass' at the DB level.
      // Non-classpass members are never returned from the query.
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'classpass_repeat', trigger_config: { min_visits: 2 } })])
      // evaluate: profiles query returns empty (no classpass members)
      enqueue([])

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
    })

    it('respects configurable min_visits threshold', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows — require 5+ visits
      enqueue([makeFlow({ trigger_type: 'classpass_repeat', trigger_config: { min_visits: 5 } })])
      // evaluate: one classpass member with 3 visits (below threshold), one with 6
      enqueue([
        { id: 'profile-cp-1', members: [{ total_visits: 3 }] },
        { id: 'profile-cp-2', members: [{ total_visits: 6 }] },
      ])
      // Only profile-cp-2 qualifies
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
    })
  })

  describe('one_and_done trigger', () => {
    it('finds members with exactly 1 visit >7 days ago', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'one_and_done', trigger_config: { days_since_visit: 7 } })])
      // evaluate: members with total_visits=1 and last_visit < cutoff
      enqueue([
        { profile_id: 'profile-oad-1' },
        { profile_id: 'profile-oad-2' },
      ])
      // enroll both
      enqueue({ id: 'enroll-1' }, null)
      enqueue({ id: 'enroll-2' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(2)
      expect(mockFrom).toHaveBeenCalledWith('members')
    })

    it('excludes members with 2+ visits', async () => {
      // The query filters total_visits=1 at the DB level.
      // Members with 2+ visits are never returned.
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'one_and_done', trigger_config: { days_since_visit: 7 } })])
      // evaluate: query returns empty because no one matches total_visits=1
      enqueue([])

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
    })

    it('excludes members with recent single visit', async () => {
      // Members with total_visits=1 but last_visit within the last 7 days
      // are filtered out by lt('last_visit', cutoff)
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'one_and_done', trigger_config: { days_since_visit: 7 } })])
      // evaluate: the DB query already excludes recent visitors, so empty
      enqueue([])

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
    })

    it('respects configurable days_since_visit', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows — 14-day threshold instead of 7
      enqueue([makeFlow({ trigger_type: 'one_and_done', trigger_config: { days_since_visit: 14 } })])
      // evaluate: finds one member with last_visit > 14 days ago
      enqueue([{ profile_id: 'profile-oad-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
    })
  })

  describe('cooling_off trigger', () => {
    it('finds members with engagement_status=cooling', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'cooling_off', trigger_config: {} })])
      // evaluate: members query with engagement_status=cooling
      enqueue([
        { profile_id: 'profile-co-1' },
        { profile_id: 'profile-co-2' },
      ])
      // enroll both
      enqueue({ id: 'enroll-1' }, null)
      enqueue({ id: 'enroll-2' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(2)
      expect(mockFrom).toHaveBeenCalledWith('members')
    })

    it('excludes engaged and active members', async () => {
      // The query filters engagement_status='cooling' at the DB level.
      // Engaged / active members are never returned from the query.
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'cooling_off', trigger_config: {} })])
      // evaluate: no cooling members found
      enqueue([])

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
    })
  })

  describe('plan_upgrade_candidate trigger', () => {
    it('finds class_pack members with 8+ monthly visits', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({
        trigger_type: 'plan_upgrade_candidate',
        trigger_config: { min_monthly_visits: 8 },
      })])
      // evaluate: candidates on lower tiers
      enqueue([
        { id: 'member-1', profile_id: 'profile-1' },
        { id: 'member-2', profile_id: 'profile-2' },
      ])
      // recent bookings for these members in last 30 days
      // member-1 has 10 check-ins, member-2 has 4
      enqueue([
        { member_id: 'member-1' }, { member_id: 'member-1' },
        { member_id: 'member-1' }, { member_id: 'member-1' },
        { member_id: 'member-1' }, { member_id: 'member-1' },
        { member_id: 'member-1' }, { member_id: 'member-1' },
        { member_id: 'member-1' }, { member_id: 'member-1' },
        { member_id: 'member-2' }, { member_id: 'member-2' },
        { member_id: 'member-2' }, { member_id: 'member-2' },
      ])
      // Only member-1 qualifies (10 >= 8), enroll
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
    })

    it('excludes unlimited members', async () => {
      // The query only selects members with membership_tier in
      // ['10_class', '6_class', 'drop_in']. Unlimited is excluded.
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({
        trigger_type: 'plan_upgrade_candidate',
        trigger_config: { min_monthly_visits: 8 },
      })])
      // evaluate: no candidates (all unlimited members excluded at DB level)
      enqueue([])

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
    })

    it('respects configurable min_monthly_visits', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows — lower threshold of 4
      enqueue([makeFlow({
        trigger_type: 'plan_upgrade_candidate',
        trigger_config: { min_monthly_visits: 4 },
      })])
      // evaluate: one candidate
      enqueue([{ id: 'member-1', profile_id: 'profile-1' }])
      // member-1 has 5 check-ins in last 30 days (>= 4)
      enqueue([
        { member_id: 'member-1' }, { member_id: 'member-1' },
        { member_id: 'member-1' }, { member_id: 'member-1' },
        { member_id: 'member-1' },
      ])
      // Qualifies — enroll
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
    })
  })

  describe('class_type_fan trigger', () => {
    it('finds members with 5+ visits to same class type', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({
        trigger_type: 'class_type_fan',
        trigger_config: { min_visits: 5 },
      })])
      // evaluate: bookings with checked_in_at and glofox_event_name
      enqueue([
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-2', glofox_event_name: 'Cold Plunge' },
        { member_id: 'member-2', glofox_event_name: 'Cold Plunge' },
      ])
      // Resolve member-1 to profile_id (member-2 only has 2 visits)
      enqueue([{ id: 'member-1', profile_id: 'profile-1' }])
      // enroll profile-1
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
    })

    it('respects configurable min_visits', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows — lower threshold of 3
      enqueue([makeFlow({
        trigger_type: 'class_type_fan',
        trigger_config: { min_visits: 3 },
      })])
      // evaluate: bookings
      enqueue([
        { member_id: 'member-1', glofox_event_name: 'Guided Breathwork' },
        { member_id: 'member-1', glofox_event_name: 'Guided Breathwork' },
        { member_id: 'member-1', glofox_event_name: 'Guided Breathwork' },
      ])
      // Resolve member-1 to profile_id
      enqueue([{ id: 'member-1', profile_id: 'profile-1' }])
      // enroll
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
    })

    it('handles members who attend multiple class types', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({
        trigger_type: 'class_type_fan',
        trigger_config: { min_visits: 5 },
      })])
      // evaluate: member-1 has 5 Hot Sauna + 3 Cold Plunge
      // member-1 qualifies for Hot Sauna (5 >= 5)
      enqueue([
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Hot Sauna' },
        { member_id: 'member-1', glofox_event_name: 'Cold Plunge' },
        { member_id: 'member-1', glofox_event_name: 'Cold Plunge' },
        { member_id: 'member-1', glofox_event_name: 'Cold Plunge' },
      ])
      // Resolve member IDs to profile IDs — member-1 qualifies once (deduped)
      enqueue([{ id: 'member-1', profile_id: 'profile-1' }])
      // enroll — only 1 enrollment even though they fan multiple types
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      // Member-1 qualifies once, even with multiple fan-qualifying types
      expect(result.enrollments_created).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // Enrollment mechanics
  // -----------------------------------------------------------------------

  describe('enrollment', () => {
    it('creates enrollment records for qualifying members', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'signup' })])
      // evaluate: one qualifying member
      enqueue([{ id: 'profile-new-1' }])
      // enrollment insert succeeds
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      // Verify automation_enrollments insert was called
      expect(mockFrom).toHaveBeenCalledWith('automation_enrollments')
    })

    it('skips already-enrolled members (23505 constraint)', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'signup' })])
      // evaluate: two qualifying members
      enqueue([{ id: 'profile-1' }, { id: 'profile-2' }])
      // enrollment insert for profile-1: UNIQUE violation
      enqueue(null, { code: '23505', message: 'unique_violation' })
      // enrollment insert for profile-2: success
      enqueue({ id: 'enroll-2' }, null)

      const result = await handler({ step })

      // Only profile-2 was enrolled (profile-1 was already enrolled)
      expect(result.enrollments_created).toBe(1)
    })

    it('dispatches automation/execute_flow events', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows
      enqueue([makeFlow({ trigger_type: 'signup' })])
      // evaluate: one qualifying member
      enqueue([{ id: 'profile-1' }])
      // enrollment insert succeeds
      enqueue({ id: 'enroll-1' }, null)

      await handler({ step })

      // inngest.send should have been called with automation/execute_flow events
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'automation/execute_flow',
            data: expect.objectContaining({
              enrollment_id: 'enroll-1',
              automation_id: FLOW_ID,
              studio_id: STUDIO_ID,
            }),
          }),
        ]),
      )
    })

    it('respects allow_reenrollment setting', async () => {
      const step = makeStepMock()

      // load-studios
      enqueue([{ id: STUDIO_ID }])
      // load-flows — allow_reenrollment = false
      enqueue([makeFlow({
        trigger_type: 'signup',
        allow_reenrollment: false,
        cooldown_days: null,
      })])
      // evaluate: one qualifying member
      enqueue([{ id: 'profile-1' }])
      // canEnrollMember returns false (already enrolled previously)
      mockCanEnrollMember.mockResolvedValueOnce(false)

      const result = await handler({ step })

      // Member was not enrolled because canEnrollMember returned false
      expect(result.enrollments_created).toBe(0)
      expect(mockCanEnrollMember).toHaveBeenCalledWith(
        expect.objectContaining({
          id: FLOW_ID,
          studio_id: STUDIO_ID,
          allow_reenrollment: false,
        }),
        'profile-1',
      )
    })
  })

  // -----------------------------------------------------------------------
  // Remaining existing triggers — verify they still work
  // -----------------------------------------------------------------------

  describe('churn_risk trigger', () => {
    it('finds at-risk or critical profiles', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'churn_risk' })])
      enqueue([{ id: 'profile-risk-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })
  })

  describe('credit_expiry trigger', () => {
    it('finds packs expiring within 7 days', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'credit_expiry' })])
      enqueue([{ member_id: 'profile-exp-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('credit_packs')
    })
  })

  describe('birthday trigger', () => {
    it('finds profiles with birthday matching today', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'birthday' })])
      enqueue([{ id: 'profile-bday-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })
  })

  describe('milestone trigger', () => {
    it('finds members with visits >= configured count', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'milestone', trigger_config: { count: 25 } })])
      enqueue([{ profile_id: 'profile-ms-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('members')
    })
  })

  describe('booking_completed trigger', () => {
    it('finds checked-in bookings in the last 10 minutes', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'booking_completed' })])
      enqueue([{ member_id: 'm-1', members: { profile_id: 'profile-bc-1' } }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
    })
  })

  describe('failed_payment trigger', () => {
    it('finds failed transactions in last 10 minutes', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'failed_payment' })])
      enqueue([{ member_id: 'profile-fp-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('transactions')
    })
  })

  describe('referral trigger', () => {
    it('finds recent referral records', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'referral' })])
      enqueue([{ referrer_id: 'profile-ref-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('referrals')
    })
  })

  describe('membership_change trigger', () => {
    it('finds recent membership status changes', async () => {
      const step = makeStepMock()

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'membership_change' })])
      enqueue([{ member_id: 'profile-mc-1' }])
      enqueue({ id: 'enroll-1' }, null)

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(1)
      expect(mockFrom).toHaveBeenCalledWith('membership_changes')
    })
  })

  describe('unknown trigger type', () => {
    it('returns empty array and logs warning', async () => {
      const step = makeStepMock()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      enqueue([{ id: STUDIO_ID }])
      enqueue([makeFlow({ trigger_type: 'does_not_exist' })])

      const result = await handler({ step })

      expect(result.enrollments_created).toBe(0)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown trigger type'),
      )
      consoleSpy.mockRestore()
    })
  })
})
