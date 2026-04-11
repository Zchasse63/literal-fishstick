/**
 * T15/T16/T17 — Stripe endpoint contract tests.
 *
 * Verifies the 3 Stripe-adjacent endpoints work correctly in both live and
 * dry-run mode without requiring a real Stripe API key:
 *
 *   - POST /api/members/[id]/cancel     — T15 Memberships Cancel
 *   - POST /api/transactions/[id]/refund — T16 Revenue Refund
 *   - POST /api/members/[id]/credit     — T17 Issue Credit (no Stripe)
 *
 * When STRIPE_SECRET_KEY is missing, the Stripe helpers return synthetic
 * dry_run ids and the DB side still writes real rows. These tests only
 * assert the DB contract + response shape — real Stripe interactions are
 * covered by integration tests that require a live test key.
 */
import { test, expect } from '@playwright/test'
import { testDb, seedMember, seedTransaction } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'
import { randomUUID } from 'node:crypto'

test.describe('Stripe endpoints — Memberships Cancel (T15)', () => {
  test('T15 — cancel member with no Stripe subscription succeeds (DB-only) @p0', async ({
    page,
  }) => {
    const m = await seedMember({ fullName: 'E2EStripeCancel_NoSub' })

    try {
      const response = await page.request.post(
        `/api/members/${m.profileId}/cancel`,
        { data: { immediately: true, reason: 'E2E test' } }
      )

      expect(response.ok()).toBe(true)
      const payload = (await response.json()) as {
        data: {
          cancelled_immediately: boolean
          cancel_at_period_end: boolean
          stripe: { subscription_id: string | null; dry_run: boolean }
        }
      }

      expect(payload.data.cancelled_immediately).toBe(true)
      expect(payload.data.cancel_at_period_end).toBe(false)
      // No subscription id → stripe side is a no-op regardless of dry-run flag
      expect(payload.data.stripe.subscription_id).toBeNull()

      // Verify DB side: membership_status is now cancelled
      const { data: updated } = await testDb
        .from('members')
        .select('membership_status')
        .eq('id', m.memberId)
        .single()
      expect(updated?.membership_status).toBe('cancelled')

      // Verify activity_log entry was written
      const since = new Date(Date.now() - 10_000).toISOString()
      const { count } = await testDb
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', DEFAULT_STUDIO_ID)
        .eq('subject_id', m.profileId)
        .eq('type', 'membership_change')
        .gte('created_at', since)
      expect(count ?? 0).toBeGreaterThan(0)
    } finally {
      await testDb.from('activity_log').delete().eq('subject_id', m.profileId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T15 — cancel_at_period_end keeps membership_status=active @p1', async ({
    page,
  }) => {
    const m = await seedMember({ fullName: 'E2EStripeCancel_Scheduled' })

    try {
      const response = await page.request.post(
        `/api/members/${m.profileId}/cancel`,
        { data: { immediately: false } }
      )

      expect(response.ok()).toBe(true)
      const payload = (await response.json()) as {
        data: { cancel_at_period_end: boolean; effective: string }
      }
      expect(payload.data.cancel_at_period_end).toBe(true)
      expect(payload.data.effective).toBe('end_of_billing_period')

      // Member row is NOT flipped immediately — that happens via webhook on
      // period end. status should still be whatever seed left it as.
      const { data: updated } = await testDb
        .from('members')
        .select('membership_status')
        .eq('id', m.memberId)
        .single()
      expect(updated?.membership_status).not.toBe('cancelled')
    } finally {
      await testDb.from('activity_log').delete().eq('subject_id', m.profileId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T15 — double-cancel returns 409 @p1', async ({ page }) => {
    const m = await seedMember({ fullName: 'E2EStripeCancel_Double' })

    // First cancel (immediate)
    await page.request.post(`/api/members/${m.profileId}/cancel`, {
      data: { immediately: true },
    })

    try {
      // Second cancel should fail
      const response = await page.request.post(
        `/api/members/${m.profileId}/cancel`,
        { data: { immediately: true } }
      )
      expect(response.status()).toBe(409)
    } finally {
      await testDb.from('activity_log').delete().eq('subject_id', m.profileId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })
})

test.describe('Stripe endpoints — Revenue Refund (T16)', () => {
  test('T16 — full refund of a completed transaction writes refund row @p0', async ({
    page,
  }) => {
    const m = await seedMember({ fullName: 'E2EStripeRefund_M' })
    const tx = await seedTransaction({
      memberId: m.memberId,
      amount: 50.0,
      type: 'drop_in',
      status: 'completed',
    })

    try {
      const response = await page.request.post(
        `/api/transactions/${tx.transactionId}/refund`,
        { data: { reason: 'requested_by_customer' } }
      )

      expect(response.ok()).toBe(true)
      const payload = (await response.json()) as {
        data: {
          refund_transaction: { id: string; amount: number; type: string }
          amount_refunded: number
          remaining_refundable: number
          stripe: { dry_run: boolean }
        }
      }

      expect(payload.data.refund_transaction.type).toBe('refund')
      expect(Number(payload.data.refund_transaction.amount)).toBe(-50)
      expect(payload.data.amount_refunded).toBe(50)
      expect(payload.data.remaining_refundable).toBe(0)

      // Verify DB side: a new transactions row with negative amount
      const { count } = await testDb
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('reference_id', tx.transactionId)
        .eq('type', 'refund')
      expect(count ?? 0).toBeGreaterThanOrEqual(1)
    } finally {
      await testDb
        .from('transactions')
        .delete()
        .eq('reference_id', tx.transactionId)
      await testDb.from('transactions').delete().eq('id', tx.transactionId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T16 — partial refund leaves remaining balance @p0', async ({ page }) => {
    const m = await seedMember({ fullName: 'E2EStripeRefund_Partial' })
    const tx = await seedTransaction({
      memberId: m.memberId,
      amount: 100.0,
      type: 'drop_in',
      status: 'completed',
    })

    try {
      // First partial refund: $40
      const r1 = await page.request.post(
        `/api/transactions/${tx.transactionId}/refund`,
        { data: { amount: 40 } }
      )
      expect(r1.ok()).toBe(true)
      const p1 = (await r1.json()) as { data: { remaining_refundable: number } }
      expect(p1.data.remaining_refundable).toBe(60)

      // Second partial refund: $30
      const r2 = await page.request.post(
        `/api/transactions/${tx.transactionId}/refund`,
        { data: { amount: 30 } }
      )
      expect(r2.ok()).toBe(true)
      const p2 = (await r2.json()) as { data: { remaining_refundable: number } }
      expect(p2.data.remaining_refundable).toBe(30)

      // Third refund that would exceed the balance → 409
      const r3 = await page.request.post(
        `/api/transactions/${tx.transactionId}/refund`,
        { data: { amount: 50 } }
      )
      expect(r3.status()).toBe(409)
    } finally {
      await testDb
        .from('transactions')
        .delete()
        .eq('reference_id', tx.transactionId)
      await testDb.from('transactions').delete().eq('id', tx.transactionId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T16 — refund of nonexistent transaction returns 404 @p1', async ({
    page,
  }) => {
    const fakeId = randomUUID()
    const response = await page.request.post(
      `/api/transactions/${fakeId}/refund`,
      { data: {} }
    )
    expect(response.status()).toBe(404)
  })
})

test.describe('Stripe endpoints — Issue Credit (T17)', () => {
  test('T17 — positive credit bumps wallet_balance + writes wallet_transaction @p0', async ({
    page,
  }) => {
    const m = await seedMember({ fullName: 'E2EStripeCredit_Pos' })

    try {
      const response = await page.request.post(
        `/api/members/${m.profileId}/credit`,
        { data: { amount: 25.5, reason: 'Goodwill credit for E2E test' } }
      )

      expect(response.ok()).toBe(true)
      const payload = (await response.json()) as {
        data: {
          balance_before: number
          balance_after: number
          amount: number
          wallet_transaction: { id: string; type: string }
        }
      }

      expect(payload.data.amount).toBe(25.5)
      expect(payload.data.balance_after).toBe(payload.data.balance_before + 25.5)
      // Schema CHECK allows only adjustment/purchase/refund/etc — credits
      // and debits both map to 'adjustment' distinguished by sign.
      expect(payload.data.wallet_transaction.type).toBe('adjustment')

      // Verify denormalized balance on members row. DB stores cents as
      // integer; payload.data.balance_after is dollars. Compare against the
      // cents value (multiply by 100) or the route's amount_cents field.
      const { data: updated } = await testDb
        .from('members')
        .select('wallet_balance')
        .eq('id', m.memberId)
        .single()
      expect(Number(updated?.wallet_balance)).toBe(
        Math.round(payload.data.balance_after * 100)
      )

      // Verify wallet_transactions row exists
      const { count } = await testDb
        .from('wallet_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('id', payload.data.wallet_transaction.id)
      expect(count).toBe(1)
    } finally {
      await testDb.from('wallet_transactions').delete().eq('member_id', m.memberId)
      await testDb.from('activity_log').delete().eq('subject_id', m.profileId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T17 — negative credit (debit) works when balance is sufficient @p1', async ({
    page,
  }) => {
    const m = await seedMember({ fullName: 'E2EStripeCredit_Neg' })

    // First add $50 so we can debit
    await page.request.post(`/api/members/${m.profileId}/credit`, {
      data: { amount: 50, reason: 'Setup for debit test' },
    })

    try {
      const response = await page.request.post(
        `/api/members/${m.profileId}/credit`,
        { data: { amount: -20, reason: 'Debit for E2E test' } }
      )

      expect(response.ok()).toBe(true)
      const payload = (await response.json()) as {
        data: { balance_after: number; wallet_transaction: { type: string } }
      }
      expect(payload.data.balance_after).toBe(30)
      expect(payload.data.wallet_transaction.type).toBe('adjustment')
    } finally {
      await testDb.from('wallet_transactions').delete().eq('member_id', m.memberId)
      await testDb.from('activity_log').delete().eq('subject_id', m.profileId)
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T17 — debit exceeding balance returns 409 @p1', async ({ page }) => {
    const m = await seedMember({ fullName: 'E2EStripeCredit_Overdraft' })

    try {
      // Try to debit $100 from a fresh wallet (balance = 0)
      const response = await page.request.post(
        `/api/members/${m.profileId}/credit`,
        { data: { amount: -100, reason: 'Overdraft attempt' } }
      )
      expect(response.status()).toBe(409)
    } finally {
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T17 — zero-amount credit returns 400 @p1', async ({ page }) => {
    const m = await seedMember({ fullName: 'E2EStripeCredit_Zero' })

    try {
      const response = await page.request.post(
        `/api/members/${m.profileId}/credit`,
        { data: { amount: 0, reason: 'no-op' } }
      )
      expect(response.status()).toBe(400)
    } finally {
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })

  test('T17 — missing reason returns 400 @p1', async ({ page }) => {
    const m = await seedMember({ fullName: 'E2EStripeCredit_NoReason' })

    try {
      const response = await page.request.post(
        `/api/members/${m.profileId}/credit`,
        { data: { amount: 10 } }
      )
      expect(response.status()).toBe(400)
    } finally {
      await testDb.from('members').delete().eq('id', m.memberId)
      await testDb.from('profiles').delete().eq('id', m.profileId)
    }
  })
})
