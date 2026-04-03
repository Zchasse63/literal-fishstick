import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "manager"];

/**
 * POST /api/analytics/snapshot
 * Trigger a manual metric snapshot for a specific date or date range.
 * Aggregates from live tables (bookings, transactions, members, classes)
 * into daily_metrics. Used for backfilling historical data.
 *
 * Body: { date?: string (YYYY-MM-DD), start_date?: string, end_date?: string }
 * Supply either `date` for a single day, or `start_date` + `end_date` for a range.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // ─── Role Check ───────────────────────────────────────────
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Owner or manager role required." },
        { status: 403 }
      );
    }

    // ─── Parse Body ───────────────────────────────────────────
    const body = await request.json();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    let dates: string[] = [];

    if (body.date) {
      if (!dateRegex.test(body.date)) {
        return NextResponse.json(
          { error: "Invalid date format. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }
      dates = [body.date];
    } else if (body.start_date && body.end_date) {
      if (!dateRegex.test(body.start_date) || !dateRegex.test(body.end_date)) {
        return NextResponse.json(
          { error: "Invalid date format. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }

      // Generate date range
      const start = new Date(body.start_date + "T00:00:00");
      const end = new Date(body.end_date + "T00:00:00");

      if (end < start) {
        return NextResponse.json(
          { error: "end_date must be on or after start_date" },
          { status: 400 }
        );
      }

      // Cap range to 90 days to prevent abuse
      const daysDiff =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        return NextResponse.json(
          { error: "Date range cannot exceed 90 days" },
          { status: 400 }
        );
      }

      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split("T")[0]!);
        current.setDate(current.getDate() + 1);
      }
    } else {
      return NextResponse.json(
        {
          error:
            "Provide either 'date' for a single day or 'start_date' and 'end_date' for a range",
        },
        { status: 400 }
      );
    }

    // ─── Snapshot each date ───────────────────────────────────
    const results: { date: string; status: string }[] = [];

    for (const snapshotDate of dates) {
      try {
        const dayStart = `${snapshotDate}T00:00:00`;
        const dayEnd = `${snapshotDate}T23:59:59.999`;

        // Count active members as of that date
        const { count: activeMembers } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studioId)
          .eq("membership_status", "active")
          .lte("join_date", dayEnd);

        // New members that day (joined)
        const { count: newMembers } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studioId)
          .gte("join_date", dayStart)
          .lte("join_date", dayEnd);

        // Churned members that day (cancelled/expired)
        const { count: churnedMembers } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studioId)
          .in("membership_status", ["cancelled", "expired"])
          .gte("updated_at", dayStart)
          .lte("updated_at", dayEnd);

        // Revenue by type from transactions
        const { data: txns } = await supabase
          .from("transactions")
          .select("amount, type")
          .eq("studio_id", studioId)
          .eq("status", "completed")
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd);

        const transactions = txns ?? [];
        const revenueByType: Record<string, number> = {};
        let revenueTotal = 0;

        for (const txn of transactions) {
          const type = txn.type ?? "other";
          revenueByType[type] = (revenueByType[type] ?? 0) + (txn.amount ?? 0);
          revenueTotal += txn.amount ?? 0;
        }

        // Bookings and capacity for fill rate
        const { data: classes } = await supabase
          .from("classes")
          .select("id, capacity")
          .eq("studio_id", studioId)
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd);

        let totalBookings = 0;
        let totalCapacity = 0;

        for (const cls of classes ?? []) {
          totalCapacity += cls.capacity ?? 0;

          const { count: bookingCount } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("class_id", cls.id)
            .in("status", ["confirmed", "checked_in"]);

          totalBookings += bookingCount ?? 0;
        }

        const avgFillRate =
          totalCapacity > 0 ? totalBookings / totalCapacity : 0;

        // MRR estimate: sum of active recurring membership prices
        // members table has plan_price; recurring members have membership_tier like 'unlimited', etc.
        const { data: activeSubs } = await supabase
          .from("members")
          .select("plan_price")
          .eq("studio_id", studioId)
          .eq("membership_status", "active")
          .lte("join_date", dayEnd);

        const mrr = (activeSubs ?? []).reduce(
          (sum, m) => sum + ((m as any).plan_price ?? 0),
          0
        );

        // ─── Upsert into daily_metrics ────────────────────────
        const { error: upsertError } = await supabase
          .from("daily_metrics")
          .upsert(
            {
              studio_id: studioId,
              metric_date: snapshotDate,
              active_members: activeMembers ?? 0,
              new_members: newMembers ?? 0,
              churned_members: churnedMembers ?? 0,
              mrr: Math.round(mrr * 100) / 100,
              avg_class_fill_rate: Math.round(avgFillRate * 10000) / 10000,
              total_bookings: totalBookings,
              total_capacity: totalCapacity,
              revenue_total: Math.round(revenueTotal * 100) / 100,
              revenue_memberships:
                Math.round((revenueByType["membership"] ?? 0) * 100) / 100,
              revenue_credit_packs:
                Math.round((revenueByType["credit_pack"] ?? 0) * 100) / 100,
              revenue_drop_ins:
                Math.round((revenueByType["drop_in"] ?? 0) * 100) / 100,
              revenue_merch:
                Math.round((revenueByType["merch"] ?? 0) * 100) / 100,
              revenue_gift_cards:
                Math.round((revenueByType["gift_card"] ?? 0) * 100) / 100,
              revenue_corporate:
                Math.round((revenueByType["corporate"] ?? 0) * 100) / 100,
              revenue_events:
                Math.round((revenueByType["event"] ?? 0) * 100) / 100,
            },
            { onConflict: "studio_id,metric_date" }
          );

        if (upsertError) {
          console.error(
            `Snapshot upsert error for ${snapshotDate}:`,
            upsertError
          );
          results.push({ date: snapshotDate, status: "error" });
        } else {
          results.push({ date: snapshotDate, status: "ok" });
        }
      } catch (dateErr) {
        console.error(`Snapshot error for ${snapshotDate}:`, dateErr);
        results.push({ date: snapshotDate, status: "error" });
      }
    }

    // ─── Log activity ─────────────────────────────────────────
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "metrics_snapshot",
      subject_type: "daily_metrics",
      metadata: {
        dates_requested: dates.length,
        dates_succeeded: results.filter((r) => r.status === "ok").length,
      },
    });

    const succeeded = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      data: {
        total: dates.length,
        succeeded,
        failed,
        results,
      },
    });
  } catch (err) {
    console.error("POST /api/analytics/snapshot error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
