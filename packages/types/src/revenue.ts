// Revenue & Payment types

export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partially_refunded'
export type PaymentType = 'membership' | 'drop_in' | 'credit_pack' | 'merch' | 'gift_card' | 'event' | 'penalty'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'

export interface Payment {
  id: string
  studio_id: string
  member_id: string
  amount: number // cents
  wallet_amount: number // cents — portion paid from wallet
  card_amount: number // cents — portion charged to card
  payment_type: PaymentType
  status: PaymentStatus
  stripe_payment_intent_id: string | null
  stripe_invoice_id: string | null
  description: string
  reference_id: string | null // booking ID, order ID, etc.
  member_discount_applied: boolean
  discount_amount: number // cents
  refund_amount: number // cents
  refunded_at: string | null
  created_at: string
}

export interface MembershipPlan {
  id: string
  studio_id: string
  name: string
  tier: 'unlimited' | '10_class' | '6_class'
  price: number // cents (monthly)
  credits_per_cycle: number | null // null = unlimited
  guest_passes_per_cycle: number
  stripe_price_id: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreditPackPlan {
  id: string
  studio_id: string
  name: string
  price: number // cents
  credits: number
  is_recurring: boolean
  billing_interval: 'month' | null
  expires_days: number | null // null = no expiration
  stripe_price_id: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface GiftCard {
  id: string
  studio_id: string
  code: string
  amount: number // cents
  redeemed_by_member_id: string | null
  purchased_by_email: string
  purchased_by_name: string
  recipient_email: string | null
  recipient_name: string | null
  message: string | null
  is_redeemed: boolean
  redeemed_at: string | null
  stripe_payment_intent_id: string | null
  created_at: string
}

export interface Invoice {
  id: string
  studio_id: string
  member_id: string | null
  corporate_account_id: string | null
  amount: number // cents
  status: InvoiceStatus
  due_date: string
  paid_at: string | null
  line_items: InvoiceLineItem[]
  notes: string | null
  stripe_invoice_id: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number // cents
  total: number // cents
}

export interface DunningRecord {
  id: string
  studio_id: string
  member_id: string
  stripe_subscription_id: string
  attempt_count: number
  last_attempt_at: string
  next_attempt_at: string | null
  status: 'retrying' | 'resolved' | 'failed_final'
  resolved_at: string | null
  created_at: string
}
