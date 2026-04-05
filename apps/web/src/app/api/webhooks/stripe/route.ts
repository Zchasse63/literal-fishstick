import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { getAdminClient } from '@/lib/inngest/helpers'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * Service-role Supabase client for webhook handlers (LOW-015).
 * Reuses the singleton from Inngest helpers to avoid creating duplicate
 * service-role clients. Stripe webhooks are server-to-server calls with
 * no user cookies, so we MUST use the service-role key to bypass RLS.
 */
function getWebhookSupabase() {
  return getAdminClient()
}

/**
 * Extract studio_id from Stripe object metadata.
 * Falls back to member lookup if not in metadata (backward compat).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveStudioId(
  supabase: any,
  metadata: Record<string, string> | null | undefined,
  memberId: string | undefined,
): Promise<string | null> {
  // Preferred: studio_id in metadata (set at Stripe object creation time)
  if (metadata?.meridian_studio_id) {
    return metadata.meridian_studio_id
  }

  // Fallback: look up studio_id from the member record
  if (memberId) {
    const { data } = await supabase
      .from('members')
      .select('studio_id')
      .eq('id', memberId)
      .single()
    return (data as { studio_id: string } | null)?.studio_id ?? null
  }

  return null
}

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
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const supabase = getWebhookSupabase()

  // ─── Idempotency Check ──────────────────────────────────────
  // Prevent duplicate processing if Stripe retries the same event
  const { data: existing } = await supabase
    .from('processed_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Record the event as processed (best-effort — race window is tiny)
  await supabase.from('processed_webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    processed_at: new Date().toISOString(),
  }).then(() => {}, () => {
    // Ignore insert conflicts (another instance may have inserted first)
  })

  try {
    switch (event.type) {
      // ─── Subscription Events ────────────────────────────
      case 'customer.subscription.created': {
        const subscription = event.data.object
        const memberId = subscription.metadata?.meridian_member_id
        const studioId = await resolveStudioId(supabase, subscription.metadata, memberId)

        if (memberId && studioId) {
          await supabase
            .from('members')
            .update({
              stripe_subscription_id: subscription.id,
              membership_status: 'active',
            })
            .eq('id', memberId)
            .eq('studio_id', studioId)

          // Invalidate AI cache (churn/health predictions are now stale)
          await supabase
            .from('ai_cache')
            .delete()
            .eq('entity_id', memberId)
            .eq('studio_id', studioId)

          await logActivity(supabase, studioId, 'membership_change', 'New subscription created', {
            member_id: memberId,
            subscription_id: subscription.id,
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const memberId = subscription.metadata?.meridian_member_id
        const studioId = await resolveStudioId(supabase, subscription.metadata, memberId)

        if (memberId && studioId) {
          // 'paused' = cancel at period end; 'active' = still active
          const status = subscription.cancel_at_period_end ? 'paused' : 'active'
          await supabase
            .from('members')
            .update({ membership_status: status })
            .eq('id', memberId)
            .eq('studio_id', studioId)

          // Invalidate AI cache
          await supabase
            .from('ai_cache')
            .delete()
            .eq('entity_id', memberId)
            .eq('studio_id', studioId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const memberId = subscription.metadata?.meridian_member_id
        const studioId = await resolveStudioId(supabase, subscription.metadata, memberId)

        if (memberId && studioId) {
          await supabase
            .from('members')
            .update({ membership_status: 'cancelled' })
            .eq('id', memberId)
            .eq('studio_id', studioId)

          // Invalidate AI cache
          await supabase
            .from('ai_cache')
            .delete()
            .eq('entity_id', memberId)
            .eq('studio_id', studioId)

          await logActivity(supabase, studioId, 'membership_change', 'Subscription cancelled', {
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
        const studioId = await resolveStudioId(supabase, invoice.metadata, memberId)

        if (memberId && studioId && invoice.amount_paid) {
          await supabase.from('transactions').insert({
            studio_id: studioId,
            member_id: memberId,
            amount: invoice.amount_paid, // Stripe amount is already in cents
            type: 'membership',
            status: 'completed',
            stripe_payment_intent_id: (invoice as unknown as { payment_intent: string }).payment_intent,
            description: `Invoice ${invoice.number || invoice.id}`,
          })

          await logActivity(supabase, studioId, 'payment', 'Payment received', {
            member_id: memberId,
            amount: invoice.amount_paid,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const memberId = invoice.metadata?.meridian_member_id
        const studioId = await resolveStudioId(supabase, invoice.metadata, memberId)

        if (memberId && studioId) {
          await supabase.from('transactions').insert({
            studio_id: studioId,
            member_id: memberId,
            amount: invoice.amount_due || 0, // cents
            type: 'membership',
            status: 'failed',
            description: `Failed: Invoice ${invoice.number || invoice.id}`,
          })

          await logActivity(supabase, studioId, 'failed_payment', 'Payment failed', {
            member_id: memberId,
            amount: invoice.amount_due || 0,
          })
        }
        break
      }

      // ─── Checkout Events ────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object
        const memberId = session.metadata?.meridian_member_id
        const purchaseType = session.metadata?.purchase_type
        const studioId = await resolveStudioId(supabase, session.metadata, memberId)

        if (memberId && studioId && purchaseType === 'credit_pack') {
          const credits = parseInt(session.metadata?.credits || '0', 10)
          if (credits > 0) {
            await supabase.from('credit_packs').insert({
              studio_id: studioId,
              member_id: memberId,
              credits_total: credits,
              credits_remaining: credits,
              pack_type: session.metadata?.pack_type || '8_pack',
              purchased_at: new Date().toISOString(),
              price_paid: session.amount_total || 0,
              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            })
          }
        }

        if (memberId && studioId && purchaseType === 'gift_card') {
          const amount = parseInt(session.metadata?.gift_amount || '0', 10)
          if (amount > 0) {
            await supabase.from('gift_cards').insert({
              studio_id: studioId,
              purchased_by_member_id: memberId,
              amount,
              balance: amount,
              code: generateGiftCardCode(),
              is_active: true,
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
async function logActivity(
  supabase: any,
  studioId: string,
  type: string,
  description: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from('activity_log').insert({
    studio_id: studioId,
    type,
    description,
    metadata,
  })
}

function generateGiftCardCode(): string {
  // Use crypto.randomInt for cryptographically secure gift card codes (bearer tokens)
  const { randomInt } = require('crypto')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-'
    code += chars.charAt(randomInt(chars.length))
  }
  return code
}
