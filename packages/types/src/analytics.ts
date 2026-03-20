// Analytics & Intelligence types — Phase 3

// ---------------------------------------------------------------------------
// Daily Metrics (aggregated daily snapshot)
// ---------------------------------------------------------------------------

export interface DailyMetrics {
  id: string
  studio_id: string
  metric_date: string // YYYY-MM-DD

  // Booking metrics
  total_bookings: number
  total_check_ins: number
  total_no_shows: number
  total_cancellations: number
  total_late_cancellations: number
  total_walk_ins: number
  unique_members_booked: number
  avg_class_utilization: number // 0-100 percentage

  // Revenue metrics (all in cents)
  total_revenue: number
  membership_revenue: number
  credit_pack_revenue: number
  drop_in_revenue: number
  merch_revenue: number
  gift_card_revenue: number
  event_revenue: number
  refund_total: number

  // Member metrics
  new_members: number
  churned_members: number // cancellations effective today
  active_members: number // snapshot at end of day
  total_members: number

  // Class metrics
  classes_held: number
  classes_cancelled: number
  avg_attendance: number // avg check-ins per class

  // Engagement
  new_leads: number
  leads_converted: number

  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Cohort Snapshots (monthly retention tracking)
// ---------------------------------------------------------------------------

export interface CohortSnapshot {
  id: string
  studio_id: string
  cohort_month: string // YYYY-MM — the month members joined
  measurement_month: string // YYYY-MM — the month we're measuring retention
  months_since_join: number // 0, 1, 2, ... (measurement_month - cohort_month)
  cohort_size: number // members who joined in cohort_month
  active_count: number // members from this cohort still active in measurement_month
  retention_rate: number // 0-100 percentage (active_count / cohort_size * 100)
  created_at: string
}

// ---------------------------------------------------------------------------
// Trainer Metric Snapshots (monthly per-trainer aggregation)
// ---------------------------------------------------------------------------

export interface TrainerMetricSnapshot {
  id: string
  studio_id: string
  trainer_id: string
  period_month: string // YYYY-MM

  // Performance
  total_classes: number
  total_check_ins: number // excluding trainer's own attendance
  avg_attendance: number // avg check-ins per class
  classes_above_bonus_threshold: number
  max_attendance: number
  min_attendance: number

  // Compensation (all in cents)
  base_pay: number
  bonus_pay: number
  commission_pay: number
  total_compensation: number

  // Ratings / scores
  avg_class_rating: number | null // from member feedback, 1-5

  // AI-generated narrative & analysis
  ai_narrative: string | null // 3-5 sentence performance summary
  ai_highlights: string[] | null // top strengths
  ai_growth_areas: string[] | null // areas for improvement
  ai_overall_rating: number | null // AI-assessed 1-10 score

  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Saved Reports
// ---------------------------------------------------------------------------

export type ReportType =
  | 'attendance'
  | 'revenue'
  | 'membership'
  | 'trainer_payroll'
  | 'trainer_performance'
  | 'churn_risk'
  | 'class_performance'
  | 'credit_pack_usage'
  | 'transaction_log'
  | 'failed_payments'
  | 'member_movement'
  | 'campaign_performance'
  | 'lead_pipeline'
  | 'custom'

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'

export interface SavedReport {
  id: string
  studio_id: string
  name: string
  description: string | null
  report_type: ReportType
  filters: Record<string, unknown> // date range, segments, trainer IDs, etc.
  columns: string[] | null // selected columns for the report
  sort_by: string | null
  sort_direction: 'asc' | 'desc'
  group_by: string | null

  // Scheduling
  schedule_frequency: ScheduleFrequency | null // null = no schedule
  schedule_recipients: string[] | null // email addresses
  next_send_at: string | null
  last_sent_at: string | null

  // Ownership
  created_by: string
  is_shared: boolean
  shared_with: string[] | null // user IDs

  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Report Exports
// ---------------------------------------------------------------------------

export type ExportFormat = 'csv' | 'pdf'

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ReportExport {
  id: string
  studio_id: string
  report_id: string | null // null for ad-hoc exports
  report_type: ReportType
  format: ExportFormat
  status: ExportStatus
  file_url: string | null // Supabase Storage URL
  file_size_bytes: number | null
  row_count: number | null
  filters: Record<string, unknown>
  error_message: string | null
  requested_by: string
  expires_at: string // auto-cleanup date
  created_at: string
  completed_at: string | null
}

// ---------------------------------------------------------------------------
// AI Insights
// ---------------------------------------------------------------------------

export type InsightType =
  | 'scheduling'
  | 'pricing'
  | 'retention'
  | 'revenue'
  | 'trainer'
  | 'growth'
  | 'anomaly'
  | 'seasonal'
  | 'cross_sell'

export type InsightUrgency = 'info' | 'suggestion' | 'attention' | 'urgent'

export type InsightStatus = 'active' | 'dismissed' | 'actioned' | 'expired'

export interface AIInsight {
  id: string
  studio_id: string
  insight_type: InsightType
  urgency: InsightUrgency
  status: InsightStatus
  title: string
  summary: string // 2-3 sentence explanation
  detail: string | null // longer markdown explanation
  data_points: Record<string, unknown> | null // supporting data
  recommended_action: string | null
  action_url: string | null // deep link into the dashboard
  fingerprint: string // dedup hash — same insight within 7 days is skipped
  impact_estimate: string | null // e.g. "+$500/mo revenue", "-3% churn"

  // Tracking
  dismissed_by: string | null
  dismissed_at: string | null
  actioned_by: string | null
  actioned_at: string | null
  expires_at: string | null

  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Pricing Simulation
// ---------------------------------------------------------------------------

export type SimulationStatus = 'draft' | 'analyzed' | 'applied' | 'reverted'

export interface PricingSimulationChange {
  plan_id: string
  plan_name: string
  current_price: number // cents
  proposed_price: number // cents
  change_pct: number // percentage change
}

export interface PricingSimulationImpact {
  projected_mrr_change: number // cents
  projected_churn_impact: number // percentage point change
  projected_new_member_impact: number // percentage point change
  affected_members: number
  confidence: number // 0-100
  reasoning: string
}

export interface PricingSimulation {
  id: string
  studio_id: string
  name: string
  description: string | null
  status: SimulationStatus
  changes: PricingSimulationChange[]
  impact: PricingSimulationImpact | null // null until analyzed
  ai_recommendation: string | null // AI narrative on the proposed changes
  applied_at: string | null
  applied_by: string | null
  reverted_at: string | null
  reverted_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Glofox Migration
// ---------------------------------------------------------------------------

export type MigrationWave = 1 | 2 | 3

export type MigrationDataType =
  | 'members'
  | 'bookings'
  | 'transactions'
  | 'classes'
  | 'credit_balances'
  | 'memberships'
  | 'promo_codes'

export type MigrationStatus =
  | 'pending'
  | 'validating'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'rolled_back'

export interface MigrationJob {
  id: string
  studio_id: string
  wave: MigrationWave
  data_type: MigrationDataType
  status: MigrationStatus
  source_file_url: string | null // uploaded CSV/JSON
  total_rows: number | null
  processed_rows: number
  failed_rows: number
  skipped_rows: number
  error_log: MigrationError[] | null
  validation_warnings: string[] | null
  rollback_snapshot_id: string | null // reference for rollback
  started_at: string | null
  completed_at: string | null
  rolled_back_at: string | null
  rolled_back_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface MigrationError {
  row_number: number
  field: string | null
  message: string
  severity: 'error' | 'warning'
  raw_data: Record<string, unknown> | null
}
