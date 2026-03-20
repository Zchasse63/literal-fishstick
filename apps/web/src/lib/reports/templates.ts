import type { ReportType, ReportFilter } from "./engine";

// ─── Report Template Type ─────────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  report_type: ReportType;
  default_columns: string[];
  default_filters: ReportFilter[];
  default_sort: { field: string; direction: "asc" | "desc" };
}

// ─── Pre-Built Templates ──────────────────────────────────────────────────────

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "weekly-attendance",
    name: "Weekly Attendance Summary",
    description:
      "Bookings, check-ins, and no-shows for the past 7 days grouped by class.",
    report_type: "attendance",
    default_columns: [
      "id",
      "class.name",
      "class.start_time",
      "status",
      "checked_in_at",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "created_at", direction: "desc" },
  },
  {
    id: "monthly-revenue",
    name: "Monthly Revenue Report",
    description:
      "All transactions for the current month with totals by type.",
    report_type: "revenue",
    default_columns: [
      "id",
      "member.full_name",
      "type",
      "amount",
      "status",
      "description",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "created_at", direction: "desc" },
  },
  {
    id: "active-members",
    name: "Active Members Directory",
    description:
      "All currently active members with membership type, join date, and last visit.",
    report_type: "membership",
    default_columns: [
      "id",
      "full_name",
      "email",
      "phone",
      "membership_type",
      "membership_status",
      "joined_at",
      "last_visit_at",
    ],
    default_filters: [
      { field: "membership_status", operator: "eq", value: "active" },
    ],
    default_sort: { field: "joined_at", direction: "desc" },
  },
  {
    id: "trainer-payroll",
    name: "Trainer Payroll Summary",
    description:
      "Trainer payout amounts including class counts and bonus thresholds.",
    report_type: "trainer_payroll",
    default_columns: [
      "trainer.full_name",
      "snapshot_date",
      "classes_taught",
      "total_checkins",
      "bonus_classes",
      "payout_amount",
    ],
    default_filters: [],
    default_sort: { field: "snapshot_date", direction: "desc" },
  },
  {
    id: "trainer-performance",
    name: "Trainer Performance Dashboard",
    description:
      "Classes taught, average attendance, and check-in rates per trainer.",
    report_type: "trainer_performance",
    default_columns: [
      "trainer.full_name",
      "snapshot_date",
      "classes_taught",
      "total_checkins",
      "avg_fill_rate",
      "no_show_rate",
    ],
    default_filters: [],
    default_sort: { field: "total_checkins", direction: "desc" },
  },
  {
    id: "churn-risk",
    name: "Churn Risk Report",
    description:
      "Members with health scores below 40, sorted by risk level.",
    report_type: "churn_risk",
    default_columns: [
      "full_name",
      "email",
      "membership_type",
      "health_score",
      "last_visit_at",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "health_score", direction: "asc" },
  },
  {
    id: "class-performance",
    name: "Class Performance Report",
    description:
      "Fill rates, booking counts, and trainer assignment for all classes.",
    report_type: "class_performance",
    default_columns: [
      "id",
      "name",
      "start_time",
      "end_time",
      "capacity",
      "booked_count",
      "trainer.full_name",
      "status",
    ],
    default_filters: [],
    default_sort: { field: "start_time", direction: "desc" },
  },
  {
    id: "credit-pack-usage",
    name: "Credit Pack Usage",
    description:
      "Outstanding credit packs with usage rates and expiration status.",
    report_type: "credit_pack_usage",
    default_columns: [
      "member.full_name",
      "credits_total",
      "credits_used",
      "status",
      "expires_at",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "created_at", direction: "desc" },
  },
  {
    id: "failed-payments",
    name: "Failed Payments Log",
    description:
      "All failed payment transactions requiring attention or dunning follow-up.",
    report_type: "failed_payments",
    default_columns: [
      "id",
      "member.full_name",
      "member.email",
      "amount",
      "type",
      "description",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "created_at", direction: "desc" },
  },
  {
    id: "member-growth",
    name: "Member Growth & Churn",
    description:
      "Daily new member sign-ups and cancellations over time.",
    report_type: "member_movement",
    default_columns: [
      "date",
      "new_members",
      "churned_members",
      "total_active_members",
    ],
    default_filters: [],
    default_sort: { field: "date", direction: "desc" },
  },
  {
    id: "campaign-performance",
    name: "Campaign Performance",
    description:
      "Email and SMS campaign metrics: sends, opens, clicks, and unsubscribes.",
    report_type: "campaign_performance",
    default_columns: [
      "name",
      "type",
      "status",
      "sent_count",
      "delivered_count",
      "opened_count",
      "clicked_count",
      "bounced_count",
      "unsubscribed_count",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "created_at", direction: "desc" },
  },
  {
    id: "lead-pipeline",
    name: "Lead Pipeline",
    description:
      "All leads with status, source, score, and assigned staff member.",
    report_type: "lead_pipeline",
    default_columns: [
      "first_name",
      "last_name",
      "email",
      "phone",
      "status",
      "source",
      "score",
      "assigned_profile.full_name",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "created_at", direction: "desc" },
  },
  {
    id: "transaction-log",
    name: "Full Transaction Log",
    description:
      "Complete transaction history with member details and payment status.",
    report_type: "transaction_log",
    default_columns: [
      "id",
      "member.full_name",
      "member.email",
      "type",
      "amount",
      "status",
      "description",
      "created_at",
    ],
    default_filters: [],
    default_sort: { field: "created_at", direction: "desc" },
  },
];

/**
 * Find a report template by ID.
 */
export function getTemplateById(id: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id);
}
