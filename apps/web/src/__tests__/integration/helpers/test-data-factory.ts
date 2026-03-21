/**
 * Test Data Factory — creates real records in Supabase for integration tests.
 *
 * Every record is scoped to the test studio_id and tracked for cleanup.
 * Call factory.cleanup() in afterAll to remove all created records.
 *
 * IMPORTANT: Column names and CHECK constraint values match the LIVE Supabase schema exactly.
 *
 * Valid CHECK constraint values (as of 2026-03-20):
 *   bookings.status:     booked, checked_in, no_show, cancelled, late_cancelled, waitlisted
 *   members.status:      active, paused, cancelled, past_due, none
 *   members.tier:        unlimited, 10_class, 6_class
 *   transactions.type:   membership, drop_in, credit_pack, merch, gift_card, private_event, refund, strike_penalty
 *   credit_packs.type:   8_pack, 4_pack, sampler, gift_card, recurring, drop_in, 8_class_pack, 4_class_pack, sauna_sampler_3, first_class_free, imported_credits
 *   class_types.type:    open, guided, private
 *   activity_log.type:   check_in, booking, cancellation, payment, failed_payment, membership_change, walk_in, new_member, refund, strike, clock_in, clock_out
 *   enrollments.status:  active, completed, exited, paused, failed
 *
 * FK notes:
 *   automation_enrollments.member_id → profiles(id)  (NOT members.id)
 */
import { getAdminClient } from './supabase-admin'
import { randomUUID } from 'crypto'

const TEST_STUDIO_ID = '00000000-0000-4000-a000-000000000000'

interface TrackedRecord {
  table: string
  id: string
  isAuthUser?: boolean
}

export class TestDataFactory {
  private created: TrackedRecord[] = []
  private runId: string
  private _classTypeId: string | null = null

  constructor() {
    this.runId = randomUUID().slice(0, 8)
  }

  get studioId() {
    return TEST_STUDIO_ID
  }

  /**
   * Ensure a class_type exists (required FK for classes table).
   * Creates once and reuses for all classes in this factory instance.
   */
  async ensureClassType() {
    if (this._classTypeId) return this._classTypeId
    const db = getAdminClient()
    const id = randomUUID()

    const { error } = await db.from('class_types').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      name: `Test Type ${this.runId}`,
      type: 'open',  // CHECK: open, guided, private
      default_capacity: 12,
      default_duration_minutes: 60,
      color: '#4F46E5',
      is_active: true,
    })

    if (error) throw new Error(`Failed to create class_type: ${error.message}`)
    this.created.push({ table: 'class_types', id })
    this._classTypeId = id
    return id
  }

  /**
   * Create an auth user + profile in one shot.
   */
  async createUser(overrides: {
    email?: string
    fullName?: string
    roles?: string[]
    password?: string
  } = {}) {
    const db = getAdminClient()
    const email = overrides.email ?? `test-${this.runId}-${randomUUID().slice(0, 6)}@meridian-test.com`
    const password = overrides.password ?? `test-pass-${randomUUID()}`

    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`)
    const userId = authData.user.id
    this.created.push({ table: 'auth_users', id: userId, isAuthUser: true })

    const { error: profileError } = await db.from('profiles').insert({
      id: userId,
      email,
      full_name: overrides.fullName ?? `Test User ${this.runId}`,
      roles: overrides.roles ?? ['owner'],
      studio_id: TEST_STUDIO_ID,
    })

    if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`)
    this.created.push({ table: 'profiles', id: userId })

    return { userId, email, password }
  }

  /**
   * Create a member record. Requires a profile_id (NOT NULL in schema).
   * If no profileId provided, creates a user+profile first.
   * Returns the full member row (includes profile_id for FK references).
   */
  async createMember(overrides: {
    profileId?: string
    membershipStatus?: string  // CHECK: active, paused, cancelled, past_due, none
    membershipTier?: string    // CHECK: unlimited, 10_class, 6_class
    creditsRemaining?: number
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    // profile_id is NOT NULL — create a user if not provided
    let profileId = overrides.profileId
    if (!profileId) {
      const user = await this.createUser()
      profileId = user.userId
    }

    const { data, error } = await db.from('members').insert({
      id,
      profile_id: profileId,
      studio_id: TEST_STUDIO_ID,
      membership_status: overrides.membershipStatus ?? 'active',
      membership_tier: overrides.membershipTier ?? 'unlimited',
      credits_remaining: overrides.creditsRemaining ?? 0,
    }).select().single()

    if (error) throw new Error(`Failed to create member: ${error.message}`)
    this.created.push({ table: 'members', id })
    return data
  }

  /**
   * Create a class (schedule slot).
   * Schema: title, starts_at, ends_at, class_type_id (NOT NULL)
   */
  async createClass(overrides: {
    title?: string
    capacity?: number
    startsAt?: string
    endsAt?: string
    trainerId?: string
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()
    const classTypeId = await this.ensureClassType()
    const now = new Date()
    const startsAt = overrides.startsAt ?? new Date(now.getTime() + 3600000).toISOString()
    const endsAt = overrides.endsAt ?? new Date(now.getTime() + 7200000).toISOString()

    const { data, error } = await db.from('classes').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      class_type_id: classTypeId,
      title: overrides.title ?? `Test Class ${this.runId}`,
      capacity: overrides.capacity ?? 12,
      starts_at: startsAt,
      ends_at: endsAt,
      trainer_id: overrides.trainerId ?? null,
      status: 'scheduled',
    }).select().single()

    if (error) throw new Error(`Failed to create class: ${error.message}`)
    this.created.push({ table: 'classes', id })
    return data
  }

  /**
   * Create a booking for a class.
   * CHECK: booked, checked_in, no_show, cancelled, late_cancelled, waitlisted
   */
  async createBooking(classId: string, memberId: string, overrides: {
    status?: string
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('bookings').insert({
      id,
      class_id: classId,
      member_id: memberId,
      studio_id: TEST_STUDIO_ID,
      status: overrides.status ?? 'booked',
    }).select().single()

    if (error) throw new Error(`Failed to create booking: ${error.message}`)
    this.created.push({ table: 'bookings', id })
    return data
  }

  /**
   * Create a transaction.
   * Schema: amount is INTEGER (cents), type NOT NULL
   * CHECK type: membership, drop_in, credit_pack, merch, gift_card, private_event, refund, strike_penalty
   */
  async createTransaction(memberId: string, overrides: {
    amount?: number  // in cents
    type?: string
    status?: string
    description?: string
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('transactions').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      member_id: memberId,
      amount: overrides.amount ?? 4999,  // cents
      type: overrides.type ?? 'membership',
      status: overrides.status ?? 'completed',
      description: overrides.description ?? null,
    }).select().single()

    if (error) throw new Error(`Failed to create transaction: ${error.message}`)
    this.created.push({ table: 'transactions', id })
    return data
  }

  /**
   * Create an automation flow.
   */
  async createAutomationFlow(overrides: {
    name?: string
    triggerType?: string
    isActive?: boolean
    allowReenrollment?: boolean
    cooldownDays?: number
    steps?: unknown[]
    exitConditions?: unknown
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('automation_flows').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      name: overrides.name ?? `Test Flow ${this.runId}`,
      trigger_type: overrides.triggerType ?? 'signup',
      trigger_config: {},
      is_active: overrides.isActive ?? true,
      allow_reenrollment: overrides.allowReenrollment ?? false,
      cooldown_days: overrides.cooldownDays ?? null,
      steps: overrides.steps ?? [{ type: 'send_email', config: { template: 'welcome' } }],
      exit_conditions: overrides.exitConditions ?? {},
      version: 1,
    }).select().single()

    if (error) throw new Error(`Failed to create automation flow: ${error.message}`)
    this.created.push({ table: 'automation_flows', id })
    return data
  }

  /**
   * Create an automation enrollment.
   * NOTE: member_id FK references profiles(id), NOT members(id).
   * Pass the profile_id (userId from createUser), not member.id.
   */
  async createEnrollment(automationId: string, profileId: string, overrides: {
    status?: string  // CHECK: active, completed, exited, paused, failed
    completedAt?: string | null
    exitedAt?: string | null
    exitReason?: string | null
    stepHistory?: unknown[]
    currentStep?: number
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('automation_enrollments').insert({
      id,
      automation_id: automationId,
      member_id: profileId,  // FK → profiles(id)
      studio_id: TEST_STUDIO_ID,
      status: overrides.status ?? 'active',
      enrolled_at: new Date().toISOString(),
      completed_at: overrides.completedAt ?? null,
      exited_at: overrides.exitedAt ?? null,
      exit_reason: overrides.exitReason ?? null,
      step_history: overrides.stepHistory ?? [],
      current_step: overrides.currentStep ?? 0,
      flow_snapshot: { steps: [], exit_conditions: [], version: 1 },
      flow_version: 1,
    }).select().single()

    if (error) throw new Error(`Failed to create enrollment: ${error.message}`)
    this.created.push({ table: 'automation_enrollments', id })
    return data
  }

  /**
   * Create a credit pack.
   * CHECK pack_type: 8_pack, 4_pack, sampler, gift_card, recurring, drop_in, etc.
   */
  async createCreditPack(memberId: string, overrides: {
    creditsTotal?: number
    creditsRemaining?: number
    expiresAt?: string
    packType?: string
    pricePaid?: number
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('credit_packs').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      member_id: memberId,
      credits_total: overrides.creditsTotal ?? 10,
      credits_remaining: overrides.creditsRemaining ?? 10,
      pack_type: overrides.packType ?? '8_pack',
      purchased_at: new Date().toISOString(),
      price_paid: overrides.pricePaid ?? 9900,  // cents
      expires_at: overrides.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single()

    if (error) throw new Error(`Failed to create credit pack: ${error.message}`)
    this.created.push({ table: 'credit_packs', id })
    return data
  }

  /**
   * Create a gift card.
   * Schema: amount (int), balance (int), purchased_by_member_id, is_active, code
   */
  async createGiftCard(overrides: {
    purchasedByMemberId?: string | null
    amount?: number  // cents
    balance?: number  // cents
    code?: string
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('gift_cards').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      amount: overrides.amount ?? 5000,
      balance: overrides.balance ?? 5000,
      purchased_by_member_id: overrides.purchasedByMemberId ?? null,
      code: overrides.code ?? `TEST-${this.runId}-${randomUUID().slice(0, 4)}`.toUpperCase(),
      is_active: true,
    }).select().single()

    if (error) throw new Error(`Failed to create gift card: ${error.message}`)
    this.created.push({ table: 'gift_cards', id })
    return data
  }

  /**
   * Create an activity log entry.
   * CHECK type: check_in, booking, cancellation, payment, failed_payment, membership_change,
   *             walk_in, new_member, refund, strike, clock_in, clock_out
   */
  async createActivityLog(overrides: {
    type?: string
    description?: string
    actorId?: string | null
    subjectId?: string | null
    subjectType?: string | null
    metadata?: Record<string, unknown>
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('activity_log').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      type: overrides.type ?? 'booking',
      description: overrides.description ?? 'Test activity log entry',
      actor_id: overrides.actorId ?? null,
      subject_id: overrides.subjectId ?? null,
      subject_type: overrides.subjectType ?? null,
      metadata: overrides.metadata ?? {},
    }).select().single()

    if (error) throw new Error(`Failed to create activity log: ${error.message}`)
    this.created.push({ table: 'activity_log', id })
    return data
  }

  /**
   * Create an AI cache entry.
   */
  async createAiCache(overrides: {
    cacheKey?: string
    cacheType?: string
    entityId?: string | null
    result?: unknown
    expiresAt?: string
  } = {}) {
    const db = getAdminClient()
    const id = randomUUID()

    const { data, error } = await db.from('ai_cache').insert({
      id,
      studio_id: TEST_STUDIO_ID,
      cache_key: overrides.cacheKey ?? `test-${this.runId}`,
      cache_type: overrides.cacheType ?? 'churn_narrative',
      entity_id: overrides.entityId ?? null,
      result: overrides.result ?? { score: 0.5 },
      expires_at: overrides.expiresAt ?? new Date(Date.now() + 86400000).toISOString(),
    }).select().single()

    if (error) throw new Error(`Failed to create ai_cache entry: ${error.message}`)
    this.created.push({ table: 'ai_cache', id })
    return data
  }

  /**
   * Insert into any table (generic).
   */
  async insertRaw(table: string, data: Record<string, unknown>) {
    const db = getAdminClient()
    const id = (data.id as string) ?? randomUUID()

    const { data: result, error } = await db.from(table).insert({
      ...data,
      id,
      studio_id: data.studio_id ?? TEST_STUDIO_ID,
    }).select().single()

    if (error) throw new Error(`Failed to insert into ${table}: ${error.message}`)
    this.created.push({ table, id })
    return result
  }

  /**
   * Delete all records created by this factory, in reverse dependency order.
   */
  async cleanup() {
    const db = getAdminClient()
    const reversed = [...this.created].reverse()

    for (const record of reversed) {
      try {
        if (record.isAuthUser) {
          await db.auth.admin.deleteUser(record.id)
        } else {
          await db.from(record.table).delete().eq('id', record.id)
        }
      } catch (err) {
        console.warn(`Cleanup warning: Failed to delete ${record.table}/${record.id}:`, err)
      }
    }

    this.created = []
  }
}
