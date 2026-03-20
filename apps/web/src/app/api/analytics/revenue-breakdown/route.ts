import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/revenue-breakdown
 * Revenue grouped by source: memberships, credit_packs, drop_ins, merch,
 * gift_cards, corporate, events.
 * Query params: start_date, end_date
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

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

    // ─── Query daily_metrics for date range ───────────────────
    const { data: rows, error } = await supabase
      .from("daily_metrics")
      .select(
        "metric_date, revenue_memberships, revenue_credit_packs, revenue_drop_ins, revenue_merch, revenue_gift_cards, revenue_corporate, revenue_events, revenue_total"
      )
      .eq("studio_id", studioId)
      .gte("metric_date", startDate)
      .lte("metric_date", endDate)
      .order("metric_date", { ascending: true });

    if (error) {
      console.error("revenue-breakdown query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch revenue breakdown" },
        { status: 500 }
      );
    }

    const metrics = rows ?? [];

    // ─── Aggregate totals by source ───────────────────────────
    const sources = [
      "memberships",
      "credit_packs",
      "drop_ins",
      "merch",
      "gift_cards",
      "corporate",
      "events",
    ] as const;

    const totals: Record<string, number> = {};
    let grandTotal = 0;

    for (const source of sources) {
      const key = `revenue_${source}` as keyof (typeof metrics)[number];
      const sum = metrics.reduce(
        (acc, row) => acc + ((row[key] as number) ?? 0),
        0
      );
      totals[source] = Math.round(sum * 100) / 100;
      grandTotal += sum;
    }

    grandTotal = Math.round(grandTotal * 100) / 100;

    // ─── Build breakdown with percentages ─────────────────────
    const breakdown = sources.map((source) => ({
      source,
      total: totals[source],
      percentage:
        grandTotal > 0
          ? Math.round((totals[source] / grandTotal) * 10000) / 100
          : 0,
    }));

    // ─── Daily time series ────────────────────────────────────
    const daily = metrics.map((row) => ({
      date: row.metric_date,
      memberships: row.revenue_memberships ?? 0,
      credit_packs: row.revenue_credit_packs ?? 0,
      drop_ins: row.revenue_drop_ins ?? 0,
      merch: row.revenue_merch ?? 0,
      gift_cards: row.revenue_gift_cards ?? 0,
      corporate: row.revenue_corporate ?? 0,
      events: row.revenue_events ?? 0,
      total: row.revenue_total ?? 0,
    }));

    return NextResponse.json({
      data: {
        start_date: startDate,
        end_date: endDate,
        grand_total: grandTotal,
        breakdown,
        daily,
      },
    });
  } catch (err) {
    console.error("GET /api/analytics/revenue-breakdown error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
