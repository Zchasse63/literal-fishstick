/**
 * Glofox Integration Module
 *
 * API client, entity transformers, and type definitions for syncing
 * Glofox data into Meridian's Supabase backend.
 */

// Client
export { GlofoxClient, getGlofoxClient, unixToISO, isoToUnix } from './client'

// Transformers
export {
  transformMember,
  transformStaff,
  transformEvent,
  transformBooking,
  transformTransaction,
  transformMembershipPlan,
  transformCreditPack,
  transformLead,
} from './transformers'

// Transformer output types
export type {
  ProfileRow,
  MemberRow,
  ClassRow,
  BookingRow,
  TransactionRow,
  MembershipPlanRow,
  CreditPackRow,
  LeadRow,
  TransformedMember,
  TransformedClass,
  TransformedBooking,
  TransformedTransaction,
  TransformedCreditPack,
} from './transformers'

// Glofox API types
export type {
  GlofoxConfig,
  GlofoxPaginatedResponse,
  GlofoxMember,
  GlofoxStaff,
  GlofoxEvent,
  GlofoxBooking,
  GlofoxTransaction,
  GlofoxMembership,
  GlofoxMembershipPlan,
  GlofoxCreditPack,
  GlofoxLead,
  GlofoxProduct,
  GlofoxWaiver,
  GlofoxAgreement,
  GlofoxTrainerPerformance,
  GlofoxConsent,
  GlofoxAddress,
  GlofoxEmergencyContact,
  GlofoxEmbeddedMembership,
  GlofoxLeadInfo,
  GlofoxAnalyticsReportRequest,
} from './types'
