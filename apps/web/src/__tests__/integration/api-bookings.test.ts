/**
 * Live integration tests for booking API capacity enforcement logic.
 * NO MOCKS — every operation hits the real Supabase database.
 *
 * Valid bookings.status CHECK: booked, checked_in, no_show, cancelled, late_cancelled, waitlisted
 */
import { describe, it, expect, afterAll } from 'vitest'
import { TestDataFactory } from './helpers/test-data-factory'
import { getAdminClient } from './helpers/supabase-admin'

describe('Booking API Logic - Live', () => {
  const factory = new TestDataFactory()
  const db = getAdminClient()

  afterAll(async () => {
    await factory.cleanup()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // Capacity enforcement
  // ═══════════════════════════════════════════════════════════════════════

  it('capacity count is accurate with booked bookings', async () => {
    const cls = await factory.createClass({ title: 'Capacity Count Class', capacity: 3 })
    const member1 = await factory.createMember()
    const member2 = await factory.createMember()

    await factory.createBooking(cls.id, member1.id, { status: 'booked' })
    await factory.createBooking(cls.id, member2.id, { status: 'booked' })

    // Replicate the API's capacity check query
    const { count, error } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
      .eq('studio_id', factory.studioId)
      .in('status', ['booked', 'checked_in'])

    expect(error).toBeNull()
    expect(count).toBe(2)
  })

  it('detects full capacity when bookings match class capacity', async () => {
    const cls = await factory.createClass({ title: 'Full Capacity Class', capacity: 2 })
    const member1 = await factory.createMember()
    const member2 = await factory.createMember()

    await factory.createBooking(cls.id, member1.id, { status: 'booked' })
    await factory.createBooking(cls.id, member2.id, { status: 'booked' })

    // Replicate the API's capacity check
    const { count, error } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
      .eq('studio_id', factory.studioId)
      .in('status', ['booked', 'checked_in'])

    expect(error).toBeNull()

    // Fetch class capacity
    const { data: classData } = await db
      .from('classes')
      .select('capacity')
      .eq('id', cls.id)
      .single()

    expect((count ?? 0) >= classData!.capacity).toBe(true)
  })

  // ═══════════════════════════════════════════════════════════════════════
  // Duplicate booking detection
  // ═══════════════════════════════════════════════════════════════════════

  it('detects duplicate booking for same class + member + studio', async () => {
    const cls = await factory.createClass({ title: 'Dup Detection Class' })
    const member = await factory.createMember()

    const originalBooking = await factory.createBooking(cls.id, member.id, { status: 'booked' })

    // Replicate the API's duplicate check query
    const { data: existingBooking } = await db
      .from('bookings')
      .select('id')
      .eq('class_id', cls.id)
      .eq('member_id', member.id)
      .eq('studio_id', factory.studioId)
      .in('status', ['booked', 'checked_in'])
      .maybeSingle()

    expect(existingBooking).toBeTruthy()
    expect(existingBooking!.id).toBe(originalBooking.id)
  })

  it('cancelled booking does not block new booking query', async () => {
    const cls = await factory.createClass({ title: 'Cancelled Unblock Class' })
    const member = await factory.createMember()

    // Create a cancelled booking
    await factory.createBooking(cls.id, member.id, { status: 'cancelled' })

    // Query for active bookings — should find nothing
    const { data: existingBooking } = await db
      .from('bookings')
      .select('id')
      .eq('class_id', cls.id)
      .eq('member_id', member.id)
      .eq('studio_id', factory.studioId)
      .in('status', ['booked', 'checked_in'])
      .maybeSingle()

    expect(existingBooking).toBeNull()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // Activity log
  // ═══════════════════════════════════════════════════════════════════════

  it('activity log entry is persisted with correct metadata', async () => {
    const cls = await factory.createClass({ title: 'Activity Log Class' })
    const member = await factory.createMember()
    const booking = await factory.createBooking(cls.id, member.id)

    // Replicate the API's activity log insert
    const logEntry = await factory.createActivityLog({
      type: 'booking',
      description: 'Booking created for class',
      subjectType: 'booking',
      subjectId: booking.id,
      metadata: { class_id: cls.id, member_id: member.id },
    })

    const { data, error } = await db
      .from('activity_log')
      .select('*')
      .eq('id', logEntry.id)
      .single()

    expect(error).toBeNull()
    expect(data!.type).toBe('booking')
    expect(data!.subject_type).toBe('booking')
    expect(data!.subject_id).toBe(booking.id)
    expect(data!.metadata).toEqual({ class_id: cls.id, member_id: member.id })
    expect(data!.studio_id).toBe(factory.studioId)
  })

  // ═══════════════════════════════════════════════════════════════════════
  // checked_in status counts toward capacity
  // ═══════════════════════════════════════════════════════════════════════

  it('booking with checked_in status counts toward capacity', async () => {
    const cls = await factory.createClass({ title: 'CheckedIn Capacity Class', capacity: 3 })
    const member1 = await factory.createMember()
    const member2 = await factory.createMember()

    await factory.createBooking(cls.id, member1.id, { status: 'booked' })
    await factory.createBooking(cls.id, member2.id, { status: 'checked_in' })

    // Count active bookings — both booked and checked_in should be included
    const { count, error } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
      .eq('studio_id', factory.studioId)
      .in('status', ['booked', 'checked_in'])

    expect(error).toBeNull()
    expect(count).toBe(2)

    // Capacity is 3 so one more slot should be available
    const { data: classData } = await db
      .from('classes')
      .select('capacity')
      .eq('id', cls.id)
      .single()

    expect((count ?? 0) < classData!.capacity).toBe(true)
  })
})
