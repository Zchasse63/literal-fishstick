import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "manager", "trainer"];

/**
 * GET /api/trainers/leaderboard
 *
 * Trainer leaderboard ranked by performance.
 * Query params: start_date, end_date
 * Calls get_trainer_leaderboard RPC if available, falls back to manual query.
 */
export async function GET(request: NextRequest) {
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions." },
        { status: 403 }
      );
    }

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl;
    const now = new Date();
    const startDate =
      searchParams.get("start_date") ??
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
    const endDate =
      searchParams.get("end_date") ?? now.toISOString().split("T")[0];

    // ─── Try RPC First ───────────────────────────────────────
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_trainer_leaderboard",
      {
        p_studio_id: studioId,
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (!rpcError && rpcData) {
      return NextResponse.json({
        data: rpcData,
        start_date: startDate,
        end_date: endDate,
        source: "rpc",
      });
    }

    // ─── Fallback: Manual Leaderboard ────────────────────────
    if (rpcError) {
      console.warn(
        "get_trainer_leaderboard RPC not available, falling back to manual query:",
        rpcError.message
      );
    }

    const { data: trainers } = await supabase
      .from("trainers")
      .select(
        `
        id,
        profile_id,
        bonus_threshold,
        profiles!trainers_profile_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .eq("studio_id", studioId);

    if (!trainers || trainers.length === 0) {
      return NextResponse.json({
        data: [],
        start_date: startDate,
        end_date: endDate,
        source: "fallback",
      });
    }

    const leaderboard = [];

    for (const trainer of trainers) {
      const trainerProfile = trainer.profiles as unknown as {
        id: string;
        full_name: string;
        avatar_url: string | null;
      } | null;

      // Classes in period
      const { data: classes } = await supabase
        .from("classes")
        .select("id, checked_in_count, capacity")
        .eq("studio_id", studioId)
        .eq("trainer_id", trainer.id)
        .gte("starts_at", startDate)
        .lte("starts_at", endDate + "T23:59:59");

      const trainerClasses = classes ?? [];
      const totalClasses = trainerClasses.length;
      const totalCheckIns = trainerClasses.reduce(
        (sum, c) => sum + (c.checked_in_count ?? 0),
        0
      );
      const totalCapacity = trainerClasses.reduce(
        (sum, c) => sum + (c.capacity ?? 12),
        0
      );
      const avgAttendance =
        totalClasses > 0 ? totalCheckIns / totalClasses : 0;
      const bonusThreshold = trainer.bonus_threshold ?? 7;
      const bonusHits = trainerClasses.filter(
        (c) => (c.checked_in_count ?? 0) >= bonusThreshold
      ).length;

      // Revenue attributed
      const { data: revenueData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("studio_id", studioId)
        .eq("promo_trainer_id", trainer.id)
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      const revenueAttributed =
        revenueData?.reduce(
          (sum, t: { amount: number }) => sum + (t.amount ?? 0),
          0
        ) ?? 0;

      leaderboard.push({
        trainer_id: trainer.profile_id,
        trainer_table_id: trainer.id,
        name: trainerProfile?.full_name ?? "Unknown",
        avatar_url: trainerProfile?.avatar_url ?? null,
        total_classes: totalClasses,
        total_check_ins: totalCheckIns,
        avg_attendance: Math.round(avgAttendance * 10) / 10,
        capacity_utilization:
          totalCapacity > 0
            ? Math.round((totalCheckIns / totalCapacity) * 1000) / 10
            : 0,
        bonus_hits: bonusHits,
        revenue_attributed: revenueAttributed,
      });
    }

    // Sort by total check-ins descending, then avg_attendance
    leaderboard.sort((a, b) => {
      if (b.total_check_ins !== a.total_check_ins) {
        return b.total_check_ins - a.total_check_ins;
      }
      return b.avg_attendance - a.avg_attendance;
    });

    // Add rank
    const ranked = leaderboard.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    return NextResponse.json({
      data: ranked,
      start_date: startDate,
      end_date: endDate,
      source: "fallback",
    });
  } catch (err) {
    console.error("GET /api/trainers/leaderboard error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
