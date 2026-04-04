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
type EngagementStatus = 'engaged' | 'active' | 'cooling' | 'at_risk' | 'lapsed' | 'never_visited'
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

// ─── Helper: Compute Engagement Status ───────────────────────
// Replicates the SQL CASE and the cron-member-enrichment.ts logic.
// Thresholds (days since last visit):
//   engaged:       0–7
//   active:        8–21
//   cooling:       22–45
//   at_risk:       46–90
//   lapsed:        >90
//   never_visited: null last_visit

function computeEngagementStatus(lastVisit: string | null): EngagementStatus {
  if (!lastVisit) return 'never_visited'

  const daysSinceVisit = Math.floor(
    (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysSinceVisit <= 7) return 'engaged'
  if (daysSinceVisit <= 21) return 'active'
  if (daysSinceVisit <= 45) return 'cooling'
  if (daysSinceVisit <= 90) return 'at_risk'
  return 'lapsed'
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

// ─── Engagement Status ─────────────────────────────────────

describe('member_360 engagement status logic', () => {
  it('engaged: last visit within 7 days', () => {
    expect(computeEngagementStatus(daysAgo(0))).toBe('engaged')
    expect(computeEngagementStatus(daysAgo(3))).toBe('engaged')
    expect(computeEngagementStatus(daysAgo(7))).toBe('engaged')
  })

  it('active: last visit 8-21 days ago', () => {
    expect(computeEngagementStatus(daysAgo(8))).toBe('active')
    expect(computeEngagementStatus(daysAgo(14))).toBe('active')
    expect(computeEngagementStatus(daysAgo(21))).toBe('active')
  })

  it('cooling: last visit 22-45 days ago', () => {
    expect(computeEngagementStatus(daysAgo(22))).toBe('cooling')
    expect(computeEngagementStatus(daysAgo(30))).toBe('cooling')
    expect(computeEngagementStatus(daysAgo(45))).toBe('cooling')
  })

  it('at_risk: last visit 46-90 days ago', () => {
    expect(computeEngagementStatus(daysAgo(46))).toBe('at_risk')
    expect(computeEngagementStatus(daysAgo(60))).toBe('at_risk')
    expect(computeEngagementStatus(daysAgo(90))).toBe('at_risk')
  })

  it('lapsed: last visit >90 days ago', () => {
    expect(computeEngagementStatus(daysAgo(91))).toBe('lapsed')
    expect(computeEngagementStatus(daysAgo(180))).toBe('lapsed')
    expect(computeEngagementStatus(daysAgo(365))).toBe('lapsed')
  })

  it('never_visited: null last_visit', () => {
    expect(computeEngagementStatus(null)).toBe('never_visited')
  })

  // Boundary tests
  it('boundary: 7 days is engaged, 8 days is active', () => {
    expect(computeEngagementStatus(daysAgo(7))).toBe('engaged')
    expect(computeEngagementStatus(daysAgo(8))).toBe('active')
  })

  it('boundary: 21 days is active, 22 days is cooling', () => {
    expect(computeEngagementStatus(daysAgo(21))).toBe('active')
    expect(computeEngagementStatus(daysAgo(22))).toBe('cooling')
  })

  it('boundary: 45 days is cooling, 46 days is at_risk', () => {
    expect(computeEngagementStatus(daysAgo(45))).toBe('cooling')
    expect(computeEngagementStatus(daysAgo(46))).toBe('at_risk')
  })

  it('boundary: 90 days is at_risk, 91 days is lapsed', () => {
    expect(computeEngagementStatus(daysAgo(90))).toBe('at_risk')
    expect(computeEngagementStatus(daysAgo(91))).toBe('lapsed')
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
