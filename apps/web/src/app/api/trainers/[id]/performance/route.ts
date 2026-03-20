import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "manager", "trainer"];
const BONUS_THRESHOLD = 7;

/**
 * GET /api/trainers/[id]/performance
 *
 * Single trainer detailed performance.
 * Params: id is the profile_id (trainer's profile).
 * Returns current period metrics + AI narrative + highlights + growth areas.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: profileId } = await params;

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

    // ─── Fetch Trainer ───────────────────────────────────────
    const { data: trainer, error: trainerError } = await supabase
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
      .eq("profile_id", profileId)
      .eq("studio_id", studioId)
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: "Trainer not found" },
        { status: 404 }
      );
    }

    const trainerProfile = trainer.profiles as unknown as {
      id: string;
      full_name: string;
      email: string;
      avatar_url: string | null;
    } | null;

    // ─── Current Period Metrics (last 30 days) ───────────────
    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const periodEnd = now.toISOString().split("T")[0];

    const { data: classes } = await supabase
      .from("classes")
      .select("id, title, checked_in_count, capacity, starts_at, booked_count")
      .eq("studio_id", studioId)
      .eq("trainer_id", trainer.id)
      .gte("starts_at", periodStart)
      .lte("starts_at", periodEnd + "T23:59:59")
      .order("starts_at", { ascending: true });

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

    const bonusThreshold = trainer.bonus_threshold ?? BONUS_THRESHOLD;
    const bonusHits = trainerClasses.filter(
      (c) => (c.checked_in_count ?? 0) >= bonusThreshold
    ).length;

    // Per-class breakdown
    const classBreakdown = trainerClasses.map((c) => ({
      id: c.id,
      title: c.title,
      starts_at: c.starts_at,
      booked: c.booked_count ?? 0,
      checked_in: c.checked_in_count ?? 0,
      capacity: c.capacity ?? 12,
      hit_bonus: (c.checked_in_count ?? 0) >= bonusThreshold,
    }));

    // Top class titles by avg attendance
    const titleStats: Record<string, { total: number; count: number }> = {};
    for (const c of trainerClasses) {
      const title = c.title ?? "Untitled";
      if (!titleStats[title]) titleStats[title] = { total: 0, count: 0 };
      titleStats[title].total += c.checked_in_count ?? 0;
      titleStats[title].count++;
    }
    const topClasses = Object.entries(titleStats)
      .map(([title, s]) => ({
        title,
        avg_attendance: s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : 0,
        sessions: s.count,
      }))
      .sort((a, b) => b.avg_attendance - a.avg_attendance)
      .slice(0, 5);

    // Unique members
    const classIds = trainerClasses.map((c) => c.id);
    let uniqueMembers = 0;
    let repeatRate = 0;

    if (classIds.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("member_id")
        .eq("studio_id", studioId)
        .eq("status", "checked_in")
        .in("class_id", classIds);

      if (bookings && bookings.length > 0) {
        const memberCounts: Record<string, number> = {};
        for (const b of bookings) {
          if (b.member_id) {
            memberCounts[b.member_id] = (memberCounts[b.member_id] ?? 0) + 1;
          }
        }
        uniqueMembers = Object.keys(memberCounts).length;
        const repeatMembers = Object.values(memberCounts).filter(
          (c) => c >= 2
        ).length;
        repeatRate =
          uniqueMembers > 0
            ? Math.round((repeatMembers / uniqueMembers) * 1000) / 10
            : 0;
      }
    }

    // Revenue attributed
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

    // Promo conversions count
    const { count: promoConversions } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("promo_trainer_id", trainer.id)
      .eq("status", "completed")
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd + "T23:59:59");

    // ─── AI Narrative (from latest snapshot) ─────────────────
    const { data: latestSnapshot } = await supabase
      .from("trainer_metric_snapshots")
      .select("*")
      .eq("trainer_id", trainer.id)
      .eq("studio_id", studioId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ─── AI Cache (trainer summary) ──────────────────────────
    const { data: aiCache } = await supabase
      .from("ai_cache")
      .select("data, generated_at")
      .eq("studio_id", studioId)
      .eq("cache_type", "trainer_summary")
      .eq("entity_id", trainer.id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      data: {
        trainer_id: trainer.profile_id,
        trainer_table_id: trainer.id,
        name: trainerProfile?.full_name ?? "Unknown",
        email: trainerProfile?.email ?? null,
        avatar_url: trainerProfile?.avatar_url ?? trainer.photo_url,
        bio: trainer.bio,
        specialties: trainer.specialties,
        promo_code: trainer.promo_code,
        pay: {
          base_per_class: trainer.base_pay_per_class,
          bonus_amount: trainer.bonus_amount,
          bonus_threshold: trainer.bonus_threshold,
          commission_rate: trainer.commission_rate,
        },
        period: {
          start: periodStart,
          end: periodEnd,
        },
        metrics: {
          total_classes: totalClasses,
          total_check_ins: totalCheckIns,
          avg_attendance:
            totalClasses > 0
              ? Math.round((totalCheckIns / totalClasses) * 10) / 10
              : 0,
          capacity_utilization:
            totalCapacity > 0
              ? Math.round((totalCheckIns / totalCapacity) * 1000) / 10
              : 0,
          bonus_hits: bonusHits,
          bonus_hit_rate:
            totalClasses > 0
              ? Math.round((bonusHits / totalClasses) * 1000) / 10
              : 0,
          unique_members: uniqueMembers,
          repeat_member_rate: repeatRate,
          promo_conversions: promoConversions ?? 0,
          revenue_attributed: revenueAttributed,
        },
        top_classes: topClasses,
        class_breakdown: classBreakdown,
        lifetime: {
          total_classes_led: trainer.total_classes_led,
          total_bonus_earned: trainer.total_bonus_earned,
          total_commission_earned: trainer.total_commission_earned,
        },
        ai_narrative: aiCache?.data ?? null,
        ai_narrative_generated_at: aiCache?.generated_at ?? null,
        latest_snapshot: latestSnapshot ?? null,
      },
    });
  } catch (err) {
    console.error("GET /api/trainers/[id]/performance error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
