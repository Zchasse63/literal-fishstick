import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/revenue
 * Revenue analytics with time period filter.
 * Query params: period=7d|30d|90d|12m
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const period = searchParams.get("period") ?? "30d";

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

    // Calculate the start date based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "12m":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid period. Use 7d, 30d, 90d, or 12m" },
          { status: 400 }
        );
    }

    // Fetch all completed transactions in the period
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("id, amount, type, created_at")
      .eq("studio_id", studioId)
      .eq("status", "completed")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", now.toISOString());

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const txns = transactions ?? [];

    // Compute aggregates
    const totalRevenue = txns.reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const transactionCount = txns.length;
    const avgTransaction =
      transactionCount > 0
        ? Math.round((totalRevenue / transactionCount) * 100) / 100
        : 0;

    // Revenue by type
    const revenueByType: Record<string, number> = {};
    for (const t of txns) {
      const type = t.type ?? "other";
      revenueByType[type] = (revenueByType[type] ?? 0) + (t.amount ?? 0);
    }

    // Revenue by day (for 7d/30d) or by month (for 90d/12m)
    const revenueByPeriod: Record<string, number> = {};
    for (const t of txns) {
      const date = new Date(t.created_at);
      let key: string;
      if (period === "90d" || period === "12m") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else {
        key = date.toISOString().split("T")[0]!;
      }
      revenueByPeriod[key] = (revenueByPeriod[key] ?? 0) + (t.amount ?? 0);
    }

    return NextResponse.json({
      data: {
        period,
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
        total_revenue: Math.round(totalRevenue * 100) / 100,
        transaction_count: transactionCount,
        avg_transaction: avgTransaction,
        revenue_by_type: revenueByType,
        revenue_by_period: revenueByPeriod,
      },
    });
  } catch (err) {
    console.error("GET /api/revenue error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
