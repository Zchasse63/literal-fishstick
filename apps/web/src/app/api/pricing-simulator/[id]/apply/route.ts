import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'


/**
 * POST /api/pricing-simulator/[id]/apply
 *
 * Apply pricing changes to Stripe. Owner-only.
 * Body: { migrate_subscribers: boolean }
 *
 * For each plan change:
 *   1. Create new Stripe Price (Prices are immutable)
 *   2. Update Product's default_price to new Price
 *   3. Optionally migrate existing subscribers
 *   4. Store previous_price_ids for revert capability
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth (Owner Only) ───────────────────────────────────
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
    if (!roles.includes('owner')) {
      return NextResponse.json(
        { error: 'Only owners can apply pricing changes.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Check Stripe Availability ───────────────────────────
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable pricing changes.' },
        { status: 501 }
      )
    }

    // Dynamic import to avoid build errors when Stripe is not available
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

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

    if (simulation.status === 'applied') {
      return NextResponse.json(
        { error: 'This simulation has already been applied.' },
        { status: 409 }
      )
    }

    // ─── Parse Body ──────────────────────────────────────────
    const body = await request.json()
    const migrateSubscribers = body.migrate_subscribers === true

    // ─── Apply Each Price Change ─────────────────────────────
    const changes = simulation.changes as {
      plan_id: string
      plan_name: string
      current_price: number
      new_price: number
    }[]

    const previousPriceIds: Record<string, string> = {}
    const appliedChanges: {
      plan_id: string
      old_stripe_price_id: string
      new_stripe_price_id: string
      subscribers_migrated: number
    }[] = []

    for (const change of changes) {
      // Fetch the plan. Schema: membership_plans has stripe_price_id; the
      // stripe_product_id column was added in migration t30b and may be null
      // for legacy rows — if null, retrieve it via the existing price.
      const { data: plan, error: planError } = await supabase
        .from('membership_plans')
        .select('id, name, tier, stripe_product_id, stripe_price_id, billing_interval')
        .eq('id', change.plan_id)
        .eq('studio_id', studioId)
        .single()

      if (planError || !plan) {
        console.error(`Plan ${change.plan_id} not found, skipping`)
        continue
      }

      // Resolve the Stripe product id — from the column if set, otherwise
      // retrieve it via the existing price.
      let productId = plan.stripe_product_id as string | null
      if (!productId && plan.stripe_price_id) {
        try {
          const existingPrice = await stripe.prices.retrieve(plan.stripe_price_id)
          productId =
            typeof existingPrice.product === 'string'
              ? existingPrice.product
              : existingPrice.product?.id ?? null
        } catch (err) {
          console.error(`Failed to resolve stripe product for plan ${change.plan_id}:`, err)
        }
      }

      if (!productId) {
        console.error(`Plan ${change.plan_id} has no Stripe product, skipping`)
        continue
      }

      // Store old price ID for revert capability
      previousPriceIds[change.plan_id] = plan.stripe_price_id

      // 1. Create new Stripe Price (Prices are immutable — cannot update unit_amount)
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(change.new_price * 100), // Convert to cents
        currency: 'usd',
        recurring: {
          interval: plan.billing_interval === 'yearly' ? 'year' : 'month',
        },
        metadata: {
          plan_id: change.plan_id,
          simulation_id: id,
          previous_price: String(change.current_price),
        },
      })

      // 2. Update Product's default_price
      await stripe.products.update(productId, {
        default_price: newPrice.id,
      })

      // 3. Archive the old price
      if (plan.stripe_price_id) {
        await stripe.prices.update(plan.stripe_price_id, {
          active: false,
        })
      }

      // 4. Update the plan in our database
      await supabase
        .from('membership_plans')
        .update({
          price: change.new_price,
          stripe_price_id: newPrice.id,
          stripe_product_id: productId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', change.plan_id)
        .eq('studio_id', studioId)

      let subscribersMigrated = 0

      // 5. Optionally migrate existing subscribers to new price.
      // `members` has no membership_plan_id column — the link is via
      // membership_tier (text). Use plan.tier / plan.name as the match.
      if (migrateSubscribers) {
        const tierFilter = plan.tier ?? plan.name
        const { data: activeMembers } = await supabase
          .from('members')
          .select('id, stripe_subscription_id')
          .eq('studio_id', studioId)
          .eq('membership_tier', tierFilter)
          .eq('membership_status', 'active')
          .not('stripe_subscription_id', 'is', null)

        for (const member of activeMembers ?? []) {
          try {
            // Retrieve the subscription to find the item
            const subscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id)
            const subscriptionItem = subscription.items.data[0]

            if (subscriptionItem) {
              // Update subscription item to new price with proration
              await stripe.subscriptions.update(member.stripe_subscription_id, {
                items: [{
                  id: subscriptionItem.id,
                  price: newPrice.id,
                }],
                proration_behavior: 'create_prorations',
              })
              subscribersMigrated++
            }
          } catch (stripeErr) {
            console.error(`Failed to migrate subscription for member ${member.id}:`, stripeErr)
          }
        }
      }

      appliedChanges.push({
        plan_id: change.plan_id,
        old_stripe_price_id: plan.stripe_price_id,
        new_stripe_price_id: newPrice.id,
        subscribers_migrated: subscribersMigrated,
      })
    }

    // ─── Update Simulation Status ────────────────────────────
    // Schema has previous_price_ids (jsonb). Stash applied_by, applied_changes,
    // and migrate_subscribers in activity_log metadata below instead of on the
    // row since those columns don't exist.
    const { data: updated, error: updateError } = await supabase
      .from('pricing_simulations')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        previous_price_ids: previousPriceIds,
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
      type: 'pricing_simulation_applied',
      subject_type: 'pricing_simulation',
      subject_id: id,
      metadata: {
        changes_applied: appliedChanges.length,
        subscribers_migrated: migrateSubscribers,
        previous_price_ids: previousPriceIds,
        applied_changes: appliedChanges,
        applied_by: user.id,
      },
    })

    return NextResponse.json({ data: updated, applied_changes: appliedChanges })
  } catch (err) {
    console.error('POST /api/pricing-simulator/[id]/apply error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
