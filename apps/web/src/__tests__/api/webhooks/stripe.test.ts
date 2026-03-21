import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted mocks (available inside vi.mock factories) ───────

const { mockConstructWebhookEvent, mockSupabase, queryBuilder } = vi.hoisted(() => {
  const mockConstructWebhookEvent = vi.fn()

  // Inline a minimal chainable Supabase mock (cannot import helpers in hoisted)
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'is', 'not', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'offset',
    'single', 'maybeSingle', 'match', 'contains',
    'containedBy', 'overlaps', 'textSearch', 'csv', 'returns',
    'throwOnError',
  ] as const

  const state = { data: null as unknown, error: null as unknown }

  const queryBuilder: Record<string, ReturnType<typeof vi.fn>> & {
    mockResolvedData: (data: unknown) => void
  } = {
    mockResolvedData: (data: unknown) => {
      state.data = data
      state.error = null
    },
  } as never

  for (const method of chainMethods) {
    queryBuilder[method] = vi.fn().mockImplementation(() => ({
      ...queryBuilder,
      then: (resolve: (val: unknown) => void) => {
        resolve({ data: state.data, error: state.error })
      },
    }))
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(queryBuilder),
  }

  return { mockConstructWebhookEvent, mockSupabase, queryBuilder }
})

// ─── Module mocks ─────────────────────────────────────────────

vi.mock('@/lib/stripe', () => ({
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockResolvedValue(mockSupabase),
}))

// ─── Import handler under test ────────────────────────────────
import { POST } from '@/app/api/webhooks/stripe/route'

// ─── Helpers ──────────────────────────────────────────────────

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const MEMBER_ID = 'aaaaaaaa-1111-2222-3333-444444444444'
const SUBSCRIPTION_ID = 'sub_test_123'

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers,
  })
}

function makeSignedRequest(body: string = '{}'): NextRequest {
  return makeRequest(body, { 'stripe-signature': 'sig_test_valid' })
}

function makeStripeEvent(type: string, dataObject: Record<string, unknown>) {
  return {
    type,
    data: { object: dataObject },
  }
}

function makeSubscriptionEvent(
  type: string,
  overrides: Record<string, unknown> = {}
) {
  return makeStripeEvent(type, {
    id: SUBSCRIPTION_ID,
    metadata: { meridian_member_id: MEMBER_ID },
    ...overrides,
  })
}

async function parseResponse(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
  }
}

// ─── Tests ────────────────────────────────────────────────────

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the query builder to success state
    queryBuilder.mockResolvedData(null)
    // Re-bind from() to return our queryBuilder
    mockSupabase.from.mockReturnValue(queryBuilder)
  })

  // ─── Signature & Validation ─────────────────────────────────

  describe('signature validation', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const request = makeRequest('{}')
      const response = await POST(request)
      const { status, body } = await parseResponse(response)

      expect(status).toBe(400)
      expect(body.error).toBe('Missing stripe-signature header')
      expect(mockConstructWebhookEvent).not.toHaveBeenCalled()
    })

    it('returns 400 when constructWebhookEvent throws an Error', async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const request = makeSignedRequest()
      const response = await POST(request)
      const { status, body } = await parseResponse(response)

      expect(status).toBe(400)
      expect(body.error).toBe('Webhook Error: Invalid signature')
    })

    it('returns 400 with "Unknown error" when constructWebhookEvent throws a non-Error', async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw 'some string error'
      })

      const request = makeSignedRequest()
      const response = await POST(request)
      const { status, body } = await parseResponse(response)

      expect(status).toBe(400)
      expect(body.error).toBe('Webhook Error: Unknown error')
    })

    it('passes body, signature, and webhook secret to constructWebhookEvent', async () => {
      const eventBody = '{"test":"payload"}'
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('unhandled.event', {})
      )

      const request = makeRequest(eventBody, { 'stripe-signature': 'sig_abc' })
      await POST(request)

      expect(mockConstructWebhookEvent).toHaveBeenCalledWith(
        eventBody,
        'sig_abc',
        'whsec_test_fake'
      )
    })
  })

  // ─── customer.subscription.created ──────────────────────────

  describe('customer.subscription.created', () => {
    it('updates member status to active and sets stripe_subscription_id', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect(body.received).toBe(true)

      // Check members update
      expect(mockSupabase.from).toHaveBeenCalledWith('members')
      expect(queryBuilder.update).toHaveBeenCalledWith({
        stripe_subscription_id: SUBSCRIPTION_ID,
        membership_status: 'active',
      })
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', MEMBER_ID)
    })

    it('invalidates AI cache for the member', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('ai_cache')
      expect(queryBuilder.delete).toHaveBeenCalled()
      expect(queryBuilder.eq).toHaveBeenCalledWith('entity_id', MEMBER_ID)
      expect(queryBuilder.eq).toHaveBeenCalledWith('studio_id', STUDIO_ID)
    })

    it('logs subscription_created activity', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith({
        studio_id: STUDIO_ID,
        action: 'subscription_created',
        details: {
          member_id: MEMBER_ID,
          subscription_id: SUBSCRIPTION_ID,
        },
      })
    })

    it('skips DB writes when meridian_member_id is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('customer.subscription.created', {
          id: SUBSCRIPTION_ID,
          metadata: {},
        })
      )

      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect(body.received).toBe(true)
      expect(queryBuilder.update).not.toHaveBeenCalled()
      expect(queryBuilder.insert).not.toHaveBeenCalled()
      expect(queryBuilder.delete).not.toHaveBeenCalled()
    })
  })

  // ─── customer.subscription.updated ──────────────────────────

  describe('customer.subscription.updated', () => {
    it('sets status to canceling when cancel_at_period_end is true', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.updated', {
          cancel_at_period_end: true,
        })
      )

      const response = await POST(makeSignedRequest())
      expect(response.status).toBe(200)

      expect(queryBuilder.update).toHaveBeenCalledWith({
        membership_status: 'canceling',
      })
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', MEMBER_ID)
    })

    it('sets status to active when cancel_at_period_end is false', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.updated', {
          cancel_at_period_end: false,
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.update).toHaveBeenCalledWith({
        membership_status: 'active',
      })
    })

    it('invalidates AI cache but does not log activity', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.updated', {
          cancel_at_period_end: false,
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('ai_cache')
      expect(queryBuilder.delete).toHaveBeenCalled()
      // subscription.updated does NOT call logActivity
      expect(mockSupabase.from).not.toHaveBeenCalledWith('activity_log')
    })

    it('skips DB writes when meridian_member_id is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('customer.subscription.updated', {
          id: SUBSCRIPTION_ID,
          metadata: {},
          cancel_at_period_end: true,
        })
      )

      const response = await POST(makeSignedRequest())
      expect(response.status).toBe(200)
      expect(queryBuilder.update).not.toHaveBeenCalled()
    })
  })

  // ─── customer.subscription.deleted ──────────────────────────

  describe('customer.subscription.deleted', () => {
    it('sets member status to expired', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.deleted')
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.update).toHaveBeenCalledWith({
        membership_status: 'expired',
      })
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', MEMBER_ID)
    })

    it('invalidates AI cache and logs subscription_canceled activity', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.deleted')
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('ai_cache')
      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith({
        studio_id: STUDIO_ID,
        action: 'subscription_canceled',
        details: {
          member_id: MEMBER_ID,
          subscription_id: SUBSCRIPTION_ID,
        },
      })
    })
  })

  // ─── invoice.payment_succeeded ──────────────────────────────

  describe('invoice.payment_succeeded', () => {
    it('creates a transaction record with amount divided by 100', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          id: 'inv_123',
          number: 'INV-0042',
          amount_paid: 4999,
          payment_intent: 'pi_test_abc',
          metadata: { meridian_member_id: MEMBER_ID },
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        studio_id: STUDIO_ID,
        member_id: MEMBER_ID,
        amount: 49.99,
        type: 'payment',
        status: 'completed',
        stripe_payment_intent_id: 'pi_test_abc',
        description: 'Invoice INV-0042',
      })
    })

    it('uses invoice.id in description when number is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          id: 'inv_456',
          number: null,
          amount_paid: 1000,
          payment_intent: 'pi_test_def',
          metadata: { meridian_member_id: MEMBER_ID },
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Invoice inv_456',
        })
      )
    })

    it('logs payment_received activity with correct amount', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          id: 'inv_789',
          amount_paid: 2500,
          payment_intent: 'pi_test_ghi',
          metadata: { meridian_member_id: MEMBER_ID },
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith({
        studio_id: STUDIO_ID,
        action: 'payment_received',
        details: {
          member_id: MEMBER_ID,
          amount: 25,
        },
      })
    })

    it('skips when amount_paid is 0 or falsy', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          id: 'inv_zero',
          amount_paid: 0,
          metadata: { meridian_member_id: MEMBER_ID },
        })
      )

      await POST(makeSignedRequest())

      // amount_paid is falsy (0), so the if(memberId && invoice.amount_paid) guard skips
      expect(queryBuilder.insert).not.toHaveBeenCalled()
    })

    it('skips when meridian_member_id is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          id: 'inv_nomember',
          amount_paid: 5000,
          metadata: {},
        })
      )

      const response = await POST(makeSignedRequest())
      expect(response.status).toBe(200)
      expect(queryBuilder.insert).not.toHaveBeenCalled()
    })
  })

  // ─── invoice.payment_failed ─────────────────────────────────

  describe('invoice.payment_failed', () => {
    it('records a failed transaction with amount_due / 100', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_failed', {
          id: 'inv_fail_1',
          number: 'INV-FAIL-01',
          amount_due: 7500,
          metadata: { meridian_member_id: MEMBER_ID },
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        studio_id: STUDIO_ID,
        member_id: MEMBER_ID,
        amount: 75,
        type: 'payment',
        status: 'failed',
        description: 'Failed: Invoice INV-FAIL-01',
      })
    })

    it('defaults to 0 when amount_due is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_failed', {
          id: 'inv_fail_2',
          number: null,
          metadata: { meridian_member_id: MEMBER_ID },
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0,
          description: 'Failed: Invoice inv_fail_2',
        })
      )
    })

    it('logs payment_failed activity', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_failed', {
          id: 'inv_fail_3',
          number: 'INV-FAIL-03',
          amount_due: 3000,
          metadata: { meridian_member_id: MEMBER_ID },
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith({
        studio_id: STUDIO_ID,
        action: 'payment_failed',
        details: {
          member_id: MEMBER_ID,
          amount: 30,
        },
      })
    })
  })

  // ─── checkout.session.completed ─────────────────────────────

  describe('checkout.session.completed', () => {
    it('inserts a credit pack when purchase_type is credit_pack', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          id: 'cs_credit_1',
          metadata: {
            meridian_member_id: MEMBER_ID,
            purchase_type: 'credit_pack',
            credits: '10',
          },
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('credit_packs')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          studio_id: STUDIO_ID,
          member_id: MEMBER_ID,
          total_credits: 10,
          remaining_credits: 10,
        })
      )
      // expires_at should be roughly 1 year from now
      const insertCall = queryBuilder.insert.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as Record<string, unknown>).total_credits === 10
      )
      expect(insertCall).toBeDefined()
      const expiresAt = new Date((insertCall![0] as Record<string, string>).expires_at)
      const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      // Allow 10 seconds tolerance
      expect(Math.abs(expiresAt.getTime() - oneYearFromNow.getTime())).toBeLessThan(10_000)
    })

    it('skips credit pack insert when credits is 0', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          id: 'cs_credit_zero',
          metadata: {
            meridian_member_id: MEMBER_ID,
            purchase_type: 'credit_pack',
            credits: '0',
          },
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).not.toHaveBeenCalled()
    })

    it('inserts a gift card when purchase_type is gift_card', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          id: 'cs_gift_1',
          metadata: {
            meridian_member_id: MEMBER_ID,
            purchase_type: 'gift_card',
            gift_amount: '50',
          },
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('gift_cards')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          studio_id: STUDIO_ID,
          purchased_by: MEMBER_ID,
          original_amount: 50,
          current_balance: 50,
        })
      )
    })

    it('generates a gift card code in XXXX-XXXX-XXXX format with no ambiguous chars', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          id: 'cs_gift_code',
          metadata: {
            meridian_member_id: MEMBER_ID,
            purchase_type: 'gift_card',
            gift_amount: '100',
          },
        })
      )

      await POST(makeSignedRequest())

      const insertCall = queryBuilder.insert.mock.calls.find(
        (call: unknown[]) => (call[0] as Record<string, unknown>).code !== undefined
      )
      expect(insertCall).toBeDefined()
      const code = (insertCall![0] as Record<string, string>).code

      // Format: XXXX-XXXX-XXXX (14 chars total with dashes, 12 alphanumeric)
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      expect(code.replace(/-/g, '')).toHaveLength(12)

      // No ambiguous characters: no O, 0, 1, I, L
      const ambiguous = /[OIL01]/
      expect(ambiguous.test(code)).toBe(false)
    })

    it('skips gift card insert when gift_amount is 0', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          id: 'cs_gift_zero',
          metadata: {
            meridian_member_id: MEMBER_ID,
            purchase_type: 'gift_card',
            gift_amount: '0',
          },
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).not.toHaveBeenCalledWith('gift_cards')
    })

    it('skips all inserts when meridian_member_id is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          id: 'cs_nomember',
          metadata: {
            purchase_type: 'credit_pack',
            credits: '10',
          },
        })
      )

      const response = await POST(makeSignedRequest())
      expect(response.status).toBe(200)
      expect(queryBuilder.insert).not.toHaveBeenCalled()
    })
  })

  // ─── Default / unhandled event ──────────────────────────────

  describe('unhandled event types', () => {
    it('returns 200 with received:true for unknown event types', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('charge.refunded', { id: 'ch_123' })
      )

      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect(body.received).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unhandled Stripe event type: charge.refunded'
      )

      consoleSpy.mockRestore()
    })
  })

  // ─── Error handling during processing ───────────────────────

  describe('processing errors', () => {
    it('returns 500 when a DB operation throws', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection lost')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(500)
      expect(body.error).toBe('Webhook processing error')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database connection lost')
      )

      consoleSpy.mockRestore()
    })

    it('returns 500 with generic message for non-Error throws', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.deleted')
      )
      mockSupabase.from.mockImplementation(() => {
        throw 42
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(500)
      expect(body.error).toBe('Webhook processing error')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error')
      )

      consoleSpy.mockRestore()
    })
  })
})
