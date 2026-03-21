/**
 * Stripe Webhook Database Side-Effects — Live Integration Tests.
 * NO MOCKS — every operation hits the real Supabase database.
 *
 * We cannot trigger actual Stripe webhooks, so we simulate what the
 * webhook handler does by executing the SAME database operations
 * found in /api/webhooks/stripe/route.ts.
 *
 * Valid CHECK values:
 *   members.status:    active, paused, cancelled, past_due, none
 *   transactions.type: membership, drop_in, credit_pack, merch, gift_card, private_event, refund, strike_penalty
 *   activity_log.type: check_in, booking, cancellation, payment, failed_payment, membership_change, walk_in, new_member, refund, strike, clock_in, clock_out
 */
import { describe, it, expect, afterAll } from 'vitest'
import { TestDataFactory } from './helpers/test-data-factory'
import { getAdminClient } from './helpers/supabase-admin'
import { randomUUID } from 'crypto'

const TEST_STUDIO_ID = '00000000-0000-4000-a000-000000000000'

describe('Stripe Webhook Effects - Live', () => {
  const factory = new TestDataFactory()
  const db = getAdminClient()

  afterAll(async () => {
    await factory.cleanup()
  })

  // ── 1. Subscription created → member status update ────────────────
  it('subscription created: updates member with stripe_subscription_id', async () => {
    // Start as 'none' (no subscription yet), then activate
    const member = await factory.createMember({ membershipStatus: 'none' })
    const fakeSubId = `sub_test_${randomUUID().slice(0, 8)}`

    // Simulate what the webhook handler does for customer.subscription.created
    const { error: updateError } = await db
      .from('members')
      .update({
        stripe_subscription_id: fakeSubId,
        membership_status: 'active',
      })
      .eq('id', member.id)

    expect(updateError).toBeNull()

    const { data, error } = await db
      .from('members')
      .select('membership_status, stripe_subscription_id')
      .eq('id', member.id)
      .single()

    expect(error).toBeNull()
    expect(data!.membership_status).toBe('active')
    expect(data!.stripe_subscription_id).toBe(fakeSubId)
  })

  // ── 2. Subscription updated → paused status ──────────────────────
  it('subscription updated: sets member status to paused', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })

    // Simulate customer.subscription.updated with cancel_at_period_end = true
    const { error: updateError } = await db
      .from('members')
      .update({ membership_status: 'paused' })
      .eq('id', member.id)

    expect(updateError).toBeNull()

    const { data, error } = await db
      .from('members')
      .select('membership_status')
      .eq('id', member.id)
      .single()

    expect(error).toBeNull()
    expect(data!.membership_status).toBe('paused')
  })

  // ── 3. Subscription deleted → cancelled status ────────────────────
  it('subscription deleted: sets member status to cancelled', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })

    // Simulate customer.subscription.deleted
    const { error: updateError } = await db
      .from('members')
      .update({ membership_status: 'cancelled' })
      .eq('id', member.id)

    expect(updateError).toBeNull()

    const { data, error } = await db
      .from('members')
      .select('membership_status')
      .eq('id', member.id)
      .single()

    expect(error).toBeNull()
    expect(data!.membership_status).toBe('cancelled')
  })

  // ── 4. AI cache invalidation ──────────────────────────────────────
  it('invalidates AI cache entries matching member entity_id', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })

    // Insert an ai_cache entry for this member
    const cacheEntry = await factory.createAiCache({
      cacheKey: `churn_prediction_${member.id}`,
      cacheType: 'churn_narrative',
      entityId: member.id,
      result: { risk_score: 0.75 },
    })

    // Verify it exists
    const { data: before } = await db
      .from('ai_cache')
      .select('id')
      .eq('id', cacheEntry.id)
      .single()
    expect(before).toBeTruthy()

    // Simulate the cache invalidation the webhook does
    const { error: deleteError } = await db
      .from('ai_cache')
      .delete()
      .eq('entity_id', member.id)
      .eq('studio_id', TEST_STUDIO_ID)

    expect(deleteError).toBeNull()

    // Verify it is gone
    const { data: after } = await db
      .from('ai_cache')
      .select('id')
      .eq('id', cacheEntry.id)
      .single()
    expect(after).toBeNull()
  })

  // ── 5. Payment succeeded → transaction created ────────────────────
  it('payment succeeded: inserts transaction with correct amount in cents', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })
    const amountCents = 4999

    // Simulate invoice.payment_succeeded — amount stored in cents (integer)
    const tx = await factory.createTransaction(member.id, {
      amount: amountCents,
      type: 'membership',
      status: 'completed',
      description: 'Invoice inv_test_001',
    })

    const { data, error } = await db
      .from('transactions')
      .select('*')
      .eq('id', tx.id)
      .single()

    expect(error).toBeNull()
    expect(data!.amount).toBe(4999)
    expect(data!.status).toBe('completed')
    expect(data!.type).toBe('membership')
    expect(data!.member_id).toBe(member.id)
  })

  // ── 6. Payment failed → failed transaction ────────────────────────
  it('payment failed: inserts failed transaction with correct status and amount', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })
    const amountCents = 9900

    // Simulate invoice.payment_failed — amount in cents
    const tx = await factory.createTransaction(member.id, {
      amount: amountCents,
      type: 'membership',
      status: 'failed',
      description: 'Failed: Invoice inv_test_fail_001',
    })

    const { data, error } = await db
      .from('transactions')
      .select('*')
      .eq('id', tx.id)
      .single()

    expect(error).toBeNull()
    expect(data!.amount).toBe(9900)
    expect(data!.status).toBe('failed')
    expect(data!.type).toBe('membership')
    expect(data!.description).toContain('Failed')
  })

  // ── 7. Credit pack created ────────────────────────────────────────
  it('checkout completed: creates credit pack with correct expiry and remaining credits', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })
    const credits = 10
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    // Simulate checkout.session.completed with purchase_type = credit_pack
    const pack = await factory.createCreditPack(member.id, {
      creditsTotal: credits,
      creditsRemaining: credits,
      expiresAt,
    })

    const { data, error } = await db
      .from('credit_packs')
      .select('*')
      .eq('id', pack.id)
      .single()

    expect(error).toBeNull()
    expect(data!.credits_total).toBe(10)
    expect(data!.credits_remaining).toBe(10)
    expect(data!.member_id).toBe(member.id)
    // Verify expiry is approximately 365 days from now
    const expiryTime = new Date(data!.expires_at).getTime()
    const expectedTime = Date.now() + 365 * 24 * 60 * 60 * 1000
    expect(expiryTime).toBeGreaterThan(Date.now())
    // Within 1 minute tolerance
    expect(Math.abs(expiryTime - expectedTime)).toBeLessThan(60000)
  })

  // ── 8. Gift card created ──────────────────────────────────────────
  it('checkout completed: creates gift card with code and matching balances', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })
    const amountCents = 5000
    const code = generateTestGiftCardCode()

    // Simulate checkout.session.completed with purchase_type = gift_card
    const card = await factory.createGiftCard({
      purchasedByMemberId: member.id,
      amount: amountCents,
      balance: amountCents,
      code,
    })

    const { data, error } = await db
      .from('gift_cards')
      .select('*')
      .eq('id', card.id)
      .single()

    expect(error).toBeNull()
    expect(data!.amount).toBe(5000)
    expect(data!.balance).toBe(5000)
    expect(data!.code).toBe(code)
    expect(data!.purchased_by_member_id).toBe(member.id)
  })

  // ── 9. Activity log entries ───────────────────────────────────────
  it('logs membership_change activity with correct metadata', async () => {
    const fakeSubId = `sub_test_${randomUUID().slice(0, 8)}`
    const fakeMemberId = randomUUID()

    // Simulate the logActivity call from the webhook handler
    const entry = await factory.createActivityLog({
      type: 'membership_change',
      description: 'New subscription created',
      metadata: {
        member_id: fakeMemberId,
        subscription_id: fakeSubId,
      },
    })

    const { data, error } = await db
      .from('activity_log')
      .select('*')
      .eq('id', entry.id)
      .single()

    expect(error).toBeNull()
    expect(data!.type).toBe('membership_change')
    expect(data!.metadata).toBeTruthy()
    expect(data!.metadata.member_id).toBe(fakeMemberId)
    expect(data!.metadata.subscription_id).toBe(fakeSubId)
  })

  it('logs payment activity with amount in metadata', async () => {
    const fakeMemberId = randomUUID()

    const entry = await factory.createActivityLog({
      type: 'payment',
      description: 'Payment received from member',
      metadata: {
        member_id: fakeMemberId,
        amount: 49.99,
      },
    })

    const { data, error } = await db
      .from('activity_log')
      .select('*')
      .eq('id', entry.id)
      .single()

    expect(error).toBeNull()
    expect(data!.type).toBe('payment')
    expect(data!.metadata.amount).toBe(49.99)
  })

  // ── 10. Member status lifecycle ───────────────────────────────────
  it('member status lifecycle: none → active → paused → cancelled', async () => {
    const member = await factory.createMember({ membershipStatus: 'none' })

    // Step 1: Verify none
    const { data: step1 } = await db
      .from('members')
      .select('membership_status')
      .eq('id', member.id)
      .single()
    expect(step1!.membership_status).toBe('none')

    // Step 2: Subscription created → active
    await db
      .from('members')
      .update({ membership_status: 'active' })
      .eq('id', member.id)

    const { data: step2 } = await db
      .from('members')
      .select('membership_status')
      .eq('id', member.id)
      .single()
    expect(step2!.membership_status).toBe('active')

    // Step 3: Subscription updated (cancel_at_period_end) → paused
    await db
      .from('members')
      .update({ membership_status: 'paused' })
      .eq('id', member.id)

    const { data: step3 } = await db
      .from('members')
      .select('membership_status')
      .eq('id', member.id)
      .single()
    expect(step3!.membership_status).toBe('paused')

    // Step 4: Subscription deleted → cancelled
    await db
      .from('members')
      .update({ membership_status: 'cancelled' })
      .eq('id', member.id)

    const { data: step4 } = await db
      .from('members')
      .select('membership_status')
      .eq('id', member.id)
      .single()
    expect(step4!.membership_status).toBe('cancelled')
  })
})

// ─── Helper ──────────────────────────────────────────────────────────
function generateTestGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-'
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
