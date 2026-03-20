import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "manager", "trainer"];

/**
 * GET /api/trainers/performance
 *
 * List all trainers with current-period metrics.
 * Joins trainers table with profiles, computes live metrics from classes/bookings.
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
    const periodDays = parseInt(searchParams.get("period_days") ?? "30", 10);

    const now = new Date();
    const periodStart = new Date(
      now.getTime() - periodDays * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];
    const periodEnd = now.toISOString().split("T")[0];

    // ─── Fetch Trainers with Profile Data ─────────────────────
    const { data: trainers, error: trainersError } = await supabase
      .from("trainers")
      .select(
        `
        id,
        profile_id,
        bio,
        specialties,
        promo_code,
        base_pay_per_class,
        bonus_amount,
        bonus_threshold,
        commission_rate,
        is_public,
        photo_url,
        total_classes_led,
        total_bonus_earned,
        total_commission_earned,
        profiles!trainers_profile_id_fkey (
          id,
          full_name,
          email,
          avatar_url
        )
      `
      )
      .eq("studio_id", studioId);

    if (trainersError) {
      console.error("Failed to fetch trainers:", trainersError);
      return NextResponse.json(
        { error: trainersError.message },
        { status: 500 }
      );
    }

    if (!trainers || trainers.length === 0) {
      return NextResponse.json({
        data: [],
        period_start: periodStart,
        period_end: periodEnd,
      });
    }

    // ─── Compute Live Metrics Per Trainer ─────────────────────
    const trainerMetrics = [];

    for (const trainer of trainers) {
      const trainerProfile = trainer.profiles as unknown as {
        id: string;
        full_name: string;
        email: string;
        avatar_url: string | null;
      } | null;

      // Classes in period
      const { data: classes } = await supabase
        .from("classes")
        .select("id, checked_in_count, capacity")
        .eq("studio_id", studioId)
        .eq("trainer_id", trainer.id)
        .gte("starts_at", periodStart)
        .lte("starts_at", periodEnd + "T23:59:59");

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
      const bonusHitRate =
        totalClasses > 0 ? (bonusHits / totalClasses) * 100 : 0;

      // Revenue attributed via promo code
      const { data: revenueData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("studio_id", studioId)
        .eq("promo_trainer_id", trainer.id)
        .eq("status", "completed")
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd + "T23:59:59");

      const revenueAttributed =
        revenueData?.reduce(
          (sum, t: { amount: number }) => sum + (t.amount ?? 0),
          0
        ) ?? 0;

      // Check for latest snapshot
      const { data: snapshot } = await supabase
        .from("trainer_metric_snapshots")
        .select("*")
        .eq("trainer_id", trainer.id)
        .eq("studio_id", studioId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      trainerMetrics.push({
        trainer_id: trainer.profile_id,
        trainer_table_id: trainer.id,
        name: trainerProfile?.full_name ?? "Unknown",
        email: trainerProfile?.email ?? null,
        avatar_url: trainerProfile?.avatar_url ?? trainer.photo_url,
        bio: trainer.bio,
        specialties: trainer.specialties,
        promo_code: trainer.promo_code,
        is_public: trainer.is_public,
        metrics: {
          total_classes: totalClasses,
          total_check_ins: totalCheckIns,
          avg_attendance: Math.round(avgAttendance * 10) / 10,
          capacity_utilization:
            totalCapacity > 0
              ? Math.round((totalCheckIns / totalCapacity) * 1000) / 10
              : 0,
          bonus_hit_rate: Math.round(bonusHitRate * 10) / 10,
          bonus_hits: bonusHits,
          revenue_attributed: revenueAttributed,
        },
        latest_snapshot: snapshot ?? null,
      });
    }

    return NextResponse.json({
      data: trainerMetrics,
      period_start: periodStart,
      period_end: periodEnd,
    });
  } catch (err) {
    console.error("GET /api/trainers/performance error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
