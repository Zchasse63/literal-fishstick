// Member types

export type MembershipTier = 'unlimited' | '10_class' | '6_class'
export type MembershipStatus = 'active' | 'paused' | 'cancelled' | 'past_due'
export type CreditPackType = '8_pack' | '4_pack' | 'sampler'

export interface Member {
  id: string
  user_id: string
  studio_id: string
  membership_tier: MembershipTier | null
  membership_status: MembershipStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  credits_remaining: number
  wallet_balance: number // cents
  member_discount_active: boolean // 10% auto-discount for active recurring
  guest_passes_remaining: number
  guest_passes_per_cycle: number
  join_date: string
  last_visit: string | null
  total_visits: number
  lifetime_value: number // cents
  exclude_from_analytics: boolean
  promo_code_used: string | null // trainer attribution
  referred_by_member_id: string | null
  strike_count: number // rolling 30-day window
  strike_penalty_exempt: boolean // member-level override (auto-expires)
  strike_exempt_until: string | null
  waiver_signed: boolean
  waiver_signed_at: string | null
  notes: string | null // admin-only notes
  created_at: string
  updated_at: string
}

export interface CreditPack {
  id: string
  member_id: string
  studio_id: string
  pack_type: CreditPackType | 'gift_card' | 'recurring'
  credits_total: number
  credits_remaining: number
  expires_at: string | null // null = never expires (non-recurring packs)
  grace_period_ends_at: string | null // 7 days after expires_at
  purchased_at: string
  price_paid: number // cents
  created_at: string
}

export interface WalletTransaction {
  id: string
  member_id: string
  studio_id: string
  amount: number // cents, positive = credit, negative = debit
  type: 'gift_card_redemption' | 'purchase' | 'refund' | 'adjustment'
  description: string
  reference_id: string | null // gift card ID, order ID, etc.
  balance_after: number // cents
  created_at: string
}

export interface FamilyAccount {
  id: string
  parent_member_id: string
  studio_id: string
  name: string
  created_at: string
}

export interface FamilyMember {
  id: string
  family_account_id: string
  member_id: string
  relationship: 'parent' | 'spouse' | 'child' | 'other'
  is_minor: boolean
  created_at: string
}

export interface MemberStrike {
  id: string
  member_id: string
  studio_id: string
  type: 'late_cancellation' | 'no_show'
  class_id: string
  penalty_amount: number // cents — 0 for 1st strike or exempt members
  penalty_charged: boolean
  penalty_waived: boolean
  waived_reason: string | null
  created_at: string
  expires_at: string // 30 days from creation
}

export interface MemberSegment {
  id: string
  studio_id: string
  name: string
  description: string
  type: 'auto' | 'manual' // auto = rules-based, manual = hand-picked
  rules: SegmentRule[] | null
  member_count: number
  color: string
  icon: string
  created_at: string
  updated_at: string
}

export interface SegmentRule {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'days_since'
  value: string | number | boolean
}
