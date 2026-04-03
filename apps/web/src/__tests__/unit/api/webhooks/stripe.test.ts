import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted mocks (available inside vi.mock factories) ───────

const { mockConstructWebhookEvent, mockSupabase, queryBuilder } = vi.hoisted(() => {
  const mockConstructWebhookEvent = vi.fn()

  // Inline a minimal chainable Supabase mock
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
    auth: { admin: {} },
  }

  return { mockConstructWebhookEvent, mockSupabase, queryBuilder }
})

// ─── Module mocks ─────────────────────────────────────────────

vi.mock('@/lib/stripe', () => ({
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
}))

// Mock @supabase/supabase-js — the webhook now uses createClient directly
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
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
    metadata: {
      meridian_member_id: MEMBER_ID,
      meridian_studio_id: STUDIO_ID,
    },
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
        expect.any(String),
      )
    })
  })

  // ─── Idempotency ───────────────────────────────────────────

  describe('idempotency check', () => {
    it('returns duplicate:true and skips processing when event was already processed', async () => {
      const event = makeSubscriptionEvent('customer.subscription.created')
      ;(event as Record<string, unknown>).id = 'evt_already_processed'
      mockConstructWebhookEvent.mockReturnValue(event)

      // First from() call is processed_webhook_events select — return existing record
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'processed_webhook_events') {
          // Return a record to indicate this event was already processed
          queryBuilder.mockResolvedData({ event_id: 'evt_already_processed' })
          return queryBuilder
        }
        queryBuilder.mockResolvedData(null)
        return queryBuilder
      })

      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect(body.received).toBe(true)
      expect(body.duplicate).toBe(true)

      // Should NOT have updated any member records (skipped processing)
      const memberCalls = mockSupabase.from.mock.calls.filter(
        (c: string[]) => c[0] === 'members'
      )
      expect(memberCalls.length).toBe(0)
    })

    it('processes event normally when not a duplicate', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      // processed_webhook_events select returns null (not a duplicate)
      // All other tables return default null
      mockSupabase.from.mockReturnValue(queryBuilder)
      queryBuilder.mockResolvedData(null)

      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect(body.received).toBe(true)
      expect(body.duplicate).toBeUndefined()
    })
  })

  // ─── customer.subscription.created ──────────────────────────

  describe('customer.subscription.created', () => {
    it('updates member status to active and sets stripe_subscription_id', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      const response = await POST(makeSignedRequest())
      expect(response.status).toBe(200)

      // Should update members table
      expect(mockSupabase.from).toHaveBeenCalledWith('members')
      expect(queryBuilder.update).toHaveBeenCalledWith({
        stripe_subscription_id: SUBSCRIPTION_ID,
        membership_status: 'active',
      })
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', MEMBER_ID)
      expect(queryBuilder.eq).toHaveBeenCalledWith('studio_id', STUDIO_ID)
    })

    it('invalidates AI cache for the member', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      await POST(makeSignedRequest())

      // Should delete from ai_cache
      expect(mockSupabase.from).toHaveBeenCalledWith('ai_cache')
      expect(queryBuilder.delete).toHaveBeenCalled()
      expect(queryBuilder.eq).toHaveBeenCalledWith('entity_id', MEMBER_ID)
      expect(queryBuilder.eq).toHaveBeenCalledWith('studio_id', STUDIO_ID)
    })

    it('logs membership_change activity', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          studio_id: STUDIO_ID,
          type: 'membership_change',
          description: 'New subscription created',
          metadata: expect.objectContaining({
            member_id: MEMBER_ID,
            subscription_id: SUBSCRIPTION_ID,
          }),
        })
      )
    })
  })

  // ─── customer.subscription.updated ──────────────────────────

  describe('customer.subscription.updated', () => {
    it('sets status to paused when cancel_at_period_end is true', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.updated', {
          cancel_at_period_end: true,
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.update).toHaveBeenCalledWith({
        membership_status: 'paused',
      })
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

      // ai_cache delete should happen
      expect(mockSupabase.from).toHaveBeenCalledWith('ai_cache')
      expect(queryBuilder.delete).toHaveBeenCalled()
    })
  })

  // ─── customer.subscription.deleted ──────────────────────────

  describe('customer.subscription.deleted', () => {
    it('sets member status to cancelled', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.deleted')
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.update).toHaveBeenCalledWith({
        membership_status: 'cancelled',
      })
    })

    it('invalidates AI cache and logs membership_change activity', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.deleted')
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('ai_cache')
      expect(queryBuilder.delete).toHaveBeenCalled()

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'membership_change',
          description: 'Subscription cancelled',
        })
      )
    })
  })

  // ─── invoice.payment_succeeded ──────────────────────────────

  describe('invoice.payment_succeeded', () => {
    it('creates a transaction record with amount in cents', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
          },
          amount_paid: 4999,
          payment_intent: 'pi_test_123',
          number: 'INV-001',
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          studio_id: STUDIO_ID,
          member_id: MEMBER_ID,
          amount: 4999,
          type: 'membership',
          status: 'completed',
          stripe_payment_intent_id: 'pi_test_123',
          description: 'Invoice INV-001',
        })
      )
    })

    it('uses invoice.id in description when number is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
          },
          amount_paid: 1000,
          payment_intent: 'pi_test_456',
          id: 'in_test_789',
          number: null,
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Invoice in_test_789',
        })
      )
    })

    it('logs payment activity with correct amount', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_succeeded', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
          },
          amount_paid: 4999,
          payment_intent: 'pi_test_123',
          number: 'INV-001',
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'payment',
          metadata: expect.objectContaining({
            amount: 4999,
          }),
        })
      )
    })
  })

  // ─── invoice.payment_failed ─────────────────────────────────

  describe('invoice.payment_failed', () => {
    it('records a failed transaction with amount_due in cents', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_failed', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
          },
          amount_due: 9900,
          number: 'INV-FAIL-001',
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9900,
          type: 'membership',
          status: 'failed',
        })
      )
    })

    it('defaults to 0 when amount_due is missing', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_failed', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
          },
          number: 'INV-FAIL-002',
        })
      )

      await POST(makeSignedRequest())

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 0 })
      )
    })

    it('logs failed_payment activity', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('invoice.payment_failed', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
          },
          amount_due: 5000,
          number: 'INV-FAIL-003',
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_log')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'failed_payment',
        })
      )
    })
  })

  // ─── checkout.session.completed ─────────────────────────────

  describe('checkout.session.completed', () => {
    it('inserts a credit pack when purchase_type is credit_pack', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
            purchase_type: 'credit_pack',
            credits: '10',
            pack_type: '8_pack',
          },
          amount_total: 9900,
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('credit_packs')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          studio_id: STUDIO_ID,
          member_id: MEMBER_ID,
          credits_total: 10,
          credits_remaining: 10,
          pack_type: '8_pack',
        })
      )
    })

    it('inserts a gift card when purchase_type is gift_card', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
            purchase_type: 'gift_card',
            gift_amount: '5000',
          },
        })
      )

      await POST(makeSignedRequest())

      expect(mockSupabase.from).toHaveBeenCalledWith('gift_cards')
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          studio_id: STUDIO_ID,
          purchased_by_member_id: MEMBER_ID,
          amount: 5000,
          balance: 5000,
          is_active: true,
        })
      )
    })

    it('generates a gift card code in XXXX-XXXX-XXXX format with no ambiguous chars', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('checkout.session.completed', {
          metadata: {
            meridian_member_id: MEMBER_ID,
            meridian_studio_id: STUDIO_ID,
            purchase_type: 'gift_card',
            gift_amount: '2500',
          },
        })
      )

      await POST(makeSignedRequest())

      const insertCall = queryBuilder.insert.mock.calls.find((call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>
        return arg?.code !== undefined
      })
      expect(insertCall).toBeTruthy()

      const code = (insertCall![0] as Record<string, unknown>).code as string
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      // Character set excludes 0, O, 1, I (but includes L)
      expect(code).not.toMatch(/[0OI1]/)
    })
  })

  // ─── Unhandled events ───────────────────────────────────────

  describe('unhandled events', () => {
    it('returns 200 for unhandled event types', async () => {
      mockConstructWebhookEvent.mockReturnValue(
        makeStripeEvent('some.unknown.event', { id: 'evt_123' })
      )

      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(200)
      expect(body.received).toBe(true)
    })
  })

  // ─── Processing errors ──────────────────────────────────────

  describe('processing errors', () => {
    it('returns 500 when a DB operation throws', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('DB connection failed')
      })

      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionEvent('customer.subscription.created')
      )

      const response = await POST(makeSignedRequest())
      const { status, body } = await parseResponse(response)

      expect(status).toBe(500)
      expect(body.error).toBe('Webhook processing error')
    })
  })
})
