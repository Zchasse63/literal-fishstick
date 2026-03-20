// Corporate & Events types

export type CompanyStatus = 'prospect' | 'active' | 'paused' | 'churned'
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+'
export type PaymentTerms = 'immediate' | 'net_15' | 'net_30' | 'net_60'
export type CompanyMemberRole = 'admin' | 'manager' | 'employee'

export type EventType =
  | 'corporate_wellness'
  | 'private_party'
  | 'team_building'
  | 'birthday'
  | 'bachelor_bachelorette'
  | 'community'
  | 'workshop'
  | 'custom'

export type EventStatus =
  | 'inquiry'
  | 'quoted'
  | 'confirmed'
  | 'deposit_paid'
  | 'in_progress'
  | 'completed'
  | 'invoiced'
  | 'paid'
  | 'cancelled'

export type RSVPStatus = 'invited' | 'confirmed' | 'declined' | 'waitlisted' | 'attended' | 'no_show'

export type CorporateInvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void' | 'refunded'

export interface BillingAddress {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country: string
}

export interface CompanyAccount {
  id: string
  studio_id: string
  name: string
  legal_name: string | null
  tax_id: string | null
  industry: string | null
  company_size: CompanySize | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  contact_title: string | null
  billing_email: string | null
  billing_address: BillingAddress | null
  stripe_customer_id: string | null
  payment_terms: PaymentTerms
  contract_start: string | null
  contract_end: string | null
  contract_value: number | null
  monthly_credit_allocation: number
  credits_remaining: number
  credit_rollover_cap: number | null
  auto_renew: boolean
  status: CompanyStatus
  notes: string | null
  tags: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CompanyMember {
  id: string
  company_id: string
  member_id: string
  studio_id: string
  role: CompanyMemberRole
  is_active: boolean
  added_at: string
  removed_at: string | null
}

export interface Event {
  id: string
  studio_id: string
  name: string
  description: string | null
  event_type: EventType
  start_time: string
  end_time: string
  setup_time_minutes: number
  cleanup_time_minutes: number
  min_guests: number
  max_guests: number | null
  expected_guests: number | null
  actual_guests: number | null
  base_price: number | null
  per_person_price: number | null
  total_price: number | null
  deposit_amount: number | null
  deposit_paid: boolean
  company_id: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: EventStatus
  special_requests: string | null
  internal_notes: string | null
  assigned_staff: string[]
  resources_reserved: unknown[]
  invoice_id: string | null
  stripe_payment_intent_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EventGuest {
  id: string
  event_id: string
  studio_id: string
  member_id: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  rsvp_status: RSVPStatus
  rsvp_at: string | null
  checked_in_at: string | null
  converted_to_member: boolean
  conversion_date: string | null
  created_at: string
}

// InvoiceLineItem is re-exported from revenue.ts — use that one
import type { InvoiceLineItem } from './revenue'

export interface CorporateInvoice {
  id: string
  studio_id: string
  company_id: string
  invoice_number: string
  status: CorporateInvoiceStatus
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  amount_paid: number
  line_items: InvoiceLineItem[]
  issue_date: string
  due_date: string
  paid_date: string | null
  payment_method: string | null
  stripe_invoice_id: string | null
  stripe_payment_intent_id: string | null
  sent_at: string | null
  viewed_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PayrollPeriod {
  id: string
  studio_id: string
  period_start: string
  period_end: string
  pay_date: string | null
  status: 'open' | 'processing' | 'approved' | 'reopened' | 'exported' | 'paid'
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  reopened_by: string | null
  reopened_at: string | null
  reopen_reason: string | null
  created_at: string
  updated_at: string
}

export interface PayrollLineItem {
  id: string
  payroll_period_id: string
  employee_id: string
  studio_id: string
  regular_hours: number
  overtime_hours: number
  hourly_rate: number | null
  overtime_rate: number | null
  base_pay: number
  overtime_pay: number
  trainer_bonuses: number
  promo_commissions: number
  tips: number
  other_earnings: number
  gross_pay: number
  federal_tax_estimate: number
  state_tax_estimate: number
  fica_estimate: number
  other_deductions: number
  net_pay_estimate: number
  classes_led: number
  bonus_eligible_classes: number
  promo_conversions: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GeofenceLocation {
  id: string
  studio_id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShippingLabel {
  id: string
  order_id: string
  studio_id: string
  easypost_shipment_id: string | null
  easypost_rate_id: string | null
  easypost_label_id: string | null
  carrier: string
  service: string
  tracking_number: string | null
  tracking_url: string | null
  rate_amount: number | null
  insurance_amount: number
  label_url: string | null
  label_format: string
  status: 'created' | 'purchased' | 'in_transit' | 'delivered' | 'returned' | 'failed'
  from_address: Record<string, unknown>
  to_address: Record<string, unknown>
  tracking_events: unknown[]
  estimated_delivery: string | null
  actual_delivery: string | null
  created_at: string
  updated_at: string
}
