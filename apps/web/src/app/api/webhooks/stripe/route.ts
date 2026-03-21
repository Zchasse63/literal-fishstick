import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase/server'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event

  try {
    event = constructWebhookEvent(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook signature verification failed: ${message}`)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  const supabase = await createServerClient()

  try {
    switch (event.type) {
      // ─── Subscription Events ────────────────────────────
      case 'customer.subscription.created': {
        const subscription = event.data.object
        const memberId = subscription.metadata?.meridian_member_id
        if (memberId) {
          await supabase
            .from('members')
            .update({
              stripe_subscription_id: subscription.id,
              membership_status: 'active',
            })
            .eq('id', memberId)

          // Invalidate AI cache (churn/health predictions are now stale)
          await supabase
            .from('ai_cache')
            .delete()
            .eq('entity_id', memberId)
            .eq('studio_id', '11111111-1111-1111-1111-111111111111')

          await logActivity(supabase, 'subscription_created', {
            member_id: memberId,
            subscription_id: subscription.id,
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const memberId = subscription.metadata?.meridian_member_id
        if (memberId) {
          const status = subscription.cancel_at_period_end ? 'canceling' : 'active'
          await supabase
            .from('members')
            .update({ membership_status: status })
            .eq('id', memberId)

          // Invalidate AI cache (churn/health predictions are now stale)
          await supabase
            .from('ai_cache')
            .delete()
            .eq('entity_id', memberId)
            .eq('studio_id', '11111111-1111-1111-1111-111111111111')
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const memberId = subscription.metadata?.meridian_member_id
        if (memberId) {
          await supabase
            .from('members')
            .update({ membership_status: 'expired' })
            .eq('id', memberId)

          // Invalidate AI cache (churn/health predictions are now stale)
          await supabase
            .from('ai_cache')
            .delete()
            .eq('entity_id', memberId)
            .eq('studio_id', '11111111-1111-1111-1111-111111111111')

          await logActivity(supabase, 'subscription_canceled', {
            member_id: memberId,
            subscription_id: subscription.id,
          })
        }
        break
      }

      // ─── Payment Events ─────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const memberId = invoice.metadata?.meridian_member_id
        if (memberId && invoice.amount_paid) {
          await supabase.from('transactions').insert({
            studio_id: '11111111-1111-1111-1111-111111111111',
            member_id: memberId,
            amount: invoice.amount_paid / 100,
            type: 'payment',
            status: 'completed',
            stripe_payment_intent_id: (invoice as unknown as { payment_intent: string }).payment_intent,
            description: `Invoice ${invoice.number || invoice.id}`,
          })

          await logActivity(supabase, 'payment_received', {
            member_id: memberId,
            amount: invoice.amount_paid / 100,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const memberId = invoice.metadata?.meridian_member_id
        if (memberId) {
          // Record failed payment for dunning
          await supabase.from('transactions').insert({
            studio_id: '11111111-1111-1111-1111-111111111111',
            member_id: memberId,
            amount: (invoice.amount_due || 0) / 100,
            type: 'payment',
            status: 'failed',
            description: `Failed: Invoice ${invoice.number || invoice.id}`,
          })

          await logActivity(supabase, 'payment_failed', {
            member_id: memberId,
            amount: (invoice.amount_due || 0) / 100,
          })
        }
        break
      }

      // ─── Checkout Events ────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object
        const memberId = session.metadata?.meridian_member_id
        const purchaseType = session.metadata?.purchase_type

        if (memberId && purchaseType === 'credit_pack') {
          const credits = parseInt(session.metadata?.credits || '0', 10)
          if (credits > 0) {
            await supabase.from('credit_packs').insert({
              studio_id: '11111111-1111-1111-1111-111111111111',
              member_id: memberId,
              total_credits: credits,
              remaining_credits: credits,
              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            })
          }
        }

        if (memberId && purchaseType === 'gift_card') {
          const amount = parseInt(session.metadata?.gift_amount || '0', 10)
          if (amount > 0) {
            await supabase.from('gift_cards').insert({
              studio_id: '11111111-1111-1111-1111-111111111111',
              purchased_by: memberId,
              original_amount: amount,
              current_balance: amount,
              code: generateGiftCardCode(),
            })
          }
        }
        break
      }

      default:
        // Unhandled event type — log but don't error
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Error processing webhook ${event.type}: ${message}`)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logActivity(supabase: any, action: string, details: Record<string, unknown>) {
  await supabase.from('activity_log').insert({
    studio_id: '11111111-1111-1111-1111-111111111111',
    action,
    details,
  })
}

function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-'
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
