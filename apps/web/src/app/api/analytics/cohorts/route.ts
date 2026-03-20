import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/cohorts
 * Fetch cohort retention data for a retention heatmap.
 * Query params: months_back (default 12)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const monthsBack = Math.min(
      Math.max(parseInt(searchParams.get("months_back") ?? "12", 10), 1),
      36
    );

    // ─── Auth ──────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // ─── Query cohort_snapshots ───────────────────────────────
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const { data: snapshots, error } = await supabase
      .from("cohort_snapshots")
      .select("*")
      .eq("studio_id", studioId)
      .gte("cohort_month", cutoffStr)
      .order("cohort_month", { ascending: true })
      .order("months_since_join", { ascending: true });

    if (error) {
      console.error("cohort_snapshots query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch cohort data" },
        { status: 500 }
      );
    }

    // ─── Format for retention heatmap ─────────────────────────
    // Group by cohort_month, then build retention array per cohort
    const cohortMap: Record<
      string,
      {
        cohort_month: string;
        initial_members: number;
        retention: { month: number; retained: number; rate: number }[];
      }
    > = {};

    for (const row of snapshots ?? []) {
      const key = row.cohort_month;
      if (!cohortMap[key]) {
        cohortMap[key] = {
          cohort_month: key,
          initial_members: row.initial_members ?? 0,
          retention: [],
        };
      }
      cohortMap[key].retention.push({
        month: row.months_since_join,
        retained: row.retained_members ?? 0,
        rate:
          row.initial_members > 0
            ? Math.round(
                ((row.retained_members ?? 0) / row.initial_members) * 10000
              ) / 100
            : 0,
      });
    }

    const cohorts = Object.values(cohortMap);

    return NextResponse.json({
      data: {
        months_back: monthsBack,
        cohorts,
      },
    });
  } catch (err) {
    console.error("GET /api/analytics/cohorts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
