import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  generateInsights,
  StudioMetricsContext,
  ClassMetrics,
} from "@/lib/ai/insights-generator";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

export const maxDuration = 30; // Netlify: allow up to 30s for DB queries + Claude API call

const ALLOWED_ROLES = ["owner", "manager"];
const DEDUP_WINDOW_DAYS = 7;

/**
 * POST /api/ai/insights/generate
 *
 * Trigger a full insight generation cycle.
 * Admin only (owner/manager).
 * Gathers studio metrics context (last 30 days), calls AI insight generator,
 * persists results to ai_insights table with fingerprint dedup.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();

    // ─── Auth ──────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Owner or manager role required." },
        { status: 403 }
      );
    }

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // ─── Gather Studio Metrics Context (last 30 days) ────────
    const now = new Date();
    const periodEnd = now.toISOString().split("T")[0];
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const previousPeriodStart = new Date(
      now.getTime() - 60 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];

    // B22 FIX: Parallelize all 7 context-gathering queries via Promise.all.
    // Previously sequential, adding up to ~10s before Claude was even called.
    // After this change: bottleneck is the single longest query (~1-2s).
    const [
      dailyMetricsRes,
      prevMetricsRes,
      totalActiveRes,
      classesRes,
      failedTxnRes,
      merchTxnRes,
      dropInTxnRes,
    ] = await Promise.all([
      // Daily metrics for current 30-day window
      supabase
        .from("daily_metrics")
        .select(
          "metric_date, total_bookings, total_check_ins, revenue_total, new_members, churned_members"
        )
        .eq("studio_id", studioId)
        .gte("metric_date", periodStart)
        .order("metric_date", { ascending: true }),

      // Revenue previous 30-day window
      supabase
        .from("daily_metrics")
        .select("revenue_total")
        .eq("studio_id", studioId)
        .gte("metric_date", previousPeriodStart)
        .lt("metric_date", periodStart),

      // Total active members
      supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("membership_status", "active"),

      // Classes in the period
      supabase
        .from("classes")
        .select("id, title, capacity, booked_count, checked_in_count")
        .eq("studio_id", studioId)
        .gte("starts_at", periodStart)
        .lte("starts_at", periodEnd + "T23:59:59"),

      // Failed transactions (outstanding payments)
      supabase
        .from("transactions")
        .select("amount")
        .eq("studio_id", studioId)
        .eq("status", "failed"),

      // Merch revenue
      supabase
        .from("transactions")
        .select("amount")
        .eq("studio_id", studioId)
        .eq("type", "merch")
        .eq("status", "completed")
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd + "T23:59:59"),

      // Drop-in revenue
      supabase
        .from("transactions")
        .select("amount")
        .eq("studio_id", studioId)
        .eq("type", "drop_in")
        .eq("status", "completed")
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd + "T23:59:59"),
    ]);

    const dailyMetrics = dailyMetricsRes.data;
    const prevMetrics = prevMetricsRes.data;
    const totalActive = totalActiveRes.count;
    const classes = classesRes.data;
    const failedTransactions = failedTxnRes.data;
    const merchTransactions = merchTxnRes.data;
    const dropInTransactions = dropInTxnRes.data;

    // Revenue current period (daily_metrics stores in cents — convert to dollars)
    const revenueCurrent =
      (dailyMetrics?.reduce((sum, d) => sum + (d.revenue_total ?? 0), 0) ?? 0) / 100;
    const newMembers30d =
      dailyMetrics?.reduce((sum, d) => sum + (d.new_members ?? 0), 0) ?? 0;
    const churnedMembers30d =
      dailyMetrics?.reduce((sum, d) => sum + (d.churned_members ?? 0), 0) ?? 0;

    const revenuePrevious =
      (prevMetrics?.reduce(
        (sum, d: { revenue_total: number }) => sum + (d.revenue_total ?? 0),
        0
      ) ?? 0) / 100;

    // Revenue trend
    let revenueTrend: "increasing" | "stable" | "declining" = "stable";
    if (revenuePrevious > 0) {
      const pctChange =
        ((revenueCurrent - revenuePrevious) / revenuePrevious) * 100;
      if (pctChange > 5) revenueTrend = "increasing";
      else if (pctChange < -5) revenueTrend = "declining";
    }

    const totalActiveMembers = totalActive ?? 0;
    const churnRate =
      totalActiveMembers > 0
        ? (churnedMembers30d / (totalActiveMembers + churnedMembers30d)) * 100
        : 0;
    const arpm =
      totalActiveMembers > 0 ? revenueCurrent / totalActiveMembers : 0;

    const classesList = classes ?? [];
    let totalFillRate = 0;
    const classTitleStats: Record<
      string,
      { totalBooked: number; totalCapacity: number; count: number }
    > = {};

    for (const cls of classesList) {
      const capacity = cls.capacity ?? 12;
      const booked = cls.booked_count ?? 0;
      totalFillRate += capacity > 0 ? (booked / capacity) * 100 : 0;

      const title = cls.title ?? "Untitled";
      if (!classTitleStats[title]) {
        classTitleStats[title] = { totalBooked: 0, totalCapacity: 0, count: 0 };
      }
      classTitleStats[title].totalBooked += booked;
      classTitleStats[title].totalCapacity += capacity;
      classTitleStats[title].count++;
    }

    const avgClassFillRate =
      classesList.length > 0 ? totalFillRate / classesList.length : 0;

    const classMetrics: ClassMetrics[] = Object.entries(classTitleStats)
      .map(([name, stats]) => ({
        class_name: name,
        avg_fill_rate:
          stats.totalCapacity > 0
            ? Math.round(
                (stats.totalBooked / stats.totalCapacity) * 1000
              ) / 10
            : 0,
        total_bookings: stats.totalBooked,
        trend: "stable" as const,
      }))
      .sort((a, b) => b.avg_fill_rate - a.avg_fill_rate);

    const topClasses = classMetrics.slice(0, 3);
    const bottomClasses = classMetrics.slice(-3).reverse();

    // Derived totals from the parallelized transaction queries above.
    const outstandingPayments =
      (failedTransactions?.reduce(
        (sum, t: { amount: number }) => sum + (t.amount ?? 0),
        0
      ) ?? 0) / 100;

    const merchRevenue =
      (merchTransactions?.reduce(
        (sum, t: { amount: number }) => sum + (t.amount ?? 0),
        0
      ) ?? 0) / 100;

    const dropInRevenue =
      (dropInTransactions?.reduce(
        (sum, t: { amount: number }) => sum + (t.amount ?? 0),
        0
      ) ?? 0) / 100;

    // ─── Build Context ───────────────────────────────────────
    const context: StudioMetricsContext = {
      studio_id: studioId,
      period_start: periodStart,
      period_end: periodEnd,
      revenue_current_30d: revenueCurrent,
      revenue_previous_30d: revenuePrevious,
      revenue_trend: revenueTrend,
      new_members_30d: newMembers30d,
      churned_members_30d: churnedMembers30d,
      total_active_members: totalActiveMembers,
      churn_rate_pct: Math.round(churnRate * 10) / 10,
      avg_class_fill_rate: Math.round(avgClassFillRate * 10) / 10,
      top_classes: topClasses,
      bottom_classes: bottomClasses,
      avg_revenue_per_member: Math.round(arpm * 100) / 100,
      outstanding_payments: outstandingPayments,
      merch_revenue_30d: merchRevenue,
      drop_in_revenue_30d: dropInRevenue,
    };

    // ─── Generate Insights ───────────────────────────────────
    const generated = await generateInsights(context);

    // ─── Fingerprint Dedup & Persist ─────────────────────────
    const dedupCutoff = new Date(
      now.getTime() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: existingInsights } = await supabase
      .from("ai_insights")
      .select("fingerprint")
      .eq("studio_id", studioId)
      .gte("generated_at", dedupCutoff);

    const existingFingerprints = new Set(
      (existingInsights ?? []).map(
        (i: { fingerprint: string }) => i.fingerprint
      )
    );

    const newInsights = generated.filter(
      (insight) => !existingFingerprints.has(insight.fingerprint)
    );

    const persisted = [];

    // B22 FIX: previous insert used 5 phantom columns (type, body,
    // suggested_action, generated_by, plus misnamed insight_type). Real
    // schema: insight_type, title, summary, detail?, data_points?,
    // recommended_action?, action_url?, urgency, status, fingerprint,
    // generated_at.
    //
    // The generator's enums don't match the DB CHECK constraints 1:1:
    //   urgency: low/medium/high/critical → info/suggestion/attention/urgent
    //   insight_type: churn/engagement/operational → retention/retention/anomaly
    //                 (revenue/scheduling/growth map 1:1)
    const URGENCY_MAP: Record<string, string> = {
      low: "info",
      medium: "suggestion",
      high: "attention",
      critical: "urgent",
    };
    const TYPE_MAP: Record<string, string> = {
      churn: "retention",
      engagement: "retention",
      operational: "anomaly",
      revenue: "revenue",
      scheduling: "scheduling",
      growth: "growth",
    };

    for (const insight of newInsights) {
      const mappedUrgency = URGENCY_MAP[insight.urgency] ?? "info";
      const mappedType = TYPE_MAP[insight.insight_type] ?? "growth";
      const { data: inserted, error: insertError } = await supabase
        .from("ai_insights")
        .insert({
          studio_id: studioId,
          insight_type: mappedType,
          urgency: mappedUrgency,
          title: insight.title,
          summary: insight.summary,
          recommended_action: insight.recommended_action,
          action_url: insight.action_url,
          fingerprint: insight.fingerprint,
          status: "active",
          generated_at: now.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to persist insight:", insertError);
        continue;
      }

      persisted.push(inserted);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "ai_insights_generated",
      subject_type: "ai_insights",
      metadata: {
        total_generated: generated.length,
        total_persisted: persisted.length,
        skipped_dedup: generated.length - newInsights.length,
      },
    });

    return NextResponse.json({
      data: persisted,
      summary: {
        generated: generated.length,
        persisted: persisted.length,
        skipped_dedup: generated.length - newInsights.length,
      },
      generated_at: now.toISOString(),
    });
  } catch (err) {
    console.error("POST /api/ai/insights/generate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
