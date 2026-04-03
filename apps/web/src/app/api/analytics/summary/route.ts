import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * GET /api/analytics/summary
 * KPI summary cards: MRR, ARPM, active members, monthly churn rate,
 * avg fill rate, revenue MTD. Includes trend vs previous period.
 */
export async function GET(request: NextRequest) {
  try {
    // Suppress unused variable warning — nextUrl is available if needed later
    void request;

    // ─── Auth + Role Check ─────────────────────────────────────
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { studioId, supabase } = auth;

    // ─── Get latest daily_metrics row ─────────────────────────
    const { data: latestMetric } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("studio_id", studioId)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ─── Get previous month's last metric for trend comparison ─
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfPrevMonth = new Date(firstOfMonth.getTime() - 86400000);

    const { data: prevMetric } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("studio_id", studioId)
      .lte("metric_date", lastOfPrevMonth.toISOString().split("T")[0])
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ─── Revenue MTD from daily_metrics ───────────────────────
    const { data: mtdRows } = await supabase
      .from("daily_metrics")
      .select("revenue_total")
      .eq("studio_id", studioId)
      .gte("metric_date", firstOfMonth.toISOString().split("T")[0])
      .lte("metric_date", now.toISOString().split("T")[0]);

    // daily_metrics stores revenue_total in cents — convert to dollars
    const revenueMtd = (mtdRows ?? []).reduce(
      (sum, r) => sum + (r.revenue_total ?? 0),
      0
    ) / 100;

    // ─── Previous month total revenue for trend ───────────────
    const { data: prevMtdRows } = await supabase
      .from("daily_metrics")
      .select("revenue_total")
      .eq("studio_id", studioId)
      .gte("metric_date", firstOfPrevMonth.toISOString().split("T")[0])
      .lte("metric_date", lastOfPrevMonth.toISOString().split("T")[0]);

    const prevRevenueMtd = (prevMtdRows ?? []).reduce(
      (sum, r) => sum + (r.revenue_total ?? 0),
      0
    ) / 100;

    // ─── Live query: active members count ─────────────────────
    const { count: activeMembersCount } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("membership_status", "active");

    const activeMembers = activeMembersCount ?? 0;

    // ─── Compute KPIs ─────────────────────────────────────────
    // daily_metrics stores mrr in cents — convert to dollars
    const mrr = (latestMetric?.mrr ?? 0) / 100;
    const prevMrr = (prevMetric?.mrr ?? 0) / 100;
    const arpm = activeMembers > 0 ? Math.round((mrr / activeMembers) * 100) / 100 : 0;
    const prevActiveMembers = prevMetric?.active_members ?? 0;
    const prevArpm =
      prevActiveMembers > 0
        ? Math.round((prevMrr / prevActiveMembers) * 100) / 100
        : 0;
    // Compute churn rate from churned_members / active_members
    const churnRate = (latestMetric?.active_members ?? 0) > 0
      ? (latestMetric?.churned_members ?? 0) / (latestMetric?.active_members ?? 1)
      : 0;
    const prevChurnRate = (prevMetric?.active_members ?? 0) > 0
      ? (prevMetric?.churned_members ?? 0) / (prevMetric?.active_members ?? 1)
      : 0;
    const avgFillRate = latestMetric?.avg_class_fill_rate ?? 0;
    const prevAvgFillRate = prevMetric?.avg_class_fill_rate ?? 0;

    // Helper for trend calculation
    const trend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 10000) / 100;
    };

    return NextResponse.json({
      data: {
        mrr: {
          value: Math.round(mrr * 100) / 100,
          trend: trend(mrr, prevMrr),
        },
        arpm: {
          value: arpm,
          trend: trend(arpm, prevArpm),
        },
        active_members: {
          value: activeMembers,
          trend: trend(activeMembers, prevActiveMembers),
        },
        monthly_churn_rate: {
          value: Math.round(churnRate * 10000) / 100,
          trend: trend(churnRate, prevChurnRate),
        },
        avg_fill_rate: {
          value: Math.round(avgFillRate * 10000) / 100,
          trend: trend(avgFillRate, prevAvgFillRate),
        },
        revenue_mtd: {
          value: Math.round(revenueMtd * 100) / 100,
          trend: trend(revenueMtd, prevRevenueMtd),
        },
        as_of: latestMetric?.metric_date ?? null,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error("GET /api/analytics/summary error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
