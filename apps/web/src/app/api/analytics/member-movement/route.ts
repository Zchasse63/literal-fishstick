import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * GET /api/analytics/member-movement
 * New members, churned members, and net change per period.
 * Query params: start_date, end_date, group_by (day|week|month)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const groupBy = searchParams.get("group_by") ?? "day";

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (!["day", "week", "month"].includes(groupBy)) {
      return NextResponse.json(
        { error: "group_by must be one of: day, week, month" },
        { status: 400 }
      );
    }

    // ─── Auth + Role Check ─────────────────────────────────────
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { studioId, supabase } = auth;

    // ─── Query daily_metrics ──────────────────────────────────
    const { data: rows, error } = await supabase
      .from("daily_metrics")
      .select("metric_date, new_members, churned_members")
      .eq("studio_id", studioId)
      .gte("metric_date", startDate)
      .lte("metric_date", endDate)
      .order("metric_date", { ascending: true });

    if (error) {
      console.error("member-movement query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch member movement data" },
        { status: 500 }
      );
    }

    const metrics = rows ?? [];

    // ─── Group data by period ─────────────────────────────────
    const getPeriodKey = (dateStr: string): string => {
      const date = new Date(dateStr + "T00:00:00");
      switch (groupBy) {
        case "day":
          return dateStr;
        case "week": {
          // ISO week start (Monday)
          const d = new Date(date);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          d.setDate(diff);
          return d.toISOString().split("T")[0]!;
        }
        case "month":
          return dateStr.slice(0, 7);
        default:
          return dateStr;
      }
    };

    const periodMap: Record<
      string,
      { new_members: number; churned_members: number }
    > = {};

    for (const row of metrics) {
      const key = getPeriodKey(row.metric_date);
      if (!periodMap[key]) {
        periodMap[key] = { new_members: 0, churned_members: 0 };
      }
      periodMap[key].new_members += row.new_members ?? 0;
      periodMap[key].churned_members += row.churned_members ?? 0;
    }

    const periods = Object.entries(periodMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({
        period,
        new_members: values.new_members,
        churned_members: values.churned_members,
        net_change: values.new_members - values.churned_members,
      }));

    // ─── Totals ───────────────────────────────────────────────
    const totalNew = periods.reduce((s, p) => s + p.new_members, 0);
    const totalChurned = periods.reduce((s, p) => s + p.churned_members, 0);

    return NextResponse.json({
      data: {
        start_date: startDate,
        end_date: endDate,
        group_by: groupBy,
        totals: {
          new_members: totalNew,
          churned_members: totalChurned,
          net_change: totalNew - totalChurned,
        },
        periods,
      },
    });
  } catch (err) {
    console.error("GET /api/analytics/member-movement error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
