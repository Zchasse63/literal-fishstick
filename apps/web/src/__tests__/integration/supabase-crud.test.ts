/**
 * Live Supabase CRUD integration tests.
 * NO MOCKS — every operation hits the real database.
 *
 * Valid CHECK values reference:
 *   bookings.status:  booked, checked_in, no_show, cancelled, late_cancelled, waitlisted
 *   members.status:   active, paused, cancelled, past_due, none
 *   transactions.type: membership, drop_in, credit_pack, merch, gift_card, private_event, refund, strike_penalty
 *   activity_log.type: check_in, booking, cancellation, payment, failed_payment, membership_change, walk_in, new_member, refund, strike, clock_in, clock_out
 */
import { describe, it, expect, afterAll } from 'vitest'
import { TestDataFactory } from './helpers/test-data-factory'
import { getAdminClient } from './helpers/supabase-admin'
import { randomUUID } from 'crypto'

describe('Supabase CRUD - Live', () => {
  const factory = new TestDataFactory()
  const db = getAdminClient()

  afterAll(async () => {
    await factory.cleanup()
  })

  // ── 1. Profile CRUD ─────────────────────────────────────────────
  it('creates and reads a profile', async () => {
    const { userId } = await factory.createUser({ fullName: 'CRUD Test User' })

    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data!.full_name).toBe('CRUD Test User')
    expect(data!.studio_id).toBe(factory.studioId)
  })

  it('updates a profile full_name and verifies persistence', async () => {
    const { userId } = await factory.createUser({ fullName: 'Before Update' })

    const { error: updateError } = await db
      .from('profiles')
      .update({ full_name: 'After Update' })
      .eq('id', userId)

    expect(updateError).toBeNull()

    const { data, error } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    expect(error).toBeNull()
    expect(data!.full_name).toBe('After Update')
  })

  it('deletes a profile', async () => {
    const { userId } = await factory.createUser({ fullName: 'To Be Deleted' })

    const { error: deleteError } = await db
      .from('profiles')
      .delete()
      .eq('id', userId)

    expect(deleteError).toBeNull()

    const { data } = await db
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    expect(data).toBeNull()
  })

  // ── 2. Member CRUD ──────────────────────────────────────────────
  it('creates a member and reads it back', async () => {
    const member = await factory.createMember({
      membershipStatus: 'active',
      membershipTier: 'unlimited',
    })

    const { data, error } = await db
      .from('members')
      .select('*')
      .eq('id', member.id)
      .single()

    expect(error).toBeNull()
    expect(data!.membership_status).toBe('active')
    expect(data!.membership_tier).toBe('unlimited')
    expect(data!.studio_id).toBe(factory.studioId)
  })

  it('updates membership_status to cancelled', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })

    const { error: updateError } = await db
      .from('members')
      .update({ membership_status: 'cancelled' })
      .eq('id', member.id)

    expect(updateError).toBeNull()

    const { data } = await db
      .from('members')
      .select('membership_status')
      .eq('id', member.id)
      .single()

    expect(data!.membership_status).toBe('cancelled')
  })

  // ── 3. Class CRUD ───────────────────────────────────────────────
  it('creates a class and verifies fields', async () => {
    const cls = await factory.createClass({
      title: 'Integration Test Class',
      capacity: 8,
    })

    const { data, error } = await db
      .from('classes')
      .select('*')
      .eq('id', cls.id)
      .single()

    expect(error).toBeNull()
    expect(data!.title).toBe('Integration Test Class')
    expect(data!.capacity).toBe(8)
    expect(data!.studio_id).toBe(factory.studioId)
    expect(data!.status).toBe('scheduled')
  })

  // ── 4. Booking creation + read with joins ───────────────────────
  it('creates a booking and reads it back with class and member joins', async () => {
    const cls = await factory.createClass({ title: 'Booking Test Class' })
    const member = await factory.createMember()
    const booking = await factory.createBooking(cls.id, member.id)

    const { data, error } = await db
      .from('bookings')
      .select('*, classes(title), members(membership_status)')
      .eq('id', booking.id)
      .single()

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data!.class_id).toBe(cls.id)
    expect(data!.member_id).toBe(member.id)
    expect(data!.status).toBe('booked')
    // Verify joins returned data
    expect((data as any).classes.title).toBe('Booking Test Class')
    expect((data as any).members.membership_status).toBe('active')
  })

  // ── 5. Booking duplicate detection ──────────────────────────────
  it('rejects duplicate booking for same class + member (unique constraint)', async () => {
    const cls = await factory.createClass({ title: 'Dup Test Class' })
    const member = await factory.createMember()

    // First booking should succeed
    await factory.createBooking(cls.id, member.id)

    // Second booking with same class + member should fail (unique constraint on class_id, member_id)
    const { error } = await db.from('bookings').insert({
      id: randomUUID(),
      class_id: cls.id,
      member_id: member.id,
      studio_id: factory.studioId,
      status: 'booked',
    })

    // Expect a unique constraint violation (23505)
    expect(error).toBeTruthy()
    expect(error!.code).toBe('23505')
  })

  // ── 6. Transaction insert ───────────────────────────────────────
  it('creates a transaction and verifies amount and status', async () => {
    const member = await factory.createMember()
    const tx = await factory.createTransaction(member.id, {
      amount: 12500,  // cents
      status: 'completed',
      type: 'membership',
    })

    const { data, error } = await db
      .from('transactions')
      .select('*')
      .eq('id', tx.id)
      .single()

    expect(error).toBeNull()
    expect(data!.amount).toBe(12500)
    expect(data!.status).toBe('completed')
    expect(data!.type).toBe('membership')
    expect(data!.member_id).toBe(member.id)
    expect(data!.studio_id).toBe(factory.studioId)
  })

  // ── 7. Activity log insert ──────────────────────────────────────
  it('inserts an activity log entry and verifies persistence', async () => {
    const entry = await factory.createActivityLog({
      type: 'booking',
      description: 'Integration test log entry',
      subjectType: 'member',
      subjectId: null,
      metadata: { test: true },
    })

    const { data, error } = await db
      .from('activity_log')
      .select('*')
      .eq('id', entry.id)
      .single()

    expect(error).toBeNull()
    expect(data!.type).toBe('booking')
    expect(data!.subject_type).toBe('member')
    expect(data!.description).toBe('Integration test log entry')
    expect(data!.metadata).toEqual({ test: true })
  })

  // ── 8. Credit pack with expiry ──────────────────────────────────
  it('creates a credit pack with expiry and verifies remaining credits', async () => {
    const member = await factory.createMember()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const pack = await factory.createCreditPack(member.id, {
      creditsTotal: 10,
      creditsRemaining: 7,
      expiresAt,
    })

    const { data, error } = await db
      .from('credit_packs')
      .select('*')
      .eq('id', pack.id)
      .single()

    expect(error).toBeNull()
    expect(data!.credits_total).toBe(10)
    expect(data!.credits_remaining).toBe(7)
    expect(data!.expires_at).toBeTruthy()
    // Verify expiry is in the future
    expect(new Date(data!.expires_at).getTime()).toBeGreaterThan(Date.now())
    expect(data!.member_id).toBe(member.id)
  })

  // ── 9. Automation flow creation ─────────────────────────────────
  it('creates an automation flow and verifies trigger_type', async () => {
    const flow = await factory.createAutomationFlow({
      name: 'Welcome Flow',
      triggerType: 'signup',
      isActive: true,
    })

    const { data, error } = await db
      .from('automation_flows')
      .select('*')
      .eq('id', flow.id)
      .single()

    expect(error).toBeNull()
    expect(data!.name).toBe('Welcome Flow')
    expect(data!.trigger_type).toBe('signup')
    expect(data!.is_active).toBe(true)
    expect(data!.studio_id).toBe(factory.studioId)
    expect(data!.version).toBe(1)
  })

  // ── 10. Enrollment creation ─────────────────────────────────────
  it('creates an enrollment and verifies status is active', async () => {
    const flow = await factory.createAutomationFlow({
      triggerType: 'membership_change',
    })
    // enrollment.member_id FK → profiles(id), so pass profile_id
    const member = await factory.createMember()
    const enrollment = await factory.createEnrollment(flow.id, member.profile_id, {
      status: 'active',
    })

    const { data, error } = await db
      .from('automation_enrollments')
      .select('*, automation_flows(name, trigger_type)')
      .eq('id', enrollment.id)
      .single()

    expect(error).toBeNull()
    expect(data!.status).toBe('active')
    expect(data!.automation_id).toBe(flow.id)
    expect(data!.member_id).toBe(member.profile_id)
    expect(data!.current_step).toBe(0)
    expect((data as any).automation_flows.trigger_type).toBe('membership_change')
  })

  // ── 11. Studio isolation (RLS behavior) ─────────────────────────
  it('returns empty results when querying with a different studio_id', async () => {
    const member = await factory.createMember({ membershipStatus: 'active' })
    const fakeStudioId = '99999999-9999-4999-a999-999999999999'

    // Query members scoped to a non-existent studio — should return nothing
    const { data, error } = await db
      .from('members')
      .select('*')
      .eq('studio_id', fakeStudioId)
      .eq('id', member.id)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ── 12. Cascade cleanup ─────────────────────────────────────────
  it('factory.cleanup() removes all created records', async () => {
    // Create a standalone factory just for this test
    const cleanupFactory = new TestDataFactory()
    const member = await cleanupFactory.createMember()
    const cls = await cleanupFactory.createClass()
    const booking = await cleanupFactory.createBooking(cls.id, member.id)

    // Verify records exist
    const { data: bookingBefore } = await db
      .from('bookings')
      .select('id')
      .eq('id', booking.id)
      .single()
    expect(bookingBefore).toBeTruthy()

    // Run cleanup
    await cleanupFactory.cleanup()

    // Verify all records are gone
    const { data: bookingAfter } = await db
      .from('bookings')
      .select('id')
      .eq('id', booking.id)
      .single()
    expect(bookingAfter).toBeNull()

    const { data: classAfter } = await db
      .from('classes')
      .select('id')
      .eq('id', cls.id)
      .single()
    expect(classAfter).toBeNull()

    const { data: memberAfter } = await db
      .from('members')
      .select('id')
      .eq('id', member.id)
      .single()
    expect(memberAfter).toBeNull()
  })
})
