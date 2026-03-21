import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * GET /api/analytics/daily-metrics
 * Fetch daily metric rows for a date range via the get_daily_metrics RPC function.
 * Query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // ─── Auth + Role Check ─────────────────────────────────────
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { studioId, supabase } = auth;

    // ─── RPC Call ─────────────────────────────────────────────
    const { data, error } = await supabase.rpc("get_daily_metrics", {
      p_studio_id: studioId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error("get_daily_metrics RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch daily metrics" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("GET /api/analytics/daily-metrics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
