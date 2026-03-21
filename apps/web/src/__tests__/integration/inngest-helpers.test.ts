/**
 * Live integration tests for Inngest automation helpers.
 * NO MOCKS — every operation hits the real Supabase database.
 *
 * NOTE: automation_enrollments.member_id FK → profiles(id), NOT members(id).
 * For enrollment creation, pass profile_id. For checkExitConditions,
 * the helper queries bookings/members by member_id, so pass the appropriate
 * ID depending on what's being checked.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { TestDataFactory } from './helpers/test-data-factory'
import { getAdminClient } from './helpers/supabase-admin'
import {
  canEnrollMember,
  checkExitConditions,
  recordStepExecution,
  completeEnrollment,
  exitEnrollment,
  failEnrollment,
} from '@/lib/inngest/helpers'

describe('Inngest Helpers - Live', () => {
  const factory = new TestDataFactory()
  const db = getAdminClient()

  afterAll(async () => {
    await factory.cleanup()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // canEnrollMember
  // ═══════════════════════════════════════════════════════════════════════

  describe('canEnrollMember', () => {
    it('returns true when no enrollments exist', async () => {
      const flow = await factory.createAutomationFlow({ name: 'Empty Flow' })
      const member = await factory.createMember()

      // canEnrollMember queries enrollment by member_id which is profile_id in DB
      const result = await canEnrollMember(
        { id: flow.id, studio_id: flow.studio_id },
        member.profile_id,
      )

      expect(result).toBe(true)
    })

    it('returns false when active enrollment exists', async () => {
      const flow = await factory.createAutomationFlow({ name: 'Active Block Flow' })
      const member = await factory.createMember()
      await factory.createEnrollment(flow.id, member.profile_id, { status: 'active' })

      const result = await canEnrollMember(
        { id: flow.id, studio_id: flow.studio_id },
        member.profile_id,
      )

      expect(result).toBe(false)
    })

    it('returns false when paused enrollment exists', async () => {
      const flow = await factory.createAutomationFlow({ name: 'Paused Block Flow' })
      const member = await factory.createMember()
      await factory.createEnrollment(flow.id, member.profile_id, { status: 'paused' })

      const result = await canEnrollMember(
        { id: flow.id, studio_id: flow.studio_id },
        member.profile_id,
      )

      expect(result).toBe(false)
    })

    it('returns false when allow_reenrollment=false and completed enrollment exists', async () => {
      const flow = await factory.createAutomationFlow({
        name: 'No Reenroll Flow',
        allowReenrollment: false,
      })
      const member = await factory.createMember()
      await factory.createEnrollment(flow.id, member.profile_id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })

      const result = await canEnrollMember(
        { id: flow.id, studio_id: flow.studio_id, allow_reenrollment: false },
        member.profile_id,
      )

      expect(result).toBe(false)
    })

    it('returns true when allow_reenrollment=false but only failed enrollments exist', async () => {
      const flow = await factory.createAutomationFlow({
        name: 'Failed Only Flow',
        allowReenrollment: false,
      })
      const member = await factory.createMember()
      await factory.createEnrollment(flow.id, member.profile_id, {
        status: 'failed',
        exitReason: 'step_error',
      })

      const result = await canEnrollMember(
        { id: flow.id, studio_id: flow.studio_id, allow_reenrollment: false },
        member.profile_id,
      )

      expect(result).toBe(true)
    })

    it('returns true when allow_reenrollment=true and past cooldown window', async () => {
      const flow = await factory.createAutomationFlow({
        name: 'Past Cooldown Flow',
        allowReenrollment: true,
        cooldownDays: 1,
      })
      const member = await factory.createMember()

      // Create a completed enrollment with completed_at 3 days ago
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      await factory.createEnrollment(flow.id, member.profile_id, {
        status: 'completed',
        completedAt: threeDaysAgo,
      })

      const result = await canEnrollMember(
        { id: flow.id, studio_id: flow.studio_id, allow_reenrollment: true, cooldown_days: 1 },
        member.profile_id,
      )

      expect(result).toBe(true)
    })

    it('returns false when allow_reenrollment=true but within cooldown window', async () => {
      const flow = await factory.createAutomationFlow({
        name: 'In Cooldown Flow',
        allowReenrollment: true,
        cooldownDays: 30,
      })
      const member = await factory.createMember()

      // Create a completed enrollment with completed_at just now
      await factory.createEnrollment(flow.id, member.profile_id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })

      const result = await canEnrollMember(
        { id: flow.id, studio_id: flow.studio_id, allow_reenrollment: true, cooldown_days: 30 },
        member.profile_id,
      )

      expect(result).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // checkExitConditions
  // ═══════════════════════════════════════════════════════════════════════

  describe('checkExitConditions', () => {
    it('returns null for empty exit conditions', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember()
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id)

      const result = await checkExitConditions(
        {
          id: enrollment.id,
          member_id: member.id,  // checkExitConditions queries members/bookings by members.id
          automation_id: flow.id,
          studio_id: factory.studioId,
          enrolled_at: enrollment.enrolled_at,
        },
        [],
      )

      expect(result).toBeNull()
    })

    it('returns booking_made when member has a booking since enrolled_at', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember()

      // Create enrollment with enrolled_at slightly in the past
      const enrolledAt = new Date(Date.now() - 60000).toISOString()
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id)

      // Create a booking after enrollment
      const cls = await factory.createClass()
      await factory.createBooking(cls.id, member.id)

      const result = await checkExitConditions(
        {
          id: enrollment.id,
          member_id: member.id,  // booking_made checks bookings.member_id which FK to members(id)
          automation_id: flow.id,
          studio_id: factory.studioId,
          enrolled_at: enrolledAt,
        },
        [{ type: 'booking_made' }],
      )

      expect(result).toBe('booking_made')
    })

    it('returns membership_active when member status is active', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember({ membershipStatus: 'active' })
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id)

      const result = await checkExitConditions(
        {
          id: enrollment.id,
          member_id: member.id,  // membership_active checks members.id
          automation_id: flow.id,
          studio_id: factory.studioId,
          enrolled_at: enrollment.enrolled_at,
        },
        [{ type: 'membership_active' }],
      )

      expect(result).toBe('membership_active')
    })

    it('returns null for manual exit condition (never auto-resolves)', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember({ membershipStatus: 'active' })
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id)

      const result = await checkExitConditions(
        {
          id: enrollment.id,
          member_id: member.id,
          automation_id: flow.id,
          studio_id: factory.studioId,
          enrolled_at: enrollment.enrolled_at,
        },
        [{ type: 'manual' }],
      )

      expect(result).toBeNull()
    })

    it('returns first matching condition when multiple conditions exist', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember({ membershipStatus: 'active' })
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id)

      // Member is active, so 'membership_active' should match.
      // 'booking_made' is listed first but the member has no booking, so it won't match.
      // 'membership_active' is second and should be the first to resolve.
      const result = await checkExitConditions(
        {
          id: enrollment.id,
          member_id: member.id,
          automation_id: flow.id,
          studio_id: factory.studioId,
          enrolled_at: enrollment.enrolled_at,
        },
        [
          { type: 'booking_made' },
          { type: 'membership_active' },
          { type: 'manual' },
        ],
      )

      expect(result).toBe('membership_active')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // recordStepExecution
  // ═══════════════════════════════════════════════════════════════════════

  describe('recordStepExecution', () => {
    it('appends step record to empty history and updates current_step', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember()
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id, {
        stepHistory: [],
        currentStep: 0,
      })

      await recordStepExecution(
        enrollment.id,
        1,
        'send_email',
        'completed',
        { template: 'welcome' },
      )

      const { data, error } = await db
        .from('automation_enrollments')
        .select('step_history, current_step, last_processed_at')
        .eq('id', enrollment.id)
        .single()

      expect(error).toBeNull()
      expect(data!.current_step).toBe(1)
      expect(data!.last_processed_at).toBeTruthy()

      const history = data!.step_history as Array<Record<string, unknown>>
      expect(history).toHaveLength(1)
      expect(history[0].step_index).toBe(1)
      expect(history[0].step_type).toBe('send_email')
      expect(history[0].status).toBe('completed')
      expect(history[0].metadata).toEqual({ template: 'welcome' })
    })

    it('appends to existing history preserving previous entries', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember()
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id, {
        stepHistory: [],
        currentStep: 0,
      })

      // Record first step
      await recordStepExecution(enrollment.id, 0, 'wait', 'completed')

      // Record second step
      await recordStepExecution(enrollment.id, 1, 'send_email', 'completed', { subject: 'Hi' })

      const { data, error } = await db
        .from('automation_enrollments')
        .select('step_history, current_step')
        .eq('id', enrollment.id)
        .single()

      expect(error).toBeNull()
      expect(data!.current_step).toBe(1)

      const history = data!.step_history as Array<Record<string, unknown>>
      expect(history).toHaveLength(2)
      expect(history[0].step_index).toBe(0)
      expect(history[0].step_type).toBe('wait')
      expect(history[1].step_index).toBe(1)
      expect(history[1].step_type).toBe('send_email')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // Enrollment lifecycle: completeEnrollment / exitEnrollment / failEnrollment
  // ═══════════════════════════════════════════════════════════════════════

  describe('enrollment lifecycle', () => {
    it('completeEnrollment sets status=completed and completed_at', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember()
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id, { status: 'active' })

      await completeEnrollment(enrollment.id)

      const { data, error } = await db
        .from('automation_enrollments')
        .select('status, completed_at, last_processed_at')
        .eq('id', enrollment.id)
        .single()

      expect(error).toBeNull()
      expect(data!.status).toBe('completed')
      expect(data!.completed_at).toBeTruthy()
      expect(data!.last_processed_at).toBeTruthy()
    })

    it('exitEnrollment sets status=exited, exit_reason, and exited_at', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember()
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id, { status: 'active' })

      await exitEnrollment(enrollment.id, 'booking_made')

      const { data, error } = await db
        .from('automation_enrollments')
        .select('status, exit_reason, exited_at, last_processed_at')
        .eq('id', enrollment.id)
        .single()

      expect(error).toBeNull()
      expect(data!.status).toBe('exited')
      expect(data!.exit_reason).toBe('booking_made')
      expect(data!.exited_at).toBeTruthy()
      expect(data!.last_processed_at).toBeTruthy()
    })

    it('failEnrollment sets status=failed and exit_reason', async () => {
      const flow = await factory.createAutomationFlow()
      const member = await factory.createMember()
      const enrollment = await factory.createEnrollment(flow.id, member.profile_id, { status: 'active' })

      await failEnrollment(enrollment.id, 'step_3_email_send_failed')

      const { data, error } = await db
        .from('automation_enrollments')
        .select('status, exit_reason, last_processed_at')
        .eq('id', enrollment.id)
        .single()

      expect(error).toBeNull()
      expect(data!.status).toBe('failed')
      expect(data!.exit_reason).toBe('step_3_email_send_failed')
      expect(data!.last_processed_at).toBeTruthy()
    })
  })
})
