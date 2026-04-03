/**
 * Stripe client utilities for Meridian
 *
 * Direct Stripe integration (not Stripe Connect).
 * Server-side only — never expose the secret key to the client.
 */
import Stripe from 'stripe'

// Server-side Stripe instance (lazy init to avoid build-time errors)
let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    })
  }
  return _stripe
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
      meridian_studio_id: '11111111-1111-1111-1111-111111111111',
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

export async function cancelSubscription(subscriptionId: string, immediately = false) {
  const stripe = getStripe()
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId)
  }
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
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
      meridian_studio_id: '11111111-1111-1111-1111-111111111111',
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
