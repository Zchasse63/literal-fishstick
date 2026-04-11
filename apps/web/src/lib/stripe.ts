/**
 * Stripe client utilities for Meridian
 *
 * Direct Stripe integration (not Stripe Connect).
 * Server-side only — never expose the secret key to the client.
 *
 * DRY_RUN support: when STRIPE_SECRET_KEY is missing or STRIPE_DRY_RUN=true,
 * all mutating calls return synthetic "dry_run_*" ids and log to console
 * instead of hitting the Stripe API. This lets every Stripe-touching route
 * work end-to-end in dev/test environments without real credentials.
 */
import Stripe from 'stripe'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// Server-side Stripe instance (lazy init to avoid build-time errors)
let _stripe: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && process.env.STRIPE_DRY_RUN !== 'true'
}

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    })
  }
  return _stripe
}

function dryRunId(prefix: string): string {
  return `${prefix}_dry_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Standard shape returned by every mutating helper so callers can log
 * the operation without branching on dry_run vs real.
 */
export interface StripeOperationResult<T = unknown> {
  id: string
  dry_run: boolean
  data: T | null
  error: string | null
}

// ─── Customer Management ────────────────────────────────────

export async function getOrCreateCustomer(email: string, name: string, memberId: string) {
  const stripe = getStripe()
  const existing = await stripe.customers.list({ email, limit: 1 })

  if (existing.data.length > 0) {
    return existing.data[0]
  }

  return stripe.customers.create({
    email,
    name,
    metadata: {
      meridian_member_id: memberId,
      meridian_studio_id: DEFAULT_STUDIO_ID,
    },
  })
}

// ─── Subscription Management ────────────────────────────────

export async function createSubscription(
  customerId: string,
  priceId: string,
  options?: {
    trialDays?: number
    promoCode?: string
    metadata?: Record<string, string>
  }
) {
  const stripe = getStripe()
  const params: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: options?.metadata,
  }

  if (options?.trialDays) {
    params.trial_period_days = options.trialDays
  }

  return stripe.subscriptions.create(params)
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<StripeOperationResult<Stripe.Subscription>> {
  if (!isStripeConfigured()) {
    const id = dryRunId('sub_cancel')
    console.log(
      `[STRIPE DRY RUN] Cancel subscription: ${subscriptionId} (immediately=${immediately}) → ${id}`
    )
    return { id, dry_run: true, data: null, error: null }
  }

  try {
    const stripe = getStripe()
    const result = immediately
      ? await stripe.subscriptions.cancel(subscriptionId)
      : await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        })
    return { id: result.id, dry_run: false, data: result, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe cancel failed'
    console.error('[STRIPE] cancelSubscription error:', msg)
    return { id: '', dry_run: false, data: null, error: msg }
  }
}

// ─── Refunds ────────────────────────────────────────────────

export async function refundPayment(
  paymentIntentId: string,
  amountCents?: number, // Optional partial refund amount in cents
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<StripeOperationResult<Stripe.Refund>> {
  if (!isStripeConfigured()) {
    const id = dryRunId('re')
    console.log(
      `[STRIPE DRY RUN] Refund payment: ${paymentIntentId} amount=${amountCents ?? 'full'} reason=${reason ?? 'requested_by_customer'} → ${id}`
    )
    return { id, dry_run: true, data: null, error: null }
  }

  try {
    const stripe = getStripe()
    const params: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason: reason ?? 'requested_by_customer',
    }
    if (typeof amountCents === 'number') {
      params.amount = amountCents
    }
    const result = await stripe.refunds.create(params)
    return { id: result.id, dry_run: false, data: result, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe refund failed'
    console.error('[STRIPE] refundPayment error:', msg)
    return { id: '', dry_run: false, data: null, error: msg }
  }
}

export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string
) {
  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Use Stripe's native proration (a key differentiator from Glofox)
  return stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: 'create_prorations',
  })
}

// ─── One-Time Payments ──────────────────────────────────────

export async function createPaymentIntent(
  amount: number, // in cents
  customerId: string,
  metadata?: Record<string, string>
) {
  const stripe = getStripe()
  // Generate idempotency key from order/member context to prevent duplicate charges
  const idempotencyKey = metadata?.order_id
    ? `pi_${metadata.order_id}_${customerId}`
    : `pi_${customerId}_${amount}_${Date.now()}`

  return stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    customer: customerId,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      meridian_studio_id: DEFAULT_STUDIO_ID,
      ...metadata,
    },
  }, {
    idempotencyKey,
  })
}

// ─── Checkout Sessions ──────────────────────────────────────

export async function createCheckoutSession(
  customerId: string,
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  options: {
    mode: 'subscription' | 'payment'
    successUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
  }
) {
  const stripe = getStripe()
  return stripe.checkout.sessions.create({
    customer: customerId,
    line_items: lineItems,
    mode: options.mode,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: options.metadata,
    // Enable card + wallet payments (Apple Pay / Google Pay)
    payment_method_types: ['card', 'link'],
  })
}

// ─── Webhook Helpers ────────────────────────────────────────

export function constructWebhookEvent(
  body: string,
  signature: string,
  secret: string
) {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(body, signature, secret)
}

// ─── Price Helpers ──────────────────────────────────────────

export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100)
}

export function formatAmountFromStripe(amount: number): number {
  return amount / 100
}
