import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportType =
  | "attendance"
  | "revenue"
  | "membership"
  | "trainer_payroll"
  | "trainer_performance"
  | "churn_risk"
  | "class_performance"
  | "credit_pack_usage"
  | "transaction_log"
  | "failed_payments"
  | "member_movement"
  | "campaign_performance"
  | "lead_pipeline"
  | "custom";

export interface ReportFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "ilike";
  value: string | number | boolean | string[];
}

export interface SavedReportConfig {
  report_type: ReportType;
  columns: string[];
  filters: ReportFilter[];
  time_range?: { from: string; to: string };
  group_by?: string;
  sort_by?: string;
  sort_direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  total_count: number;
  summary: Record<string, number>;
}

// ─── Table Mapping ────────────────────────────────────────────────────────────

interface TableConfig {
  table: string;
  select: string;
  date_field: string;
  summary_fields: { key: string; aggregate: "count" | "sum" | "avg"; field?: string }[];
}

const TABLE_CONFIGS: Record<Exclude<ReportType, "custom">, TableConfig> = {
  attendance: {
    table: "bookings",
    select: "*, class:classes!bookings_class_id_fkey(id, name, capacity, start_time, end_time, trainer_id)",
    date_field: "created_at",
    summary_fields: [
      { key: "total_bookings", aggregate: "count" },
    ],
  },
  revenue: {
    table: "transactions",
    select: "*, member:profiles!transactions_member_id_fkey(id, full_name, email)",
    date_field: "created_at",
    summary_fields: [
      { key: "total_transactions", aggregate: "count" },
      { key: "total_revenue", aggregate: "sum", field: "amount" },
      { key: "avg_transaction", aggregate: "avg", field: "amount" },
    ],
  },
  membership: {
    table: "profiles",
    select: "id, full_name, email, phone, membership_type, membership_status, joined_at, health_score, last_visit_at, created_at",
    date_field: "created_at",
    summary_fields: [
      { key: "total_members", aggregate: "count" },
    ],
  },
  trainer_payroll: {
    table: "trainer_metric_snapshots",
    select: "*, trainer:profiles!trainer_metric_snapshots_trainer_id_fkey(id, full_name, email)",
    date_field: "snapshot_date",
    summary_fields: [
      { key: "total_records", aggregate: "count" },
      { key: "total_payout", aggregate: "sum", field: "payout_amount" },
    ],
  },
  trainer_performance: {
    table: "trainer_metric_snapshots",
    select: "*, trainer:profiles!trainer_metric_snapshots_trainer_id_fkey(id, full_name, email)",
    date_field: "snapshot_date",
    summary_fields: [
      { key: "total_snapshots", aggregate: "count" },
      { key: "total_classes", aggregate: "sum", field: "classes_taught" },
      { key: "total_checkins", aggregate: "sum", field: "total_checkins" },
    ],
  },
  churn_risk: {
    table: "profiles",
    select: "id, full_name, email, phone, membership_type, membership_status, health_score, last_visit_at, created_at",
    date_field: "created_at",
    summary_fields: [
      { key: "at_risk_members", aggregate: "count" },
    ],
  },
  class_performance: {
    table: "classes",
    select: "*, trainer:profiles!classes_trainer_id_fkey(id, full_name)",
    date_field: "start_time",
    summary_fields: [
      { key: "total_classes", aggregate: "count" },
    ],
  },
  credit_pack_usage: {
    table: "credit_packs",
    select: "*, member:profiles!credit_packs_member_id_fkey(id, full_name, email)",
    date_field: "created_at",
    summary_fields: [
      { key: "total_packs", aggregate: "count" },
      { key: "total_credits_purchased", aggregate: "sum", field: "credits_total" },
      { key: "total_credits_used", aggregate: "sum", field: "credits_used" },
    ],
  },
  transaction_log: {
    table: "transactions",
    select: "*, member:profiles!transactions_member_id_fkey(id, full_name, email)",
    date_field: "created_at",
    summary_fields: [
      { key: "total_transactions", aggregate: "count" },
      { key: "total_amount", aggregate: "sum", field: "amount" },
    ],
  },
  failed_payments: {
    table: "transactions",
    select: "*, member:profiles!transactions_member_id_fkey(id, full_name, email)",
    date_field: "created_at",
    summary_fields: [
      { key: "total_failed", aggregate: "count" },
      { key: "total_failed_amount", aggregate: "sum", field: "amount" },
    ],
  },
  member_movement: {
    table: "daily_metrics",
    select: "*",
    date_field: "date",
    summary_fields: [
      { key: "total_days", aggregate: "count" },
      { key: "total_new_members", aggregate: "sum", field: "new_members" },
      { key: "total_churned_members", aggregate: "sum", field: "churned_members" },
    ],
  },
  campaign_performance: {
    table: "campaigns",
    select: "*",
    date_field: "created_at",
    summary_fields: [
      { key: "total_campaigns", aggregate: "count" },
      { key: "total_sent", aggregate: "sum", field: "sent_count" },
      { key: "total_opened", aggregate: "sum", field: "opened_count" },
      { key: "total_clicked", aggregate: "sum", field: "clicked_count" },
    ],
  },
  lead_pipeline: {
    table: "leads",
    select: "*, assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, email)",
    date_field: "created_at",
    summary_fields: [
      { key: "total_leads", aggregate: "count" },
    ],
  },
};

// ─── Filter Applicator ────────────────────────────────────────────────────────

function applyFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filter: ReportFilter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { field, operator, value } = filter;

  switch (operator) {
    case "eq":
      return query.eq(field, value);
    case "neq":
      return query.neq(field, value);
    case "gt":
      return query.gt(field, value);
    case "gte":
      return query.gte(field, value);
    case "lt":
      return query.lt(field, value);
    case "lte":
      return query.lte(field, value);
    case "in":
      return query.in(field, Array.isArray(value) ? value : [value]);
    case "ilike":
      return query.ilike(field, `%${value}%`);
    default:
      return query;
  }
}

// ─── Summary Calculator ───────────────────────────────────────────────────────

function calculateSummary(
  rows: Record<string, unknown>[],
  summaryFields: TableConfig["summary_fields"]
): Record<string, number> {
  const summary: Record<string, number> = {};

  for (const sf of summaryFields) {
    switch (sf.aggregate) {
      case "count":
        summary[sf.key] = rows.length;
        break;
      case "sum":
        summary[sf.key] = rows.reduce((acc, row) => {
          const val = sf.field ? (row[sf.field] as number) : 0;
          return acc + (typeof val === "number" ? val : 0);
        }, 0);
        break;
      case "avg": {
        const values = rows
          .map((row) => (sf.field ? (row[sf.field] as number) : 0))
          .filter((v) => typeof v === "number");
        summary[sf.key] =
          values.length > 0
            ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
            : 0;
        break;
      }
    }
  }

  return summary;
}

// ─── Report Engine ────────────────────────────────────────────────────────────

export async function generateReport(
  supabase: SupabaseClient,
  studioId: string,
  config: SavedReportConfig
): Promise<ReportResult> {
  const {
    report_type,
    filters = [],
    time_range,
    sort_by,
    sort_direction = "desc",
    limit = 1000,
    offset = 0,
  } = config;

  // ─── Custom report type — dynamic table from filters ─────────────────
  if (report_type === "custom") {
    const tableName = filters.find((f) => f.field === "__table")?.value as string;
    if (!tableName) {
      return { rows: [], total_count: 0, summary: {} };
    }

    const realFilters = filters.filter((f) => f.field !== "__table");
    const selectCols = config.columns.length > 0 ? config.columns.join(", ") : "*";

    let query = supabase
      .from(tableName)
      .select(selectCols, { count: "exact" })
      .eq("studio_id", studioId)
      .range(offset, offset + limit - 1);

    for (const filter of realFilters) {
      query = applyFilter(query, filter);
    }

    if (time_range?.from) {
      query = query.gte("created_at", time_range.from);
    }
    if (time_range?.to) {
      query = query.lte("created_at", time_range.to);
    }

    if (sort_by) {
      query = query.order(sort_by, { ascending: sort_direction === "asc" });
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Custom report query failed: ${error.message}`);
    }

    return {
      rows: (data as unknown as Record<string, unknown>[]) ?? [],
      total_count: count ?? 0,
      summary: { total_rows: count ?? 0 },
    };
  }

  // ─── Standard report types ───────────────────────────────────────────
  const tableConfig = TABLE_CONFIGS[report_type];
  if (!tableConfig) {
    throw new Error(`Unknown report type: ${report_type}`);
  }

  const { table, select, date_field, summary_fields } = tableConfig;

  let query = supabase
    .from(table)
    .select(select, { count: "exact" })
    .eq("studio_id", studioId)
    .range(offset, offset + limit - 1);

  // ─── Report-specific default filters ─────────────────────────────────
  if (report_type === "failed_payments") {
    query = query.eq("status", "failed");
  }

  if (report_type === "churn_risk") {
    // Members with low health score or flagged by AI
    query = query.lte("health_score", 40).not("health_score", "is", null);
  }

  // ─── Time range ──────────────────────────────────────────────────────
  if (time_range?.from) {
    query = query.gte(date_field, time_range.from);
  }
  if (time_range?.to) {
    query = query.lte(date_field, time_range.to);
  }

  // ─── User filters ───────────────────────────────────────────────────
  for (const filter of filters) {
    query = applyFilter(query, filter);
  }

  // ─── Sorting ─────────────────────────────────────────────────────────
  if (sort_by) {
    query = query.order(sort_by, { ascending: sort_direction === "asc" });
  } else {
    query = query.order(date_field, { ascending: false });
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Report query failed (${report_type}): ${error.message}`);
  }

  const rows = (data as unknown as Record<string, unknown>[]) ?? [];
  const summary = calculateSummary(rows, summary_fields);

  // Use the DB count for total_count, not the in-memory count
  summary.total_count = count ?? rows.length;

  return {
    rows,
    total_count: count ?? rows.length,
    summary,
  };
}
