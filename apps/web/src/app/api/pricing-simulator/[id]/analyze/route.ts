import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  analyzePricingScenario,
  PlanSnapshot,
  PriceChange,
  RevenueMonth,
} from '@/lib/ai/pricing-analyzer'

const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * POST /api/pricing-simulator/[id]/analyze
 *
 * Run AI analysis on a pricing simulation.
 * Gathers current membership data, 12-month revenue history, and calls
 * the pricing analyzer AI to generate projections and narrative.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Fetch Simulation ────────────────────────────────────
    const { data: simulation, error: simError } = await supabase
      .from('pricing_simulations')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (simError || !simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    // ─── Gather Current Plan Data ────────────────────────────
    const { data: plans, error: plansError } = await supabase
      .from('membership_plans')
      .select('id, name, price, billing_interval')
      .eq('studio_id', studioId)
      .eq('is_active', true)

    if (plansError) {
      return NextResponse.json({ error: 'Failed to fetch membership plans' }, { status: 500 })
    }

    // Count active subscribers per plan
    const planSnapshots: PlanSnapshot[] = []
    for (const plan of plans ?? []) {
      const { count } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studioId)
        .eq('membership_plan_id', plan.id)
        .eq('membership_status', 'active')

      const subscriberCount = count ?? 0
      const mrrContribution = subscriberCount * (plan.price ?? 0)

      planSnapshots.push({
        plan_id: plan.id,
        plan_name: plan.name,
        current_price: plan.price ?? 0,
        subscriber_count: subscriberCount,
        mrr_contribution: mrrContribution,
      })
    }

    // ─── Gather 12-Month Revenue History ─────────────────────
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('amount, type, created_at')
      .eq('studio_id', studioId)
      .eq('status', 'completed')
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: true })

    if (txError) {
      return NextResponse.json({ error: 'Failed to fetch revenue history' }, { status: 500 })
    }

    // Aggregate transactions by month
    const monthlyMap = new Map<string, { total: number; membership: number }>()
    for (const tx of transactions ?? []) {
      const month = tx.created_at.slice(0, 7) // YYYY-MM
      const existing = monthlyMap.get(month) ?? { total: 0, membership: 0 }
      existing.total += tx.amount
      if (tx.type === 'membership' || tx.type === 'membership_renewal') {
        existing.membership += tx.amount
      }
      monthlyMap.set(month, existing)
    }

    const revenueHistory: RevenueMonth[] = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        total_revenue: data.total,
        membership_revenue: data.membership,
      }))

    // ─── Build Changes Array ─────────────────────────────────
    // The simulation stores changes with new_price, but the AI lib uses proposed_price
    const proposedChanges: PriceChange[] = (
      simulation.changes as {
        plan_id: string
        plan_name: string
        current_price: number
        new_price: number
      }[]
    ).map((c) => ({
      plan_id: c.plan_id,
      plan_name: c.plan_name,
      current_price: c.current_price,
      proposed_price: c.new_price,
    }))

    // ─── Run AI Analysis ─────────────────────────────────────
    const result = await analyzePricingScenario({
      studio_id: studioId,
      plans: planSnapshots,
      proposed_changes: proposedChanges,
      revenue_history: revenueHistory,
    })

    // ─── Update Simulation ───────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('pricing_simulations')
      .update({
        projections: {
          projected_mrr: result.projected_mrr,
          projected_annual_revenue: result.projected_annual_revenue,
          monthly_revenue_delta: result.monthly_revenue_delta,
          monthly_revenue_delta_pct: result.monthly_revenue_delta_pct,
          churn_risk_increase_pct: result.churn_risk_increase_pct,
          churn_risk_level: result.churn_risk_level,
          upgrade_predictions: result.upgrade_predictions,
          sensitivity: result.sensitivity,
        },
        ai_narrative: result.narrative,
        status: 'analyzed',
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('studio_id', studioId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      action: 'pricing_simulation_analyzed',
      entity_type: 'pricing_simulation',
      entity_id: id,
      metadata: {
        projected_mrr: result.projected_mrr,
        churn_risk_level: result.churn_risk_level,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('POST /api/pricing-simulator/[id]/analyze error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
