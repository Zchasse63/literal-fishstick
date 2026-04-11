/**
 * T46 — Webhook signature verification.
 *
 * Stripe and Resend webhooks must reject unsigned / badly-signed requests
 * to prevent forged events from mutating state. These tests hit the webhook
 * endpoints with deliberately-bad signatures and verify the response is 4xx.
 *
 * We never POST a valid-looking webhook body because we don't want to pollute
 * the DB — and that codepath is already covered by the integration tests at
 * src/__tests__/integration/stripe-webhook-effects.test.ts.
 */
import { test, expect } from '@playwright/test'

test.describe('Platform — Webhook signature verification (T46)', () => {
  test('stripe webhook rejects request with no signature @p0', async ({
    page,
  }) => {
    const response = await page.request.post('/api/webhooks/stripe', {
      data: { type: 'customer.subscription.created', id: 'evt_forged' },
    })
    // Must not be 2xx — no signature header at all
    expect(response.status()).toBeGreaterThanOrEqual(400)
  })

  test('stripe webhook rejects request with bogus signature @p0', async ({
    page,
  }) => {
    const response = await page.request.post('/api/webhooks/stripe', {
      headers: { 'stripe-signature': 'whsec_bogus_signature_not_real' },
      data: { type: 'customer.subscription.created', id: 'evt_forged_2' },
    })
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
  })

  test('resend webhook rejects request with bogus signature @p0', async ({
    page,
  }) => {
    const response = await page.request.post('/api/webhooks/resend', {
      headers: {
        'svix-id': 'msg_bogus',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,bogus_signature_not_real',
      },
      data: {
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: 'bogus' },
      },
    })
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
  })
})
