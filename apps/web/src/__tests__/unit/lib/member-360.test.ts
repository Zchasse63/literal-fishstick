import { describe, it, expect } from 'vitest'

// ─── member_360 view logic replicated in TypeScript ──────────
//
// The member_360 Postgres VIEW computes behavior_segment, engagement_status,
// and acquisition_channel via CASE expressions. Since we cannot query the
// view in unit tests, we replicate the CASE logic here and test it directly.
//
// Source of truth: Supabase migration that creates the member_360 view,
// cron-member-enrichment.ts (engagement status), and the type definitions
// in apps/web/src/app/(admin)/members/_components/types.ts.
// ─────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────
type EngagementStatus = 'subscriber' | 'active' | 'engaged' | 'cooling' | 'at_risk' | 'lapsed_with_credits' | 'lapsed' | 'churned' | 'new_unused' | 'lead_only'
type BehaviorSegment = 'power_user' | 'classpass_repeat' | 'new_never_booked' | 'one_and_done' | 'regular' | 'inactive' | 'never_booked'
type AcquisitionChannel = 'classpass' | 'website' | 'direct' | 'unknown'

// ─── Helper: Compute Behavior Segment ────────────────────────
// Replicates the SQL CASE expression from the member_360 view.
//
// Priority order (first match wins):
//   1. classpass_repeat: acquisition_source='classpass' AND total_visits >= 2
//   2. new_never_booked: total_visits = 0 AND joined within last 14 days
//   3. one_and_done:     total_visits = 1 AND last_visit > 7 days ago
//   4. power_user:       visits_last_30_days >= 8
//   5. regular:          visits_last_30_days between 4 and 7 (inclusive)
//   6. never_booked:     total_visits = 0 AND joined > 14 days ago
//   7. inactive:         has visits but none in last 30 days (visits_last_30_days = 0)
//   fallback: null (member has visits but doesn't match named segments)

interface BehaviorInput {
  acquisition_source: string | null
  total_visits: number
  last_visit: string | null  // ISO timestamp or null
  joined_at: string          // ISO timestamp
  visits_last_30_days: number
}

function computeBehaviorSegment(input: BehaviorInput): BehaviorSegment | null {
  const { acquisition_source, total_visits, last_visit, joined_at, visits_last_30_days } = input

  const now = Date.now()
  const daysSinceJoined = Math.floor((now - new Date(joined_at).getTime()) / (1000 * 60 * 60 * 24))
  const daysSinceLastVisit = last_visit
    ? Math.floor((now - new Date(last_visit).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // 1. ClassPass repeat
  if (acquisition_source === 'classpass' && total_visits >= 2) {
    return 'classpass_repeat'
  }

  // 2. New never booked
  if (total_visits === 0 && daysSinceJoined <= 14) {
    return 'new_never_booked'
  }

  // 3. One and done
  if (total_visits === 1 && daysSinceLastVisit !== null && daysSinceLastVisit > 7) {
    return 'one_and_done'
  }

  // 4. Power user
  if (visits_last_30_days >= 8) {
    return 'power_user'
  }

  // 5. Regular
  if (visits_last_30_days >= 4 && visits_last_30_days <= 7) {
    return 'regular'
  }

  // 6. Never booked (stale — joined > 14 days ago)
  if (total_visits === 0 && daysSinceJoined > 14) {
    return 'never_booked'
  }

  // 7. Inactive — has visited before but 0 visits in last 30 days
  if (total_visits > 0 && visits_last_30_days === 0) {
    return 'inactive'
  }

  return null
}

// ─── Helper: Compute Engagement Status (10-category) ─────────
// Replicates the SQL CASE and the cron-member-enrichment.ts logic.
// 10 statuses: subscriber, active, engaged, cooling, at_risk,
// lapsed_with_credits, lapsed, churned, new_unused, lead_only

interface EngagementInput {
  lastVisit: string | null
  creditBalance: number
  bookingCount: number
  membershipTier: string | null
  membershipStatus: string | null
}

function computeEngagementStatus(input: EngagementInput): EngagementStatus {
  const { lastVisit, creditBalance, bookingCount, membershipTier, membershipStatus } = input

  // 1. Active unlimited subscriber
  if (membershipTier === 'unlimited' && membershipStatus === 'active') return 'subscriber'

  if (lastVisit) {
    const daysSinceVisit = Math.floor(
      (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24),
    )

    // 2-3. Visited within 30 days
    if (daysSinceVisit <= 30) {
      return creditBalance > 0 ? 'active' : 'engaged'
    }
    // 4. Cooling: 31-60 days
    if (daysSinceVisit <= 60) return 'cooling'
    // 5. At risk: 61-90 days
    if (daysSinceVisit <= 90) return 'at_risk'
    // 6. Lapsed with credits: >90 days but has credits
    if (creditBalance > 0) return 'lapsed_with_credits'
    // 7. Churned: >365 days, no credits
    if (daysSinceVisit > 365) return 'churned'
    // 8. Lapsed: >90 days, no credits
    return 'lapsed'
  }

  // 9. Never visited but has credits or bookings
  if (creditBalance > 0 || bookingCount > 0) return 'new_unused'

  // 10. Profile only
  return 'lead_only'
}

// ─── Helper: Derive Acquisition Channel ──────────────────────
// Replicates the SQL CASE for acquisition_channel in the member_360 view.
//
// ClassPass detection: lead_source = 'U' AND phone = '+10000000000'
// Website:             lead_source = 'W'
// Direct:              lead_source = 'D'
// Otherwise:           'unknown'

interface AcquisitionInput {
  lead_source: string | null
  phone: string | null
}

function deriveAcquisitionChannel(input: AcquisitionInput): AcquisitionChannel {
  const { lead_source, phone } = input

  if (lead_source === 'U' && phone === '+10000000000') return 'classpass'
  if (lead_source === 'W') return 'website'
  if (lead_source === 'D') return 'direct'
  return 'unknown'
}

// ─── Date helpers for tests ──────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

// ═════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════

describe('member_360 behavior segment logic', () => {
  // ── behavior_segment computation ─────────────────────────

  it('classpass_repeat: classpass user with 2+ visits', () => {
    const result = computeBehaviorSegment({
      acquisition_source: 'classpass',
      total_visits: 3,
      last_visit: daysAgo(2),
      joined_at: daysAgo(30),
      visits_last_30_days: 3,
    })
    expect(result).toBe('classpass_repeat')
  })

  it('classpass_repeat: classpass user with exactly 2 visits', () => {
    const result = computeBehaviorSegment({
      acquisition_source: 'classpass',
      total_visits: 2,
      last_visit: daysAgo(5),
      joined_at: daysAgo(20),
      visits_last_30_days: 2,
    })
    expect(result).toBe('classpass_repeat')
  })

  it('classpass user with only 1 visit is NOT classpass_repeat', () => {
    const result = computeBehaviorSegment({
      acquisition_source: 'classpass',
      total_visits: 1,
      last_visit: daysAgo(10),
      joined_at: daysAgo(15),
      visits_last_30_days: 0,
    })
    // Falls through to one_and_done or inactive depending on days
    expect(result).not.toBe('classpass_repeat')
  })

  it('new_never_booked: 0 visits, joined within 14 days', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 0,
      last_visit: null,
      joined_at: daysAgo(5),
      visits_last_30_days: 0,
    })
    expect(result).toBe('new_never_booked')
  })

  it('new_never_booked: joined exactly today', () => {
    const result = computeBehaviorSegment({
      acquisition_source: 'website',
      total_visits: 0,
      last_visit: null,
      joined_at: new Date().toISOString(),
      visits_last_30_days: 0,
    })
    expect(result).toBe('new_never_booked')
  })

  it('one_and_done: 1 visit, last visit >7 days ago', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 1,
      last_visit: daysAgo(10),
      joined_at: daysAgo(30),
      visits_last_30_days: 0,
    })
    expect(result).toBe('one_and_done')
  })

  it('1 visit within 7 days is NOT one_and_done', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 1,
      last_visit: daysAgo(3),
      joined_at: daysAgo(10),
      visits_last_30_days: 1,
    })
    // Not one_and_done since visit was recent; falls through
    expect(result).not.toBe('one_and_done')
  })

  it('power_user: 8+ visits in last 30 days', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 20,
      last_visit: daysAgo(1),
      joined_at: daysAgo(60),
      visits_last_30_days: 10,
    })
    expect(result).toBe('power_user')
  })

  it('power_user: exactly 8 visits in last 30 days', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 15,
      last_visit: daysAgo(2),
      joined_at: daysAgo(90),
      visits_last_30_days: 8,
    })
    expect(result).toBe('power_user')
  })

  it('regular: 4-7 visits in last 30 days', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 12,
      last_visit: daysAgo(3),
      joined_at: daysAgo(60),
      visits_last_30_days: 5,
    })
    expect(result).toBe('regular')
  })

  it('regular: exactly 4 visits in last 30 days', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 10,
      last_visit: daysAgo(5),
      joined_at: daysAgo(45),
      visits_last_30_days: 4,
    })
    expect(result).toBe('regular')
  })

  it('regular: exactly 7 visits in last 30 days', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 14,
      last_visit: daysAgo(1),
      joined_at: daysAgo(60),
      visits_last_30_days: 7,
    })
    expect(result).toBe('regular')
  })

  it('never_booked: 0 visits, joined >14 days ago', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 0,
      last_visit: null,
      joined_at: daysAgo(30),
      visits_last_30_days: 0,
    })
    expect(result).toBe('never_booked')
  })

  it('inactive: has visits but none in last 30 days', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 5,
      last_visit: daysAgo(45),
      joined_at: daysAgo(120),
      visits_last_30_days: 0,
    })
    expect(result).toBe('inactive')
  })

  // ── Priority / edge cases ───────────────────────────────

  it('classpass_repeat takes priority over power_user', () => {
    // A classpass user who is also a power user should be tagged classpass_repeat first
    const result = computeBehaviorSegment({
      acquisition_source: 'classpass',
      total_visits: 12,
      last_visit: daysAgo(1),
      joined_at: daysAgo(30),
      visits_last_30_days: 10,
    })
    expect(result).toBe('classpass_repeat')
  })

  it('new_never_booked takes priority over never_booked for fresh signups', () => {
    // Joined 10 days ago, 0 visits — should be new_never_booked, not never_booked
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 0,
      last_visit: null,
      joined_at: daysAgo(10),
      visits_last_30_days: 0,
    })
    expect(result).toBe('new_never_booked')
  })

  it('boundary: joined exactly 14 days ago is still new_never_booked', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 0,
      last_visit: null,
      joined_at: daysAgo(14),
      visits_last_30_days: 0,
    })
    expect(result).toBe('new_never_booked')
  })

  it('boundary: joined 15 days ago is never_booked', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 0,
      last_visit: null,
      joined_at: daysAgo(15),
      visits_last_30_days: 0,
    })
    expect(result).toBe('never_booked')
  })

  it('returns null for member with 2 visits in last 30 days (no named segment)', () => {
    const result = computeBehaviorSegment({
      acquisition_source: null,
      total_visits: 3,
      last_visit: daysAgo(4),
      joined_at: daysAgo(45),
      visits_last_30_days: 2,
    })
    // 2 visits doesn't match any threshold — falls through to null
    expect(result).toBeNull()
  })
})

// ─── Engagement Status (10-category) ──────────────────────

// Helper to build engagement input with defaults
function engInput(overrides: Partial<EngagementInput> = {}): EngagementInput {
  return {
    lastVisit: null,
    creditBalance: 0,
    bookingCount: 0,
    membershipTier: null,
    membershipStatus: null,
    ...overrides,
  }
}

describe('member_360 engagement status logic (10-category)', () => {
  // ── subscriber ──
  it('subscriber: unlimited membership with active status', () => {
    expect(computeEngagementStatus(engInput({
      membershipTier: 'unlimited',
      membershipStatus: 'active',
      lastVisit: daysAgo(5),
    }))).toBe('subscriber')
  })

  it('subscriber takes priority even with old last visit', () => {
    expect(computeEngagementStatus(engInput({
      membershipTier: 'unlimited',
      membershipStatus: 'active',
      lastVisit: daysAgo(100),
    }))).toBe('subscriber')
  })

  it('non-active unlimited is NOT subscriber', () => {
    expect(computeEngagementStatus(engInput({
      membershipTier: 'unlimited',
      membershipStatus: 'paused',
      lastVisit: daysAgo(5),
    }))).not.toBe('subscriber')
  })

  // ── active (has credits, visited within 30 days) ──
  it('active: has credits and visited within 30 days', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(5),
      creditBalance: 3,
    }))).toBe('active')
  })

  it('active: has credits and visited exactly 30 days ago', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(30),
      creditBalance: 1,
    }))).toBe('active')
  })

  // ── engaged (no credits, visited within 30 days) ──
  it('engaged: no credits but visited recently', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(3),
      creditBalance: 0,
    }))).toBe('engaged')
  })

  it('engaged: visited today, no credits', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(0),
      creditBalance: 0,
    }))).toBe('engaged')
  })

  // ── cooling (31-60 days) ──
  it('cooling: last visit 31-60 days ago', () => {
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(35) }))).toBe('cooling')
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(60) }))).toBe('cooling')
  })

  it('boundary: 30 days is active/engaged, 31 is cooling', () => {
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(30), creditBalance: 1 }))).toBe('active')
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(31) }))).toBe('cooling')
  })

  // ── at_risk (61-90 days) ──
  it('at_risk: last visit 61-90 days ago', () => {
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(65) }))).toBe('at_risk')
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(90) }))).toBe('at_risk')
  })

  it('boundary: 60 days is cooling, 61 is at_risk', () => {
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(60) }))).toBe('cooling')
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(61) }))).toBe('at_risk')
  })

  // ── lapsed_with_credits (>90 days, has credits) ──
  it('lapsed_with_credits: >90 days absent but has credits', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(120),
      creditBalance: 5,
    }))).toBe('lapsed_with_credits')
  })

  // ── churned (>365 days, no credits) ──
  it('churned: >365 days, no credits', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(400),
      creditBalance: 0,
    }))).toBe('churned')
  })

  it('boundary: 365 days with no credits is lapsed, 366 is churned', () => {
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(365) }))).toBe('lapsed')
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(366) }))).toBe('churned')
  })

  // ── lapsed (>90 days, no credits, <=365 days) ──
  it('lapsed: >90 days, no credits', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(100),
      creditBalance: 0,
    }))).toBe('lapsed')
    expect(computeEngagementStatus(engInput({
      lastVisit: daysAgo(200),
      creditBalance: 0,
    }))).toBe('lapsed')
  })

  it('boundary: 90 days is at_risk, 91 is lapsed (no credits)', () => {
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(90) }))).toBe('at_risk')
    expect(computeEngagementStatus(engInput({ lastVisit: daysAgo(91) }))).toBe('lapsed')
  })

  // ── new_unused (never visited, has credits or bookings) ──
  it('new_unused: never visited but has credits', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: null,
      creditBalance: 5,
    }))).toBe('new_unused')
  })

  it('new_unused: never visited but has bookings', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: null,
      bookingCount: 1,
    }))).toBe('new_unused')
  })

  // ── lead_only (profile only, no purchases, no visits) ──
  it('lead_only: no visits, no credits, no bookings', () => {
    expect(computeEngagementStatus(engInput({
      lastVisit: null,
      creditBalance: 0,
      bookingCount: 0,
    }))).toBe('lead_only')
  })

  it('lead_only: completely empty profile', () => {
    expect(computeEngagementStatus(engInput())).toBe('lead_only')
  })
})

// ─── Acquisition Channel ───────────────────────────────────

describe('member_360 acquisition channel derivation', () => {
  it('classpass: lead_source U + phone +10000000000', () => {
    expect(deriveAcquisitionChannel({ lead_source: 'U', phone: '+10000000000' })).toBe('classpass')
  })

  it('NOT classpass when lead_source U but different phone', () => {
    expect(deriveAcquisitionChannel({ lead_source: 'U', phone: '+18135551234' })).toBe('unknown')
  })

  it('NOT classpass when lead_source U but null phone', () => {
    expect(deriveAcquisitionChannel({ lead_source: 'U', phone: null })).toBe('unknown')
  })

  it('website: lead_source W', () => {
    expect(deriveAcquisitionChannel({ lead_source: 'W', phone: null })).toBe('website')
    expect(deriveAcquisitionChannel({ lead_source: 'W', phone: '+18135551234' })).toBe('website')
  })

  it('direct: lead_source D', () => {
    expect(deriveAcquisitionChannel({ lead_source: 'D', phone: null })).toBe('direct')
    expect(deriveAcquisitionChannel({ lead_source: 'D', phone: '+18135551234' })).toBe('direct')
  })

  it('returns unknown for null lead_source', () => {
    expect(deriveAcquisitionChannel({ lead_source: null, phone: null })).toBe('unknown')
    expect(deriveAcquisitionChannel({ lead_source: null, phone: '+18135551234' })).toBe('unknown')
  })

  it('returns unknown for unrecognized lead_source', () => {
    expect(deriveAcquisitionChannel({ lead_source: 'X', phone: null })).toBe('unknown')
    expect(deriveAcquisitionChannel({ lead_source: 'A', phone: null })).toBe('unknown')
  })

  it('classpass detection requires both lead_source=U AND phone=+10000000000', () => {
    // lead_source D + classpass phone should still be direct, not classpass
    expect(deriveAcquisitionChannel({ lead_source: 'D', phone: '+10000000000' })).toBe('direct')
  })
})
