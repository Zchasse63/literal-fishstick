/**
 * AI Endpoint Integration Tests — Live Anthropic API.
 * NO MOCKS — every call hits the real Claude API and costs real money (~$0.01-0.05 per call).
 *
 * AI outputs are non-deterministic, so we test STRUCTURE and TYPE, not exact content.
 */
import { describe, it, expect } from 'vitest'
import {
  generateBriefing,
  generateRecommendations,
  type BriefingContext,
  type RecommendationContext,
} from '@/lib/anthropic'

// Realistic metrics context for testing
const REALISTIC_BRIEFING_CONTEXT: BriefingContext = {
  today_classes: 8,
  today_bookings: 47,
  total_capacity: 96,
  checkins_today: 23,
  revenue_today: 1250,
  revenue_mtd: 18400,
  active_members: 142,
  at_risk_members: 7,
  new_members_this_week: 4,
  expiring_credits_7d: 3,
  waitlisted_today: 5,
  top_class_today: 'Guided Breathwork with Whitney',
}

describe('AI Endpoints - Live Anthropic API', () => {
  // ── 1. generateBriefing returns a non-empty string ────────────────
  it('generateBriefing returns a non-empty string', async () => {
    const result = await generateBriefing(REALISTIC_BRIEFING_CONTEXT)

    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(50)
  })

  // ── 2. generateBriefing includes relevant content ─────────────────
  it('generateBriefing includes relevant content from metrics', async () => {
    const result = await generateBriefing(REALISTIC_BRIEFING_CONTEXT)

    // The briefing should reference something from the data we provided.
    // Check for at least one of these indicators.
    const containsRelevantContent =
      result.includes('class') ||
      result.includes('Class') ||
      result.includes('member') ||
      result.includes('Member') ||
      result.includes('revenue') ||
      result.includes('Revenue') ||
      result.includes('booking') ||
      result.includes('Booking') ||
      result.includes('check') ||
      result.includes('capacity') ||
      /\d+/.test(result) // Contains at least one number

    expect(containsRelevantContent).toBe(true)
  })

  // ── 3. generateRecommendations returns structured output (scheduling) ──
  it('generateRecommendations returns an array for scheduling type', async () => {
    const context: RecommendationContext = {
      type: 'scheduling',
      metrics: {
        total_classes_this_week: 40,
        avg_capacity_utilization: 0.62,
        peak_hour: '6pm',
        lowest_utilization_class: 'Early Bird Sauna 6am',
        waitlist_rate: 0.08,
      },
    }

    const result = await generateRecommendations(context)

    expect(result).toBeTruthy()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)
    // Each recommendation should be a non-empty string
    for (const rec of result) {
      expect(typeof rec).toBe('string')
      expect(rec.length).toBeGreaterThan(10)
    }
  })

  // ── 4. generateRecommendations for pricing ────────────────────────
  it('generateRecommendations returns recommendations for pricing type', async () => {
    const context: RecommendationContext = {
      type: 'pricing',
      metrics: {
        mrr: 14200,
        arpm: 99.5,
        churn_rate: 0.045,
        unlimited_members: 85,
        credit_pack_members: 42,
        drop_in_revenue_pct: 0.12,
        avg_credit_pack_usage: 0.73,
      },
    }

    const result = await generateRecommendations(context)

    expect(result).toBeTruthy()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)
    for (const rec of result) {
      expect(typeof rec).toBe('string')
      expect(rec.trim().length).toBeGreaterThan(0)
    }
  })

  // ── 5. generateRecommendations for retention ──────────────────────
  it('generateRecommendations returns recommendations for retention type', async () => {
    const context: RecommendationContext = {
      type: 'retention',
      metrics: {
        active_members: 142,
        at_risk_members: 7,
        churned_last_30d: 4,
        avg_visits_per_week: 2.1,
        first_month_retention: 0.82,
        members_no_visit_14d: 12,
        credit_packs_expiring_7d: 3,
      },
    }

    const result = await generateRecommendations(context)

    expect(result).toBeTruthy()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)
    for (const rec of result) {
      expect(typeof rec).toBe('string')
      expect(rec.trim().length).toBeGreaterThan(0)
    }
  })

  // ── 6. AI handles empty/minimal context gracefully ────────────────
  it('generateBriefing handles minimal context without throwing', async () => {
    const minimalContext: BriefingContext = {
      today_classes: 0,
      today_bookings: 0,
      total_capacity: 0,
      checkins_today: 0,
      revenue_today: 0,
      revenue_mtd: 0,
      active_members: 0,
      at_risk_members: 0,
      new_members_this_week: 0,
      expiring_credits_7d: 0,
      waitlisted_today: 0,
    }

    // Should not throw — either returns AI response or falls back to rules-based
    const result = await generateBriefing(minimalContext)

    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('generateRecommendations handles empty metrics without throwing', async () => {
    const context: RecommendationContext = {
      type: 'general',
      metrics: {},
    }

    const result = await generateRecommendations(context)

    expect(result).toBeTruthy()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})
