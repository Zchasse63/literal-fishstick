/**
 * Glofox → Meridian Entity Transformers
 *
 * Each function transforms a Glofox API response object into Supabase row(s).
 * Field names match the EXACT column names in the database.
 *
 * FK resolution (glofox_id → Meridian UUID) is handled by the sync engine,
 * NOT here. Transformers return rows without FK UUID fields — the sync engine
 * adds profile_id, member_id, class_id, class_type_id, trainer_id, etc.
 * after looking up glofox_id → UUID mappings.
 */
import { randomUUID } from 'crypto'
import type {
  GlofoxMember,
  GlofoxStaff,
  GlofoxEvent,
  GlofoxBooking,
  GlofoxTransaction,
  GlofoxMembership,
  GlofoxCreditPack,
  GlofoxLead,
  GlofoxDiscount,
  GlofoxTaxConfig,
} from './types'
import { unixToISO } from './client'

// ─── Status Mappings ──────────────────────────────────────────

/** Glofox membership status → Meridian members.membership_status CHECK values */
const MEMBERSHIP_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  INACTIVE: 'none',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
  FROZEN: 'paused',
  EXPIRED: 'cancelled',
  PENDING: 'active',
  PAST_DUE: 'past_due',
}

/** Glofox booking status → Meridian bookings.status CHECK values */
const BOOKING_STATUS_MAP: Record<string, string> = {
  BOOKED: 'booked',
  WAITING: 'waitlisted',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
  RESERVED: 'booked',
  FAILED: 'cancelled',
}

/** Glofox transaction status → Meridian transactions.status */
const TRANSACTION_STATUS_MAP: Record<string, string> = {
  successful: 'completed',
  success: 'completed',
  completed: 'completed',
  pending: 'pending',
  failed: 'failed',
  refunded: 'refunded',
  declined: 'failed',
}

/** Glofox lead source → Meridian leads.source CHECK values */
const LEAD_SOURCE_MAP: Record<string, string> = {
  instagram: 'instagram',
  google: 'google',
  'walk-in': 'walk_in',
  'walk_in': 'walk_in',
  walkin: 'walk_in',
  referral: 'referral',
  corporate: 'corporate',
  event: 'event',
  website: 'website',
  facebook: 'facebook',
  web: 'website',
  online: 'website',
}

// ─── Helpers ──────────────────────────────────────────────────

function buildFullName(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.trim() || null
  const l = lastName?.trim() || null
  if (f && l) return `${f} ${l}`
  return f ?? l ?? 'Unknown'
}

/**
 * Infer Meridian membership_tier from Glofox membership name/plan name.
 * CHECK constraint: 'unlimited' | '10_class' | '6_class' | null
 */
function inferMembershipTier(membershipName?: string | null): string | null {
  if (!membershipName) return null
  const lower = membershipName.toLowerCase()
  if (lower.includes('unlimited')) return 'unlimited'
  if (lower.includes('10')) return '10_class'
  if (lower.includes('6')) return '6_class'
  return null
}

/**
 * Infer Meridian transaction type from Glofox transaction description.
 * CHECK constraint: membership | drop_in | credit_pack | merch | gift_card | private_event | refund | strike_penalty
 */
function inferTransactionType(description?: string | null, amount?: number | null): string {
  if (!description) return 'membership'
  const lower = description.toLowerCase()
  if (lower.includes('refund') || (amount != null && amount < 0)) return 'refund'
  if (lower.includes('drop-in') || lower.includes('drop in') || lower.includes('dropin')) return 'drop_in'
  if (lower.includes('credit') || lower.includes('class pack') || lower.includes('pack')) return 'credit_pack'
  if (lower.includes('merch') || lower.includes('retail') || lower.includes('product')) return 'merch'
  if (lower.includes('gift')) return 'gift_card'
  if (lower.includes('private') || lower.includes('event') || lower.includes('party')) return 'private_event'
  // Default: most Glofox transactions are membership payments
  return 'membership'
}

/**
 * Infer Meridian credit_packs.pack_type from Glofox data.
 * CHECK: 8_pack | 4_pack | sampler | gift_card | recurring | drop_in |
 *        8_class_pack | 4_class_pack | sauna_sampler_3 | first_class_free | imported_credits
 */
function inferCreditPackType(
  numSessions?: number | null,
  membershipName?: string | null,
): string {
  if (membershipName) {
    const lower = membershipName.toLowerCase()
    if (lower.includes('sampler') || lower.includes('sample')) return 'sauna_sampler_3'
    if (lower.includes('first') || lower.includes('free') || lower.includes('trial')) return 'first_class_free'
    if (lower.includes('gift')) return 'gift_card'
    if (lower.includes('drop')) return 'drop_in'
    if (lower.includes('recurring')) return 'recurring'
  }

  if (numSessions != null) {
    if (numSessions === 8) return '8_class_pack'
    if (numSessions === 4) return '4_class_pack'
    if (numSessions === 3) return 'sauna_sampler_3'
    if (numSessions === 1) return 'drop_in'
  }

  return 'imported_credits'
}

/**
 * Map Glofox class status to Meridian class status.
 * CHECK: scheduled | in_progress | completed | cancelled
 */
function inferClassStatus(glofoxStatus?: string | null, startsAt?: string | null): string {
  if (glofoxStatus) {
    const lower = glofoxStatus.toLowerCase()
    if (lower === 'cancelled' || lower === 'canceled') return 'cancelled'
  }
  // Infer from time
  if (startsAt) {
    const start = new Date(startsAt)
    const now = new Date()
    if (start < now) return 'completed'
  }
  return 'scheduled'
}

/**
 * Map a Glofox lead source string to a valid Meridian leads.source CHECK value.
 */
function mapLeadSource(source?: string | null): string | null {
  if (!source) return null
  const lower = source.toLowerCase().trim()
  return LEAD_SOURCE_MAP[lower] ?? 'other'
}

/**
 * Convert unix timestamp to ISO date string (YYYY-MM-DD).
 * Handles Glofox {sec, usec} timestamp objects.
 */
function unixToDate(ts?: number | null | Record<string, unknown>): string | null {
  if (ts == null) return null
  let seconds: number
  if (typeof ts === 'object' && ts !== null) {
    const sec = (ts as any).sec ?? (ts as any).$date
    if (typeof sec !== 'number') return null
    seconds = sec
  } else if (typeof ts === 'number') {
    seconds = ts
  } else {
    return null
  }
  return new Date(seconds * 1000).toISOString().split('T')[0]
}

// ─── Transformer Return Types ─────────────────────────────────
// These match the EXACT Supabase column names.

export interface ProfileRow {
  id: string
  studio_id: string
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  roles: string[]
  date_of_birth: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_postal_code: string | null
  address_country: string | null
  email_opt_in: boolean
  sms_opt_in: boolean
  lead_source: string | null
  marketing_source: string | null
  joined_at: string | null
  glofox_id: string
  glofox_synced_at: string
}

export interface MemberRow {
  studio_id: string
  membership_status: string
  membership_tier: string | null
  join_date: string
  plan_code: string | null
  plan_price: number | null
  plan_upfront_fee: number | null
  glofox_id: string
  glofox_synced_at: string
  glofox_subscription_id: string | null
}

export interface ClassRow {
  studio_id: string
  title: string
  starts_at: string
  ends_at: string
  capacity: number
  booked_count: number
  status: string
  glofox_id: string
}

export interface BookingRow {
  studio_id: string
  status: string
  credits_deducted: number
  checked_in_at: string | null
  cancelled_at: string | null
  is_walk_in: boolean
  attended: boolean
  is_late_cancellation: boolean
  is_from_waitlist: boolean
  payment_method: string | null
  glofox_event_name: string | null
  glofox_id: string
  glofox_synced_at: string
  created_at: string | null
  updated_at: string | null
}

export interface TransactionRow {
  studio_id: string
  type: string
  amount: number
  currency: string
  status: string
  description: string | null
  glofox_id: string
  glofox_synced_at: string
  glofox_provider_id: string | null
  created_at: string | null
}

export interface CreditPackRow {
  studio_id: string
  pack_type: string
  credits_total: number
  credits_remaining: number
  expires_at: string | null
  purchased_at: string | null
  price_paid: number
  glofox_id: string
}

export interface LeadRow {
  studio_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  status: string
  source: string | null
  source_detail: string | null
  glofox_id: string
  created_at: string | null
  updated_at: string | null
}

export interface MembershipPlanRow {
  studio_id: string
  name: string
  tier: string | null
  price: number
  billing_interval: string
  credits_per_cycle: number | null
  is_active: boolean
  is_recurring: boolean
  glofox_id: string
}

// ─── Transformer Results with FK Refs ─────────────────────────

export interface TransformedMember {
  profile: ProfileRow
  member: MemberRow
  /** The Glofox member _id — used by sync engine to link member.profile_id */
  profileGlofoxId: string
}

export interface TransformedClass {
  classRow: ClassRow
  /** Glofox program_id — used to resolve class_type_id */
  programId: string | null
  /** Glofox trainer _id — used to resolve trainer_id */
  trainerGlofoxId: string | null
}

export interface TransformedBooking {
  booking: BookingRow
  /** Glofox user_id — used to resolve member_id (→ members.glofox_id → members.id) */
  memberGlofoxId: string | null
  /** Glofox event_id — used to resolve class_id (→ classes.glofox_id → classes.id) */
  classGlofoxId: string | null
}

export interface TransformedTransaction {
  transaction: TransactionRow
  /** Glofox user/buyer id — used to resolve member_id */
  memberGlofoxId: string | null
  /** Glofox sold_by user id — used to resolve sold_by_profile_id */
  soldByGlofoxId: string | null
}

export interface TransformedCreditPack {
  creditPack: CreditPackRow
  /** Glofox user_id — used to resolve member_id */
  memberGlofoxId: string | null
}

// ─── Transformers ─────────────────────────────────────────────

/**
 * Transform a Glofox member into a Meridian profile + member row.
 * FK resolution needed: member.profile_id (resolved by sync engine)
 */
export function transformMember(
  m: GlofoxMember,
  studioId: string,
): TransformedMember {
  const now = new Date().toISOString()
  const firstName = m.first_name?.trim() || null
  const lastName = m.last_name?.trim() || null

  const profile: ProfileRow = {
    id: randomUUID(),
    studio_id: studioId,
    email: m.email?.toLowerCase().trim() || `noemail+${m._id}@meridian.placeholder`,
    full_name: buildFullName(m.first_name, m.last_name),
    phone: m.phone?.trim() || null,
    avatar_url: m.image_url ?? null,
    roles: ['member'],
    date_of_birth: m.birth ?? null,
    emergency_contact_name: m.emergency_contact?.name ?? null,
    emergency_contact_phone: m.emergency_contact?.phone ?? null,
    address_street: m.address?.street ?? null,
    address_city: m.address?.city ?? null,
    address_state: m.address?.state ?? null,
    address_postal_code: m.address?.postal_code ?? null,
    address_country: m.address?.country ?? m.address?.country_code ?? null,
    email_opt_in: typeof m.consent?.email === 'boolean' ? m.consent.email : true,
    sms_opt_in: typeof m.consent?.sms === 'boolean' ? m.consent.sms : true,
    lead_source: m.leads?.contact_source ?? m.source?.[0] ?? null,
    marketing_source: m.leads?.marketing_source ?? null,
    joined_at: unixToISO(m.joined_at) ?? unixToISO(m.created),
    glofox_id: m._id,
    glofox_synced_at: now,
  }

  const membershipName = m.membership?.membership_name ?? m.membership?.plan_name ?? null
  const rawStatus = m.membership?.status ?? null
  const mappedStatus = rawStatus
    ? (MEMBERSHIP_STATUS_MAP[rawStatus] ?? MEMBERSHIP_STATUS_MAP[rawStatus.toUpperCase()] ?? 'none')
    : 'none'

  const member: MemberRow = {
    studio_id: studioId,
    membership_status: mappedStatus,
    membership_tier: inferMembershipTier(membershipName),
    join_date: unixToDate(m.joined_at) ?? unixToDate(m.created) ?? new Date().toISOString().split('T')[0],
    plan_code: m.membership?.plan_code ?? null,
    plan_price: m.membership?.plan_price != null ? Math.round(m.membership.plan_price * 100) : null,
    plan_upfront_fee: null,
    glofox_id: m._id,
    glofox_synced_at: now,
    glofox_subscription_id: null,
  }

  return { profile, member, profileGlofoxId: m._id }
}

/**
 * Transform a Glofox staff member into a Meridian profile row.
 * Staff are stored as profiles with 'trainer' role.
 */
export function transformStaff(
  s: GlofoxStaff,
  studioId: string,
): { profile: ProfileRow } {
  const now = new Date().toISOString()

  const profile: ProfileRow = {
    id: randomUUID(),
    studio_id: studioId,
    email: `staff+${s._id}@meridian.placeholder`,
    full_name: s.name?.trim() ?? buildFullName(s.first_name, s.last_name),
    phone: null,
    avatar_url: s.image_url ?? null,
    roles: ['trainer'],
    date_of_birth: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    address_street: null,
    address_city: null,
    address_state: null,
    address_postal_code: null,
    address_country: null,
    email_opt_in: true,
    sms_opt_in: true,
    lead_source: null,
    marketing_source: null,
    joined_at: null,
    glofox_id: s._id,
    glofox_synced_at: now,
  }

  return { profile }
}

/**
 * Transform a Glofox event into a Meridian classes row.
 * FK resolution needed: class_type_id, trainer_id (resolved by sync engine)
 */
export function transformEvent(
  e: GlofoxEvent,
  studioId: string,
): TransformedClass {
  const startsAt = unixToISO(e.time_start)
  let endsAt: string | null = null
  if (e.time_start && e.duration) {
    endsAt = unixToISO(e.time_start + e.duration * 60)
  } else if (e.time_start) {
    // Default 60-minute duration
    endsAt = unixToISO(e.time_start + 3600)
  }

  const classRow: ClassRow = {
    studio_id: studioId,
    title: e.name ?? 'Untitled Class',
    starts_at: startsAt!,
    ends_at: endsAt!,
    capacity: e.size ?? 12,
    booked_count: e.booked ?? 0,
    status: inferClassStatus(e.status, startsAt),
    glofox_id: e._id,
  }

  return {
    classRow,
    programId: e.program_id ?? null,
    trainerGlofoxId: e.trainers?.[0] ?? null,
  }
}

/**
 * Transform a Glofox booking into a Meridian bookings row.
 * FK resolution needed: class_id, member_id (resolved by sync engine)
 */
export function transformBooking(
  b: GlofoxBooking,
  studioId: string,
): TransformedBooking {
  const now = new Date().toISOString()

  // Determine status — attended overrides to checked_in
  let status: string
  if (b.attended) {
    status = 'checked_in'
  } else {
    const raw = b.status ?? ''
    status = BOOKING_STATUS_MAP[raw] ?? BOOKING_STATUS_MAP[raw.toUpperCase()] ?? 'booked'
  }

  // If booking was cancelled late, use late_cancelled status
  if (b.is_late_cancellation && (status === 'cancelled')) {
    status = 'late_cancelled'
  }

  const booking: BookingRow = {
    studio_id: studioId,
    status,
    credits_deducted: 1,
    checked_in_at: b.attended ? unixToISO(b.time_start) : null,
    cancelled_at: unixToISO(b.canceled_at),
    is_walk_in: false,
    attended: b.attended ?? false,
    is_late_cancellation: b.is_late_cancellation ?? false,
    is_from_waitlist: b.is_from_waiting_list ?? false,
    payment_method: b.payment_method ?? null,
    glofox_event_name: b.event_name ?? null,
    glofox_id: b._id,
    glofox_synced_at: now,
    created_at: unixToISO(b.created),
    updated_at: unixToISO(b.modified),
  }

  return {
    booking,
    memberGlofoxId: b.user_id ?? null,
    classGlofoxId: b.event_id ?? null,
  }
}

/**
 * Transform a Glofox transaction into a Meridian transactions row.
 * FK resolution needed: member_id, sold_by_profile_id (resolved by sync engine)
 */
export function transformTransaction(
  t: GlofoxTransaction,
  studioId: string,
): TransformedTransaction {
  const now = new Date().toISOString()
  const rawStatus = t.transaction_status?.toLowerCase() ?? null
  const status = rawStatus ? (TRANSACTION_STATUS_MAP[rawStatus] ?? 'completed') : 'completed'

  // Convert amount from dollars (float) to cents (integer)
  const amountCents = t.amount != null ? Math.round(t.amount * 100) : 0

  const transaction: TransactionRow = {
    studio_id: studioId,
    type: inferTransactionType(t.description, t.amount),
    amount: amountCents,
    currency: t.currency?.toLowerCase() ?? 'usd',
    status,
    description: t.description ?? null,
    glofox_id: t._id,
    glofox_synced_at: now,
    glofox_provider_id: t.transaction_provider_id ?? null,
    created_at: unixToISO(t.created),
  }

  return {
    transaction,
    // GlofoxTransaction doesn't include buyer user_id — member linkage
    // happens via metadata or is resolved externally if needed
    memberGlofoxId: (t as any).user_id ?? (t.metadata as any)?.user_id ?? null,
    soldByGlofoxId: t.sold_by_user_id ?? null,
  }
}

/**
 * Transform a Glofox membership plan into a Meridian membership_plans row.
 */
export function transformMembershipPlan(
  m: GlofoxMembership,
  studioId: string,
): MembershipPlanRow {
  // Use the first plan's details for price/billing
  const firstPlan = m.plans?.[0]
  const price = firstPlan?.price != null ? Math.round(firstPlan.price * 100) : 0
  const durationUnit = firstPlan?.duration_time_unit?.toLowerCase() ?? 'month'
  const billingInterval = durationUnit === 'year' ? 'year' : durationUnit === 'one_time' ? 'one_time' : 'month'

  const name = m.name ?? 'Unknown Plan'

  return {
    studio_id: studioId,
    name,
    tier: inferMembershipTier(name),
    price,
    billing_interval: billingInterval,
    credits_per_cycle: null,
    is_active: m.active ?? false,
    is_recurring: billingInterval !== 'one_time',
    glofox_id: m._id,
  }
}

/**
 * Transform a Glofox credit pack into a Meridian credit_packs row.
 * FK resolution needed: member_id (resolved by sync engine)
 */
export function transformCreditPack(
  c: GlofoxCreditPack,
  studioId: string,
): TransformedCreditPack {
  const totalSessions = c.num_sessions ?? 0
  const usedSessions = c.bookings?.length ?? 0

  const creditPack: CreditPackRow = {
    studio_id: studioId,
    pack_type: inferCreditPackType(totalSessions, c.membership_name),
    credits_total: totalSessions,
    credits_remaining: Math.max(0, totalSessions - usedSessions),
    expires_at: unixToISO(c.end_date),
    purchased_at: unixToISO(c.start_date),
    price_paid: 0, // Glofox credit endpoint doesn't include price
    glofox_id: c._id,
  }

  return {
    creditPack,
    memberGlofoxId: c.user_id ?? null,
  }
}

/**
 * Transform a Glofox lead into a Meridian leads row.
 */
export function transformLead(
  l: GlofoxLead,
  studioId: string,
): LeadRow {
  return {
    studio_id: studioId,
    first_name: l.first_name?.trim() ?? null,
    last_name: l.last_name?.trim() ?? null,
    email: l.email?.toLowerCase().trim() ?? null,
    phone: l.phone?.trim() ?? null,
    status: 'new', // All Glofox leads import as 'new'
    source: mapLeadSource(l.leads?.contact_source ?? l.source?.[0]),
    source_detail: l.leads?.marketing_source ?? null,
    glofox_id: l._id,
    created_at: unixToISO(l.created),
    updated_at: unixToISO(l.modified),
  }
}

// ─── Discount + Tax Config Row Types ──────────────────────────

export interface DiscountRow {
  studio_id: string
  name: string
  description: string | null
  rate_type: string
  rate_value: number
  num_cycles: number
  active: boolean
  glofox_id: string
}

export interface TaxConfigurationRow {
  studio_id: string
  name: string
  rate: number
  description: string | null
  is_default: boolean
  active: boolean
  glofox_id: string | null
}

/**
 * Transform a Glofox discount into a Meridian discounts row.
 */
export function transformDiscount(
  d: GlofoxDiscount,
  studioId: string,
): DiscountRow {
  return {
    studio_id: studioId,
    name: d.name ?? 'Unnamed Discount',
    description: d.description ?? null,
    rate_type: d.rate_type === 'percentage' ? 'percentage' : 'fixed',
    rate_value: Number(d.rate_value ?? 0),
    num_cycles: Number(d.num_cycles ?? 0),
    active: true, // Glofox doesn't expose active flag on discounts
    glofox_id: d.id,
  }
}

/**
 * Transform a Glofox tax configuration into a Meridian tax_configurations row.
 */
export function transformTaxConfig(
  t: GlofoxTaxConfig,
  studioId: string,
): TaxConfigurationRow {
  const rate = t.rate != null ? Number(t.rate) : 0
  // Glofox returns rate as a decimal (e.g. 0.0425 for 4.25%). Meridian
  // tax_configurations.rate is also a decimal, so no conversion needed.
  return {
    studio_id: studioId,
    name: t.name ?? 'Default Tax',
    rate,
    description: t.description ?? null,
    is_default: true, // First tax config returned is the default
    active: true,
    glofox_id: t.id ?? null,
  }
}
