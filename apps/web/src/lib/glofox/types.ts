/**
 * Glofox API Response Types
 *
 * Type definitions for all Glofox REST API responses.
 * Based on Glofox API v2.2.0 (OpenAPI 3.1.0).
 * IDs are 24-char MongoDB ObjectID hex strings.
 * Timestamps are Unix seconds unless noted otherwise.
 */

// ─── Config ────────────────────────────────────────────────────

export interface GlofoxConfig {
  apiToken: string
  apiKey: string
  branchId: string
  baseUrl?: string
}

// ─── Pagination ────────────────────────────────────────────────

export interface GlofoxPaginatedResponse<T> {
  data: T[]
  has_more: boolean
  total_count: number
  page: number
  limit: number
}

// ─── Members ───────────────────────────────────────────────────

export interface GlofoxConsent {
  email?: boolean
  sms?: boolean
  push?: boolean
}

export interface GlofoxAddress {
  street?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  country_code?: string
}

export interface GlofoxEmergencyContact {
  name?: string
  phone?: string
}

export interface GlofoxEmbeddedMembership {
  type?: 'payg' | 'time' | 'time_classes'
  start_date?: number
  expiry_date?: number
  status?: 'ACTIVE' | 'INACTIVE' | 'CANCELED' | 'FROZEN' | 'EXPIRED' | 'PENDING'
  membership_name?: string
  plan_code?: string
  plan_name?: string
  plan_price?: number
  plan_upfront_fee?: number
  user_membership_id?: string
  branches?: string[]
  subscription?: Record<string, unknown>
}

export interface GlofoxLeadInfo {
  contact_source?: string
  marketing_source?: string
}

export interface GlofoxMember {
  _id: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  type?: 'member' | 'lead'
  active?: boolean
  birth?: string
  emergency_contact?: GlofoxEmergencyContact
  access_barcode?: string
  image_url?: string
  lead_status?: string
  joined_at?: number
  created?: number
  modified?: number
  parent_id?: string
  use_parent_email?: boolean
  use_parent_phone?: boolean
  source?: string[]
  consent?: GlofoxConsent
  membership?: GlofoxEmbeddedMembership
  leads?: GlofoxLeadInfo
  address?: GlofoxAddress
}

// ─── Member Write Operations ──────────────────────────────────

export interface GlofoxRegisterMemberRequest {
  first_name: string
  last_name: string
  email: string
  phone?: string
  birth?: string
  emergency_contact?: GlofoxEmergencyContact
  consent?: GlofoxConsent
  address?: GlofoxAddress
}

export interface GlofoxRegisterMemberResponse {
  _id?: string
  status?: string
  message?: string
  member?: GlofoxMember
}

export interface GlofoxUpdateMemberRequest {
  first_name?: string
  last_name?: string
  phone?: string
  birth?: string
  emergency_contact?: GlofoxEmergencyContact
  consent?: GlofoxConsent
  address?: GlofoxAddress
}

export interface GlofoxSearchMembersResponse {
  data?: GlofoxMember[]
  total_count?: number
}

// ─── Staff ─────────────────────────────────────────────────────

export interface GlofoxStaff {
  _id: string
  branch_id?: string
  namespace?: string
  active?: boolean
  bookable?: boolean
  type?: string
  first_name?: string
  last_name?: string
  description?: string
  name?: string
  image_url?: string
  modified?: number
}

// ─── Events / Classes ──────────────────────────────────────────

export interface GlofoxEvent {
  _id: string
  namespace?: string
  branch_id?: string
  type?: 'class' | 'course' | 'appointment' | 'facility'
  active?: boolean
  name?: string
  description?: string
  time_start?: number
  duration?: number
  is_online?: boolean
  image_url?: string
  size?: number
  private?: boolean
  booked?: number
  waiting?: number
  modified?: number
  program_id?: string
  level?: string
  facility?: string
  trainers?: string[]
  status?: string
  open_booking_time?: number
  close_booking_time?: number
}

// ─── Bookings ──────────────────────────────────────────────────

export interface GlofoxBooking {
  _id: string
  branch_id?: string
  namespace?: string
  user_id?: string
  user_name?: string
  status?: 'BOOKED' | 'WAITING' | 'CANCELED' | 'RESERVED' | 'FAILED'
  type?: 'class' | 'course' | 'appointment' | 'facility'
  program_id?: string
  event_id?: string
  event_name?: string
  course_id?: string
  session_id?: string
  time_start?: number
  time_finish?: number
  duration?: number
  attended?: boolean
  paid?: boolean
  guest_bookings?: number
  is_from_waiting_list?: boolean
  is_late_cancellation?: boolean
  payment_method?: string
  is_first?: boolean
  canceled_at?: number
  modified?: number
  created?: number
  batch_id?: string
  model?: string
  model_id?: string
  model_name?: string
}

// ─── Transactions ──────────────────────────────────────────────

export interface GlofoxTransaction {
  _id: string
  id?: string
  transaction_status?: string
  transaction_provider_id?: string
  amount?: number
  currency?: string
  paid?: boolean
  description?: string
  sold_by_user_id?: string
  created?: number
  modified?: number
  metadata?: Record<string, unknown>
}

// ─── Membership Plans ──────────────────────────────────────────

export interface GlofoxMembershipPlan {
  code: string
  type?: string
  duration_time_unit?: string
  duration_time_unit_count?: number
  starts_on?: string
  price?: number
  upfront_fee?: number
}

export interface GlofoxMembership {
  _id: string
  branch_id?: string
  namespace?: string
  active?: boolean
  name?: string
  description?: string
  buy_just_once?: boolean
  plans?: GlofoxMembershipPlan[]
}

// ─── Credits ───────────────────────────────────────────────────

export interface GlofoxCreditPack {
  _id: string
  branch_id?: string
  user_id?: string
  model?: string
  num_sessions?: number
  active?: boolean
  bookings?: string[]
  start_date?: number
  end_date?: number
  membership_id?: string
  membership_name?: string
}

// ─── Leads ─────────────────────────────────────────────────────

export interface GlofoxLead {
  _id: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  lead_status?: string
  source?: string[]
  created?: number
  modified?: number
  leads?: GlofoxLeadInfo
  consent?: GlofoxConsent
  membership?: GlofoxEmbeddedMembership
}

// ─── Products ──────────────────────────────────────────────────

export interface GlofoxProductPresentation {
  name?: string
  price?: number
  currency?: string
}

export interface GlofoxProduct {
  _id: string
  name?: string
  description?: string
  namespace?: string
  active?: boolean
  presentations?: GlofoxProductPresentation[]
  categories?: string[]
}

// ─── Waivers / Agreements ──────────────────────────────────────

export interface GlofoxWaiver {
  _id: string
  name?: string
  content?: string
  active?: boolean
  created?: number
  modified?: number
}

export interface GlofoxAgreement {
  id: string
  member_id?: string
  studio_id?: string
  document_id?: string
  status?: string
  external_reference?: string
  created_at?: string
  updated_at?: string
}

// ─── Attendances ──────────────────────────────────────────────────

export interface GlofoxMarkAttendanceRequest {
  /** The Glofox booking _id to mark as attended */
  booking_id: string
  /** The Glofox user _id who attended */
  user_id: string
}

export interface GlofoxMarkAttendanceResponse {
  _id?: string
  attended?: boolean
  status?: string
  message?: string
}

// ─── Discounts ────────────────────────────────────────────────────

export interface GlofoxDiscount {
  id: string
  name: string
  description?: string
  num_cycles: number // 0 = all payments, 1+ = limited
  rate_type: 'fixed' | 'percentage'
  rate_value: number
}

// ─── Trainer Performance ───────────────────────────────────────

export interface GlofoxTrainerPerformance {
  trainer_id: string
  trainer_name?: string
  events?: number
  bookings?: number
  attendance?: number
  capacity?: number
}

// ─── Membership Purchase / Cancel ─────────────────────────────────

export interface GlofoxPurchaseMembershipRequest {
  user_id: string
  membership_id: string
  plan_code: string
  payment_method?: string
  discount_ids?: string[]
  promo_code?: string
}

export interface GlofoxPurchaseMembershipResponse {
  _id?: string
  status?: string
  message?: string
  charge_id?: string
  subscription?: Record<string, unknown>
}

export interface GlofoxCancelMembershipRequest {
  user_id: string
  membership_id: string
  reason?: string
}

export interface GlofoxCancelMembershipResponse {
  status?: string
  message?: string
}

export interface GlofoxPaymentMethod {
  _id?: string
  type?: string
  last4?: string
  brand?: string
  exp_month?: number
  exp_year?: number
  is_default?: boolean
}

// ─── Booking Write-back ──────────────────────────────────────────

export interface GlofoxCreateBookingRequest {
  /** 'event' for classes, 'course' for courses, 'appointment' for appointments */
  model: 'event' | 'course' | 'appointment' | 'facility'
  /** The Glofox event/class _id */
  model_id: string
  /** The Glofox user _id of the member booking */
  user_id: string
  /** Optional: Glofox branch _id (defaults to env GLOFOX_BRANCH_ID) */
  branch_id?: string
}

export interface GlofoxCreateBookingResponse {
  _id?: string
  status?: string
  message?: string
  booking?: GlofoxBooking
}

export interface GlofoxCancelBookingResponse {
  _id?: string
  status?: string
  message?: string
}

// ─── Price / Checkout ────────────────────────────────────────────

export interface GlofoxPriceBreakdownRequest {
  model: 'event' | 'course' | 'appointment' | 'facility'
  model_id: string
  user_id: string
  discount_ids?: string[]
  promo_code?: string
}

export interface GlofoxPriceBreakdown {
  subtotal?: number
  discount_amount?: number
  tax_amount?: number
  total?: number
  currency?: string
  discount_name?: string
  tax_rate?: number
}

export interface GlofoxPriceBreakdownResponse {
  data?: GlofoxPriceBreakdown
  message?: string
}

// ─── Tax Configuration ───────────────────────────────────────────

export interface GlofoxTaxConfig {
  id?: string
  name?: string
  rate?: number
  description?: string
  branch_id?: string
}

export interface GlofoxTaxConfigResponse {
  data?: GlofoxTaxConfig[]
  taxes?: GlofoxTaxConfig[]
}

// ─── Programs ────────────────────────────────────────────────────

export interface GlofoxProgram {
  _id: string
  branch_id?: string
  name?: string
  description?: string
  active?: boolean
  modified?: number
}

// ─── Facilities ──────────────────────────────────────────────────

export interface GlofoxFacility {
  _id: string
  branch_id?: string
  name?: string
  description?: string
  capacity?: number
  active?: boolean
  modified?: number
}

// ─── Branches ────────────────────────────────────────────────────

export interface GlofoxBranch {
  _id: string
  name?: string
  address?: GlofoxAddress
  timezone?: string
  currency?: string
  active?: boolean
}

// ─── Categories ──────────────────────────────────────────────────

export interface GlofoxCategory {
  _id: string
  name?: string
  description?: string
  active?: boolean
}

// ─── Integrations ────────────────────────────────────────────────

export interface GlofoxIntegration {
  _id?: string
  provider?: string
  status?: string
  config?: Record<string, unknown>
}

// ─── Courses ─────────────────────────────────────────────────────

export interface GlofoxCourse {
  _id: string
  branch_id?: string
  name?: string
  description?: string
  program_id?: string
  start_date?: number
  end_date?: number
  sessions?: number
  size?: number
  price?: number
  active?: boolean
  modified?: number
}

// ─── CRM / Interactions ──────────────────────────────────────────

export interface GlofoxInteraction {
  _id?: string
  user_id?: string
  type?: string
  notes?: string
  created_by?: string
  created?: number
  modified?: number
}

export interface GlofoxCreateInteractionRequest {
  user_id: string
  type: string
  notes?: string
}

export interface GlofoxContactSource {
  _id?: string
  name?: string
  active?: boolean
}

export interface GlofoxMarketingSource {
  _id?: string
  name?: string
  active?: boolean
}

// ─── Agreements ──────────────────────────────────────────────────

export interface GlofoxSendAgreementRequest {
  user_id: string
  document_id: string
}

export interface GlofoxAgreementTemplate {
  _id: string
  name?: string
  content?: string
  active?: boolean
}

// ─── Appointments + Availability ─────────────────────────────────

export interface GlofoxAppointment {
  _id: string
  branch_id?: string
  user_id?: string
  trainer_id?: string
  type?: string
  status?: 'BOOKED' | 'CANCELED' | 'COMPLETED'
  time_start?: number
  duration?: number
  price?: number
  notes?: string
  created?: number
  modified?: number
}

export interface GlofoxAvailabilitySlot {
  start: number
  end: number
  trainer_id?: string
  available?: boolean
}

export interface GlofoxAppointmentAvailabilityResponse {
  data?: GlofoxAvailabilitySlot[]
  slots?: GlofoxAvailabilitySlot[]
}

// ─── Invoices ────────────────────────────────────────────────────

export interface GlofoxInvoice {
  _id: string
  branch_id?: string
  user_id?: string
  amount?: number
  currency?: string
  status?: string
  due_date?: number
  paid_date?: number
  items?: GlofoxInvoiceItem[]
  created?: number
  modified?: number
}

export interface GlofoxInvoiceItem {
  description?: string
  amount?: number
  quantity?: number
}

// ─── Access Records ──────────────────────────────────────────────

export interface GlofoxAccessRecordRequest {
  user_id: string
  branch_id?: string
  direction: 'in' | 'out'
}

// ─── Analytics Report Request ──────────────────────────────────

export interface GlofoxAnalyticsReportRequest {
  branch_id: string
  namespace: string
  start: string
  end: string
  secondStart?: number
  secondEnd?: number
  model?: string
  filter?: Record<string, unknown>
}
