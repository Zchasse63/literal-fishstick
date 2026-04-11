import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

/**
 * GET /api/pricing-simulator/current-plans
 *
 * Return current pricing plans with subscriber counts and MRR contribution.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

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

    // ─── Fetch Plans ─────────────────────────────────────────
    const { data: plans, error: plansError } = await supabase
      .from('membership_plans')
      .select('id, name, tier, price, billing_interval, is_active')
      .eq('studio_id', studioId)
      .eq('is_active', true)
      .order('price', { ascending: true })

    if (plansError) {
      return NextResponse.json({ error: plansError.message }, { status: 500 })
    }

    // ─── Count Subscribers Per Plan ──────────────────────────
    // `members` has no membership_plan_id column — match on membership_tier
    // (falling back to plan.name when tier is not set).
    const result = []
    for (const plan of plans ?? []) {
      const tierFilter = plan.tier ?? plan.name
      const { count } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studioId)
        .eq('membership_tier', tierFilter)
        .eq('membership_status', 'active')

      const subscriberCount = count ?? 0
      const mrrContribution = subscriberCount * (plan.price ?? 0)

      result.push({
        plan_id: plan.id,
        plan_name: plan.name,
        price: plan.price,
        billing_interval: plan.billing_interval,
        subscriber_count: subscriberCount,
        mrr_contribution: mrrContribution,
      })
    }

    // ─── Summary ─────────────────────────────────────────────
    const totalMRR = result.reduce((sum, p) => sum + p.mrr_contribution, 0)
    const totalSubscribers = result.reduce((sum, p) => sum + p.subscriber_count, 0)

    return NextResponse.json({
      data: result,
      summary: {
        total_plans: result.length,
        total_subscribers: totalSubscribers,
        total_mrr: totalMRR,
      },
    })
  } catch (err) {
    console.error('GET /api/pricing-simulator/current-plans error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
