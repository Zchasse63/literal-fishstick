import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────
// Mock setup
//
// Strategy: mock `@supabase/supabase-js` (for getAdminClient) and `inngest`
// (to capture the handler passed to createFunction). The handler is then
// invoked with a fake `step` object whose `.run()` executes synchronously.
//
// Uses a FIFO response queue (same pattern as helpers.test.ts) because the
// cron-member-enrichment function issues multiple sequential queries.
// ─────────────────────────────────────────────────────────────

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

// ─── Capture the Inngest handler ───────────────────────────────
// We intercept inngest.createFunction to grab the handler (the async
// function that receives { step }). We then invoke it directly in tests.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedHandler: ((ctx: { step: any }) => Promise<any>) | null = null

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, handler: unknown) => {
      capturedHandler = handler as typeof capturedHandler
      return { _handler: handler }
    }),
    send: vi.fn(),
  },
}))

// Import AFTER mocks are established — this triggers createFunction
// and stores the handler in `capturedHandler`.
await import('@/lib/inngest/functions/cron-member-enrichment')

// ─── Step mock ─────────────────────────────────────────────────
const stepNames: string[] = []

const mockStep = {
  run: vi.fn(async (name: string, fn: () => Promise<unknown>) => {
    stepNames.push(name)
    return fn()
  }),
}

// ─── Helper: invoke the captured handler ───────────────────────
async function runFunction() {
  if (!capturedHandler) throw new Error('Handler was not captured — mock setup failed')
  return capturedHandler({ step: mockStep })
}

// ─── Reset between tests ──────────────────────────────────────

beforeEach(() => {
  responseQueue.length = 0
  stepNames.length = 0
  mockFrom.mockClear()
  mockStep.run.mockClear()
  for (const m of Object.keys(mockChain)) {
    if (typeof mockChain[m] === 'function' && 'mockClear' in (mockChain[m] as object)) {
      (mockChain[m] as ReturnType<typeof vi.fn>).mockClear()
    }
  }
})

// =========================================================================
// Tests
// =========================================================================

describe('cron-member-enrichment', () => {
  it('handler was captured from inngest.createFunction', () => {
    expect(capturedHandler).toBeTypeOf('function')
  })

  // ── reconcile-visit-stats ─────────────────────────────────

  describe('reconcile-visit-stats', () => {
    it('updates total_visits from booking counts', async () => {
      // bookings aggregate (attended=true rows)
      enqueue([
        { member_id: 'member-1' },
        { member_id: 'member-1' },
        { member_id: 'member-1' },
        { member_id: 'member-2' },
      ])
      // last visits (ordered by checked_in_at desc)
      enqueue([
        { member_id: 'member-1', checked_in_at: '2026-03-30T10:00:00Z' },
        { member_id: 'member-2', checked_in_at: '2026-03-28T10:00:00Z' },
      ])
      // all members for comparison — member-1 has drifted total_visits
      enqueue([
        { id: 'member-1', total_visits: 1, last_visit: null },
        { id: 'member-2', total_visits: 1, last_visit: '2026-03-28T10:00:00Z' },
      ])
      // update for member-1 (visits drifted: 1 -> 3, last_visit drifted: null -> date)
      enqueue(null)

      // Remaining steps return empty
      enqueue([]) // engagement members
      enqueue([]) // classpass profiles
      enqueue([]) // tier members with plan_code

      const result = await runFunction()

      expect(result.visit_reconciliation.updated).toBeGreaterThanOrEqual(1)
      expect(result.visit_reconciliation.checked).toBe(2)
    })

    it('updates last_visit from latest class date', async () => {
      // bookings aggregate — 2 attended for member-1
      enqueue([
        { member_id: 'member-1' },
        { member_id: 'member-1' },
      ])
      // last visits
      enqueue([
        { member_id: 'member-1', checked_in_at: '2026-04-01T14:00:00Z' },
      ])
      // members — visits count matches but last_visit is stale
      enqueue([
        { id: 'member-1', total_visits: 2, last_visit: '2026-03-01T10:00:00Z' },
      ])
      // update for member-1 (last_visit drifted)
      enqueue(null)

      // Remaining steps
      enqueue([])
      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.visit_reconciliation.updated).toBe(1)
    })

    it('skips members where stats already match', async () => {
      // bookings aggregate
      enqueue([
        { member_id: 'member-1' },
        { member_id: 'member-1' },
      ])
      // last visits
      enqueue([
        { member_id: 'member-1', checked_in_at: '2026-03-30T10:00:00Z' },
      ])
      // members — already correct
      enqueue([
        { id: 'member-1', total_visits: 2, last_visit: '2026-03-30T10:00:00Z' },
      ])

      // Remaining steps
      enqueue([])
      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.visit_reconciliation.updated).toBe(0)
      expect(result.visit_reconciliation.checked).toBe(1)
    })

    it('handles members with zero bookings', async () => {
      // bookings aggregate — empty
      enqueue([])
      // last visits — empty
      enqueue([])
      // members — member has stale total_visits
      enqueue([
        { id: 'member-1', total_visits: 3, last_visit: '2026-02-01T10:00:00Z' },
      ])
      // update for member-1 (visits should become 0)
      enqueue(null)

      // Remaining steps
      enqueue([])
      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.visit_reconciliation.updated).toBe(1)
    })

    it('handles booking aggregate query error gracefully', async () => {
      // bookings aggregate returns error
      enqueue(null, { message: 'connection timeout' })

      // Remaining steps
      enqueue([])
      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.visit_reconciliation.updated).toBe(0)
      expect(result.visit_reconciliation.error).toBeDefined()
    })
  })

  // ── recompute-engagement-status ───────────────────────────

  describe('recompute-engagement-status', () => {
    // Helper to skip visit reconciliation with empty data
    function skipVisitReconciliation() {
      enqueue([]) // bookings aggregate
      enqueue([]) // last visits
      enqueue([]) // all members
    }

    it('sets engaged for visit within 30 days, no credits', async () => {
      skipVisitReconciliation()

      const recentVisit = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      enqueue([
        { id: 'member-1', last_visit: recentVisit, engagement_status: 'cooling', credit_balance: 0, total_visits: 5, membership_tier: null, membership_status: null },
      ])
      enqueue(null) // update

      enqueue([]) // classpass
      enqueue([]) // tier

      const result = await runFunction()

      expect(result.engagement_reconciliation.updated).toBe(1)
    })

    it('sets lapsed for visit >90 days ago, no credits', async () => {
      skipVisitReconciliation()

      const oldVisit = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
      enqueue([
        { id: 'member-1', last_visit: oldVisit, engagement_status: 'active', credit_balance: 0, total_visits: 5, membership_tier: null, membership_status: null },
      ])
      enqueue(null) // update

      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.engagement_reconciliation.updated).toBe(1)
    })

    it('sets lead_only for null last_visit, no credits or bookings', async () => {
      skipVisitReconciliation()

      enqueue([
        { id: 'member-1', last_visit: null, engagement_status: 'active', credit_balance: 0, total_visits: 0, membership_tier: null, membership_status: null },
      ])
      enqueue(null) // update

      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.engagement_reconciliation.updated).toBe(1)
    })

    it('skips members whose engagement_status is already correct', async () => {
      skipVisitReconciliation()

      const recentVisit = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      enqueue([
        { id: 'member-1', last_visit: recentVisit, engagement_status: 'engaged', credit_balance: 0, total_visits: 5, membership_tier: null, membership_status: null },
      ])

      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.engagement_reconciliation.updated).toBe(0)
    })

    it('handles empty members list', async () => {
      skipVisitReconciliation()

      enqueue(null) // null members

      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.engagement_reconciliation.updated).toBe(0)
    })

    it('correctly classifies at_risk (46-90 days)', async () => {
      skipVisitReconciliation()

      const atRiskVisit = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      enqueue([
        { id: 'member-1', last_visit: atRiskVisit, engagement_status: 'cooling' },
      ])
      enqueue(null) // update

      enqueue([])
      enqueue([])

      const result = await runFunction()

      expect(result.engagement_reconciliation.updated).toBe(1)
    })
  })

  // ── tag-classpass-members ─────────────────────────────────

  describe('tag-classpass-members', () => {
    function skipPriorSteps() {
      enqueue([]) // bookings aggregate
      enqueue([]) // last visits
      enqueue([]) // members for visit reconciliation
      enqueue([]) // members for engagement
    }

    it('tags profiles with lead_source=U and phone=+10000000000', async () => {
      skipPriorSteps()

      // ClassPass profiles matching the filter
      enqueue([
        { id: 'profile-1' },
        { id: 'profile-2' },
      ])
      // Members linked to those profiles — not yet tagged
      enqueue([
        { id: 'member-1', profile_id: 'profile-1', acquisition_source: null },
        { id: 'member-2', profile_id: 'profile-2', acquisition_source: null },
      ])
      // Updates
      enqueue(null) // member-1
      enqueue(null) // member-2

      enqueue([]) // tier

      const result = await runFunction()

      expect(result.classpass_tagging.tagged).toBe(2)
    })

    it('does not tag profiles with lead_source=U but different phone', async () => {
      // The query itself filters by lead_source=U AND phone=+10000000000,
      // so if the phone doesn't match, no profiles are returned.
      skipPriorSteps()

      enqueue([]) // no matching classpass profiles

      enqueue([]) // tier

      const result = await runFunction()

      expect(result.classpass_tagging.tagged).toBe(0)
    })

    it('skips profiles already tagged', async () => {
      skipPriorSteps()

      enqueue([{ id: 'profile-1' }])
      // Member already tagged as classpass
      enqueue([
        { id: 'member-1', profile_id: 'profile-1', acquisition_source: 'classpass' },
      ])

      enqueue([]) // tier

      const result = await runFunction()

      expect(result.classpass_tagging.tagged).toBe(0)
    })

    it('only tags members that are not yet tagged', async () => {
      skipPriorSteps()

      enqueue([{ id: 'profile-1' }, { id: 'profile-2' }])
      enqueue([
        { id: 'member-1', profile_id: 'profile-1', acquisition_source: 'classpass' }, // skip
        { id: 'member-2', profile_id: 'profile-2', acquisition_source: null },         // tag
      ])
      enqueue(null) // update for member-2

      enqueue([]) // tier

      const result = await runFunction()

      expect(result.classpass_tagging.tagged).toBe(1)
    })

    it('handles null classpass profiles response', async () => {
      skipPriorSteps()

      enqueue(null) // null response

      enqueue([]) // tier

      const result = await runFunction()

      expect(result.classpass_tagging.tagged).toBe(0)
    })
  })

  // ── resolve-membership-tiers ──────────────────────────────

  describe('resolve-membership-tiers', () => {
    function skipPriorSteps() {
      enqueue([]) // bookings
      enqueue([]) // last visits
      enqueue([]) // visit reconciliation members
      enqueue([]) // engagement members
      enqueue([]) // classpass profiles
    }

    it('resolves plan_code to tier via membership_plans table', async () => {
      skipPriorSteps()

      // Members with plan_code but no tier
      enqueue([
        { id: 'member-1', plan_code: 'plan-abc', membership_tier: null },
      ])
      // membership_plans lookup
      enqueue([
        { glofox_id: 'plan-abc', tier: 'unlimited', name: 'Unlimited Monthly' },
      ])
      // Update
      enqueue(null)

      const result = await runFunction()

      expect(result.tier_resolution.resolved).toBe(1)
    })

    it('infers tier from plan name when tier column is null', async () => {
      skipPriorSteps()

      enqueue([
        { id: 'member-1', plan_code: 'plan-xyz', membership_tier: null },
      ])
      // Plan map has null tier but name contains '10'
      enqueue([
        { glofox_id: 'plan-xyz', tier: null, name: '10 Class Pack' },
      ])
      enqueue(null) // update

      const result = await runFunction()

      expect(result.tier_resolution.resolved).toBe(1)
    })

    it('infers tier from plan_code string when no plan map match', async () => {
      skipPriorSteps()

      enqueue([
        { id: 'member-1', plan_code: 'unlimited-monthly', membership_tier: null },
      ])
      // No matching plan map entries
      enqueue([])
      // Update — inferTierFromPlanCode('unlimited-monthly') returns 'unlimited'
      enqueue(null)

      const result = await runFunction()

      expect(result.tier_resolution.resolved).toBe(1)
    })

    it('resolves 6_class tier from plan name containing "6"', async () => {
      skipPriorSteps()

      enqueue([
        { id: 'member-1', plan_code: 'plan-6class', membership_tier: null },
      ])
      enqueue([
        { glofox_id: 'plan-6class', tier: null, name: '6 Class Monthly' },
      ])
      enqueue(null)

      const result = await runFunction()

      expect(result.tier_resolution.resolved).toBe(1)
    })

    it('skips members with existing tier', async () => {
      // The query filters where membership_tier IS NULL, so members
      // with existing tiers are never returned.
      skipPriorSteps()

      enqueue([]) // no matching members

      const result = await runFunction()

      expect(result.tier_resolution.resolved).toBe(0)
    })

    it('skips members whose plan_code cannot be resolved', async () => {
      skipPriorSteps()

      enqueue([
        { id: 'member-1', plan_code: 'mystery-plan', membership_tier: null },
      ])
      // No matching plan map entries
      enqueue([])
      // inferTierFromPlanCode('mystery-plan') returns null — no update

      const result = await runFunction()

      expect(result.tier_resolution.resolved).toBe(0)
    })

    it('handles empty members list', async () => {
      skipPriorSteps()

      enqueue(null) // null members response

      const result = await runFunction()

      expect(result.tier_resolution.resolved).toBe(0)
    })
  })

  // ── Full function integration ─────────────────────────────

  describe('full function', () => {
    it('returns status completed with all step results', async () => {
      // All steps receive empty data
      enqueue([]) // bookings
      enqueue([]) // last visits
      enqueue([]) // members (visit reconciliation)
      enqueue([]) // members (engagement)
      enqueue([]) // profiles (classpass)
      enqueue([]) // members (tier)

      const result = await runFunction()

      expect(result.status).toBe('completed')
      expect(result).toHaveProperty('visit_reconciliation')
      expect(result).toHaveProperty('engagement_reconciliation')
      expect(result).toHaveProperty('classpass_tagging')
      expect(result).toHaveProperty('tier_resolution')
    })

    it('all four steps are invoked via step.run', async () => {
      enqueue([])
      enqueue([])
      enqueue([])
      enqueue([])
      enqueue([])
      enqueue([])

      await runFunction()

      expect(mockStep.run).toHaveBeenCalledTimes(4)
      expect(stepNames).toEqual([
        'reconcile-visit-stats',
        'recompute-engagement-status',
        'tag-classpass-members',
        'resolve-membership-tiers',
      ])
    })
  })
})
