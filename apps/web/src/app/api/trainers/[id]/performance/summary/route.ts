import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  generateTrainerSummary,
  TrainerMetrics,
} from "@/lib/ai/trainer-summary";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "manager"];
const BONUS_THRESHOLD = 7;

/**
 * POST /api/trainers/[id]/performance/summary
 *
 * Generate/refresh AI trainer summary. Admin only.
 * Params: id is the profile_id.
 * Calls trainer summary AI, updates trainer_metric_snapshots ai_* columns.
 * Returns the updated narrative.
 */
export async function POST(
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
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Owner or manager role required." },
        { status: 403 }
      );
    }

    // ─── Resolve Trainer ─────────────────────────────────────
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select(
        `
        id,
        profile_id,
        bonus_threshold,
        profiles!trainers_profile_id_fkey (
          id,
          full_name
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
    } | null;

    const trainerName = trainerProfile?.full_name ?? "Unknown Trainer";

    // ─── Build Metrics (last 30 days) ────────────────────────
    const now = new Date();
    const periodEnd = now.toISOString().split("T")[0];
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: classes } = await supabase
      .from("classes")
      .select("id, title, checked_in_count, capacity, starts_at")
      .eq("studio_id", studioId)
      .eq("trainer_id", trainer.id)
      .gte("starts_at", periodStart)
      .lte("starts_at", periodEnd + "T23:59:59")
      .order("starts_at", { ascending: true });

    const trainerClasses = classes ?? [];
    const totalClasses = trainerClasses.length;

    let totalCheckIns = 0;
    let totalCapacity = 0;
    let classesAboveBonusThreshold = 0;
    const classTitleAttendance: Record<
      string,
      { total: number; count: number }
    > = {};

    const bonusThreshold = trainer.bonus_threshold ?? BONUS_THRESHOLD;

    for (const cls of trainerClasses) {
      const checkIns = cls.checked_in_count ?? 0;
      const capacity = cls.capacity ?? 12;
      totalCheckIns += checkIns;
      totalCapacity += capacity;

      if (checkIns >= bonusThreshold) {
        classesAboveBonusThreshold++;
      }

      const title = cls.title ?? "Untitled Class";
      if (!classTitleAttendance[title])
        classTitleAttendance[title] = { total: 0, count: 0 };
      classTitleAttendance[title].total += checkIns;
      classTitleAttendance[title].count++;
    }

    const avgAttendanceRate =
      totalClasses > 0 ? (totalCheckIns / (totalClasses * 12)) * 100 : 0;
    const avgCapacityUtilization =
      totalCapacity > 0 ? (totalCheckIns / totalCapacity) * 100 : 0;

    const topClasses = Object.entries(classTitleAttendance)
      .map(([title, data]) => ({
        title,
        avg_attendance: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.avg_attendance - a.avg_attendance)
      .slice(0, 3);

    // Unique/repeat members
    const classIds = trainerClasses.map((c) => c.id);
    let uniqueMembersServed = 0;
    let repeatMemberRate = 0;

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
        uniqueMembersServed = Object.keys(memberCounts).length;
        const repeatMembers = Object.values(memberCounts).filter(
          (c) => c >= 2
        ).length;
        repeatMemberRate =
          uniqueMembersServed > 0
            ? (repeatMembers / uniqueMembersServed) * 100
            : 0;
      }
    }

    // Promo conversions + revenue via promo_attributions (canonical table)
    const { data: attributions } = await supabase
      .from("promo_attributions")
      .select("attributed_sale_amount")
      .eq("studio_id", studioId)
      .eq("trainer_id", trainer.id)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd + "T23:59:59");

    const promoCodeConversions = attributions?.length ?? 0;
    const revenueAttributed =
      attributions?.reduce(
        (sum: number, a: { attributed_sale_amount: number | null }) =>
          sum + (a.attributed_sale_amount ?? 0),
        0
      ) ?? 0;

    // Studio-wide averages
    const { data: studioClasses } = await supabase
      .from("classes")
      .select("checked_in_count, capacity")
      .eq("studio_id", studioId)
      .gte("starts_at", periodStart)
      .lte("starts_at", periodEnd + "T23:59:59");

    let studioAvgAttendance = 0;
    let studioAvgUtilization = 0;

    if (studioClasses && studioClasses.length > 0) {
      const studioTotalCheckIns = studioClasses.reduce(
        (sum, c) => sum + (c.checked_in_count ?? 0),
        0
      );
      const studioTotalCapacity = studioClasses.reduce(
        (sum, c) => sum + (c.capacity ?? 12),
        0
      );
      studioAvgAttendance =
        (studioTotalCheckIns / (studioClasses.length * 12)) * 100;
      studioAvgUtilization =
        studioTotalCapacity > 0
          ? (studioTotalCheckIns / studioTotalCapacity) * 100
          : 0;
    }

    // ─── Build TrainerMetrics & Generate Summary ─────────────
    const metrics: TrainerMetrics = {
      trainer_id: trainer.id,
      trainer_name: trainerName,
      period_start: periodStart,
      period_end: periodEnd,
      total_classes: totalClasses,
      total_check_ins: totalCheckIns,
      avg_attendance_rate: Math.round(avgAttendanceRate * 10) / 10,
      avg_capacity_utilization:
        Math.round(avgCapacityUtilization * 10) / 10,
      classes_above_bonus_threshold: classesAboveBonusThreshold,
      bonus_eligible: classesAboveBonusThreshold > 0,
      unique_members_served: uniqueMembersServed,
      repeat_member_rate: Math.round(repeatMemberRate * 10) / 10,
      promo_code_conversions: promoCodeConversions,
      revenue_attributed: revenueAttributed,
      top_classes: topClasses,
      comparison_to_studio_avg: {
        attendance_diff:
          Math.round((avgAttendanceRate - studioAvgAttendance) * 10) / 10,
        utilization_diff:
          Math.round(
            (avgCapacityUtilization - studioAvgUtilization) * 10
          ) / 10,
      },
    };

    const summary = await generateTrainerSummary(metrics);

    // ─── Update trainer_metric_snapshots ─────────────────────
    // Real schema: period_start/period_end compound key, avg_attendance (not _rate),
    // no ai_bonus_summary column — fold bonus summary into ai_highlights instead.
    const aiHighlights = summary.bonus_summary
      ? [summary.bonus_summary, ...(summary.highlights ?? [])]
      : (summary.highlights ?? []);

    const { data: existingSnapshot } = await supabase
      .from("trainer_metric_snapshots")
      .select("id")
      .eq("trainer_id", trainer.id)
      .eq("studio_id", studioId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (existingSnapshot) {
      await supabase
        .from("trainer_metric_snapshots")
        .update({
          ai_narrative: summary.narrative,
          ai_highlights: aiHighlights,
          ai_growth_areas: summary.areas_for_growth,
          ai_overall_rating: summary.overall_rating,
          ai_generated_at: new Date().toISOString(),
          total_classes: totalClasses,
          total_check_ins: totalCheckIns,
          avg_attendance: metrics.avg_attendance_rate,
          avg_capacity_utilization: metrics.avg_capacity_utilization,
          classes_above_bonus_threshold: classesAboveBonusThreshold,
          unique_members_served: uniqueMembersServed,
          repeat_member_rate: metrics.repeat_member_rate,
          promo_code_conversions: promoCodeConversions,
          revenue_attributed: revenueAttributed,
        })
        .eq("id", existingSnapshot.id);
    } else {
      await supabase.from("trainer_metric_snapshots").insert({
        trainer_id: trainer.id,
        studio_id: studioId,
        period_start: periodStart,
        period_end: periodEnd,
        total_classes: totalClasses,
        total_check_ins: totalCheckIns,
        avg_attendance: metrics.avg_attendance_rate,
        avg_capacity_utilization: metrics.avg_capacity_utilization,
        classes_above_bonus_threshold: classesAboveBonusThreshold,
        unique_members_served: uniqueMembersServed,
        repeat_member_rate: metrics.repeat_member_rate,
        promo_code_conversions: promoCodeConversions,
        revenue_attributed: revenueAttributed,
        ai_narrative: summary.narrative,
        ai_highlights: aiHighlights,
        ai_growth_areas: summary.areas_for_growth,
        ai_overall_rating: summary.overall_rating,
        ai_generated_at: new Date().toISOString(),
      });
    }

    // ─── Cache AI summary ────────────────────────────────────
    const cacheExpiry = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    await supabase
      .from("ai_cache")
      .upsert(
        {
          studio_id: studioId,
          cache_key: `trainer_summary:${trainer.id}`,
          cache_type: "trainer_summary",
          entity_id: trainer.id,
          result: summary as unknown as Record<string, unknown>,
          expires_at: cacheExpiry,
        },
        { onConflict: "studio_id,cache_key" }
      )
      .then(
        () => {},
        (err) => console.error("Failed to cache trainer summary:", err)
      );

    return NextResponse.json({
      data: {
        trainer_id: profileId,
        trainer_name: trainerName,
        metrics,
        summary,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /api/trainers/[id]/performance/summary error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
