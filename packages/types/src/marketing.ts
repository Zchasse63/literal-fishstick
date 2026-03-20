// Marketing & Campaign types — Phase 2 (Marketing & Engagement)

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'paused'
  | 'cancelled'

export type CampaignChannel = 'email' | 'sms' | 'push'

export interface Campaign {
  id: string
  studio_id: string
  name: string
  status: CampaignStatus
  channels: CampaignChannel[]

  // Targeting
  segment_id: string | null
  recipient_filter: Record<string, unknown> | null // ad-hoc filter when no saved segment
  estimated_recipients: number

  // Email content
  subject: string | null
  preview_text: string | null
  body_html: string | null
  body_text: string | null
  template_id: string | null

  // SMS content
  sms_body: string | null
  sms_char_count: number | null

  // Scheduling
  scheduled_at: string | null
  send_started_at: string | null
  send_completed_at: string | null

  // A/B testing
  ab_test_enabled: boolean
  ab_variants: ABVariant[] | null
  ab_winner_metric: 'open_rate' | 'click_rate' | 'conversion_rate' | null
  ab_winner_selected_at: string | null

  // Metrics (denormalized for fast reads)
  recipient_count: number
  delivered_count: number
  open_count: number
  unique_open_count: number
  click_count: number
  unique_click_count: number
  bounce_count: number
  unsubscribe_count: number
  spam_report_count: number
  conversion_count: number
  revenue_attributed: number // cents

  // Ownership
  created_by: string
  created_at: string
  updated_at: string
}

export interface ABVariant {
  id: string
  name: string // e.g. "Variant A", "Variant B"
  subject: string | null
  preview_text: string | null
  body_html: string | null
  weight: number // percentage 0-100
  is_winner: boolean
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  member_id: string
  studio_id: string
  channel: CampaignChannel
  variant_id: string | null // which A/B variant was sent

  // Delivery
  sent_at: string | null
  delivered_at: string | null
  bounced_at: string | null
  bounce_type: 'hard' | 'soft' | null

  // Engagement
  opened_at: string | null
  open_count: number
  clicked_at: string | null
  click_count: number
  unsubscribed_at: string | null
  spam_reported_at: string | null

  // Conversion
  converted_at: string | null
  conversion_value: number | null // cents

  created_at: string
}

// ---------------------------------------------------------------------------
// Automation Flows
// ---------------------------------------------------------------------------

export type AutomationTriggerType =
  | 'member_signup'
  | 'member_no_show'
  | 'member_churn_risk'
  | 'member_credit_expiry'
  | 'member_birthday'
  | 'member_milestone'
  | 'member_membership_change'
  | 'member_booking_completed'
  | 'payment_failed'
  | 'member_inactive'
  | 'member_referral'
  | 'manual'

export type AutomationStepType =
  | 'email'
  | 'wait'
  | 'condition'
  | 'sms'
  | 'tag'
  | 'update_field'

export interface AutomationStepEmail {
  type: 'email'
  subject: string
  body_html: string
  body_text: string | null
  template_id: string | null
}

export interface AutomationStepWait {
  type: 'wait'
  duration_value: number
  duration_unit: 'minutes' | 'hours' | 'days' | 'weeks'
}

export interface AutomationStepCondition {
  type: 'condition'
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'is_set' | 'is_not_set'
  value: unknown
  true_branch_step_id: string | null
  false_branch_step_id: string | null
}

export interface AutomationStepSMS {
  type: 'sms'
  body: string
}

export interface AutomationStepTag {
  type: 'tag'
  action: 'add' | 'remove'
  tag: string
}

export interface AutomationStepUpdateField {
  type: 'update_field'
  field: string
  value: unknown
}

export type AutomationStepConfig =
  | AutomationStepEmail
  | AutomationStepWait
  | AutomationStepCondition
  | AutomationStepSMS
  | AutomationStepTag
  | AutomationStepUpdateField

export interface AutomationStep {
  id: string
  order: number
  type: AutomationStepType
  config: AutomationStepConfig
  next_step_id: string | null // null = end of flow (or condition branches)
}

export interface AutomationFlow {
  id: string
  studio_id: string
  name: string
  description: string | null
  trigger: AutomationTriggerType
  trigger_config: Record<string, unknown> // trigger-specific params (e.g. days_inactive threshold)
  steps: AutomationStep[]
  is_active: boolean
  version: number
  allow_reenrollment: boolean
  reenrollment_cooldown_days: number | null
  exit_conditions: AutomationExitCondition[] | null

  // Metrics (denormalized)
  total_enrolled: number
  total_completed: number
  total_exited: number

  created_by: string
  created_at: string
  updated_at: string
}

export interface AutomationExitCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'is_set'
  value: unknown
}

export type AutomationEnrollmentStatus =
  | 'active'
  | 'completed'
  | 'exited'
  | 'paused'
  | 'failed'

export interface AutomationEnrollment {
  id: string
  automation_id: string
  member_id: string
  studio_id: string
  status: AutomationEnrollmentStatus
  current_step_id: string | null
  flow_snapshot: AutomationFlow // immutable copy of the flow at enrollment time
  inngest_function_id: string | null // Inngest function run ID for tracing
  processing_at: string | null // when the current step started processing

  // Exit tracking
  exit_reason: 'completed' | 'exit_condition_met' | 'manual' | 'error' | null
  error_message: string | null

  enrolled_at: string
  completed_at: string | null
  exited_at: string | null
  created_at: string
  updated_at: string
}

export interface AutomationCooldown {
  id: string
  automation_id: string
  member_id: string
  studio_id: string
  last_enrolled_at: string
  cooldown_until: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Lead Pipeline
// ---------------------------------------------------------------------------

export type LeadStatus = 'new' | 'contacted' | 'trial' | 'converted' | 'lost'

export type LeadSource =
  | 'website'
  | 'instagram'
  | 'facebook'
  | 'google'
  | 'referral'
  | 'walk_in'
  | 'event'
  | 'corporate'
  | 'manual'
  | 'import'
  | 'other'

export interface Lead {
  id: string
  studio_id: string

  // Contact info
  first_name: string
  last_name: string | null
  email: string
  phone: string | null

  // Dedup
  email_hash: string // lowercase SHA-256 for dedup lookups
  is_duplicate: boolean
  duplicate_of_id: string | null

  // Pipeline
  status: LeadStatus
  source: LeadSource
  source_detail: string | null // e.g. specific campaign name, referrer name

  // Scoring
  score: number // 0-100
  score_factors: Record<string, number> | null // breakdown of what contributed to score

  // Assignment
  assigned_to: string | null // staff member ID
  assigned_at: string | null

  // Conversion
  converted_member_id: string | null
  converted_at: string | null
  lost_reason: string | null

  // Metadata
  tags: string[]
  custom_fields: Record<string, unknown> | null
  notes: string | null

  first_seen_at: string
  last_activity_at: string | null
  created_at: string
  updated_at: string
}

export type LeadActivityType =
  | 'page_view'
  | 'form_submit'
  | 'email_opened'
  | 'email_clicked'
  | 'sms_replied'
  | 'call_logged'
  | 'note_added'
  | 'status_changed'
  | 'score_changed'
  | 'assigned'
  | 'trial_started'
  | 'trial_completed'
  | 'booking_made'
  | 'converted'
  | 'lost'

export interface LeadActivity {
  id: string
  lead_id: string
  studio_id: string
  type: LeadActivityType
  description: string | null
  metadata: Record<string, unknown> | null // type-specific data (e.g. page URL, email subject)
  performed_by: string | null // staff member ID if manual action
  created_at: string
}

// ---------------------------------------------------------------------------
// Content Hub
// ---------------------------------------------------------------------------

export type ContentPostStatus = 'draft' | 'published' | 'archived'
export type ContentPostType = 'announcement' | 'event' | 'article' | 'promotion' | 'community'

export interface ContentPost {
  id: string
  studio_id: string
  author_id: string
  author_role: 'admin' | 'trainer' | 'studio' | 'member'
  type: ContentPostType
  status: ContentPostStatus
  title: string | null
  content: string
  content_html: string | null
  image_url: string | null
  image_urls: string[] | null // multiple images
  is_pinned: boolean
  is_approved: boolean
  requires_approval: boolean
  visibility: 'public' | 'members_only' | 'staff_only'

  // Engagement (denormalized)
  like_count: number
  comment_count: number
  share_count: number
  view_count: number

  // Metadata
  tags: string[]
  expires_at: string | null

  created_at: string
  updated_at: string
}

export interface ContentComment {
  id: string
  post_id: string
  studio_id: string
  author_id: string
  author_role: 'admin' | 'trainer' | 'studio' | 'member'
  parent_comment_id: string | null // for threaded replies
  content: string
  is_approved: boolean
  like_count: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Email Preferences
// ---------------------------------------------------------------------------

export interface EmailPreferences {
  id: string
  member_id: string
  studio_id: string

  // Channel opt-ins
  marketing_email: boolean
  marketing_sms: boolean
  marketing_push: boolean

  // Transactional (always on, but can suppress)
  transactional_email: boolean
  transactional_sms: boolean
  transactional_push: boolean

  // Hard bounce tracking
  hard_bounced: boolean
  hard_bounced_at: string | null
  hard_bounce_count: number
  last_bounce_reason: string | null

  // Unsubscribe tracking
  unsubscribed_at: string | null
  unsubscribe_reason: string | null

  created_at: string
  updated_at: string
}
