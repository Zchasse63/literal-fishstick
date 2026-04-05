import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  generateTrainerSummary,
  TrainerMetrics,
  TrainerSummaryResult,
} from "@/lib/ai/trainer-summary";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (monthly summary)
const BONUS_THRESHOLD = 7; // check-ins per class for bonus eligibility
const MAX_BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build TrainerMetrics for a single trainer by querying Supabase.
 */
async function buildTrainerMetrics(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  trainerId: string,
  trainerName: string,
  periodStart: string,
  periodEnd: string
): Promise<TrainerMetrics> {
  // Fetch all classes taught by this trainer in the period
  const { data: classes } = await supabase
    .from("classes")
    .select("id, title, capacity, booked_count, checked_in_count, starts_at")
    .eq("studio_id", STUDIO_ID)
    .eq("trainer_id", trainerId)
    .gte("starts_at", periodStart)
    .lte("starts_at", periodEnd)
    .order("starts_at", { ascending: true });

  const trainerClasses = classes ?? [];
  const totalClasses = trainerClasses.length;

  // Aggregate check-ins and capacity
  let totalCheckIns = 0;
  let totalCapacity = 0;
  let classesAboveBonusThreshold = 0;
  const classTitleAttendance: Record<string, { total: number; count: number }> =
    {};

  for (const cls of trainerClasses) {
    const checkIns = cls.checked_in_count ?? 0;
    const capacity = cls.capacity ?? 12; // default sauna capacity

    totalCheckIns += checkIns;
    totalCapacity += capacity;

    if (checkIns >= BONUS_THRESHOLD) {
      classesAboveBonusThreshold++;
    }

    // Track per-title attendance for top classes
    const title = cls.title ?? "Untitled Class";
    if (!classTitleAttendance[title]) {
      classTitleAttendance[title] = { total: 0, count: 0 };
    }
    classTitleAttendance[title].total += checkIns;
    classTitleAttendance[title].count++;
  }

  const avgAttendanceRate =
    totalClasses > 0
      ? (totalCheckIns / (totalClasses * 12)) * 100 // 12 = standard sauna capacity
      : 0;

  const avgCapacityUtilization =
    totalCapacity > 0 ? (totalCheckIns / totalCapacity) * 100 : 0;

  // Top classes by average attendance
  const topClasses = Object.entries(classTitleAttendance)
    .map(([title, data]) => ({
      title,
      avg_attendance: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => b.avg_attendance - a.avg_attendance)
    .slice(0, 3);

  // Get class IDs for booking queries
  const classIds = trainerClasses.map((c) => c.id);

  // Fetch unique members and repeat members in parallel
  let uniqueMembersServed = 0;
  let repeatMemberRate = 0;

  if (classIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("member_id")
      .eq("studio_id", STUDIO_ID)
      .eq("status", "checked_in")
      .in("class_id", classIds);

    if (bookings && bookings.length > 0) {
      const memberCounts: Record<string, number> = {};
      for (const booking of bookings) {
        if (booking.member_id) {
          memberCounts[booking.member_id] =
            (memberCounts[booking.member_id] ?? 0) + 1;
        }
      }

      const uniqueMembers = Object.keys(memberCounts);
      uniqueMembersServed = uniqueMembers.length;

      const repeatMembers = uniqueMembers.filter(
        (id) => memberCounts[id] >= 2
      );
      repeatMemberRate =
        uniqueMembersServed > 0
          ? (repeatMembers.length / uniqueMembersServed) * 100
          : 0;
    }
  }

  // Fetch promo code conversions and attributed revenue
  const [promoResult, revenueResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("promo_trainer_id", trainerId)
      .eq("status", "completed")
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),

    supabase
      .from("transactions")
      .select("amount")
      .eq("studio_id", STUDIO_ID)
      .eq("promo_trainer_id", trainerId)
      .eq("status", "completed")
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),
  ]);

  const promoCodeConversions = promoResult.count ?? 0;
  const revenueAttributed =
    revenueResult.data?.reduce(
      (sum: number, t: { amount: number }) => sum + (t.amount ?? 0),
      0
    ) ?? 0;

  // Fetch studio-wide averages for comparison
  const { data: studioClasses } = await supabase
    .from("classes")
    .select("checked_in_count, capacity")
    .eq("studio_id", STUDIO_ID)
    .gte("starts_at", periodStart)
    .lte("starts_at", periodEnd);

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

  return {
    trainer_id: trainerId,
    trainer_name: trainerName,
    period_start: periodStart,
    period_end: periodEnd,
    total_classes: totalClasses,
    total_check_ins: totalCheckIns,
    avg_attendance_rate: Math.round(avgAttendanceRate * 10) / 10,
    avg_capacity_utilization: Math.round(avgCapacityUtilization * 10) / 10,
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
        Math.round((avgCapacityUtilization - studioAvgUtilization) * 10) / 10,
    },
  };
}

/**
 * Cache the trainer summary result in ai_cache.
 */
async function cacheResult(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  trainerId: string,
  result: TrainerSummaryResult
): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await supabase
    .from("ai_cache")
    .upsert(
      {
        studio_id: STUDIO_ID,
        cache_type: "trainer_summary",
        entity_id: trainerId,
        data: result as unknown as Record<string, unknown>,
        generated_at: now,
        expires_at: expiresAt,
      },
      { onConflict: "studio_id,cache_type,entity_id" }
    )
    .then(
      () => {
        /* success */
      },
      (err) => {
        console.error("Failed to cache trainer summary:", err);
      }
    );
}

// ---------------------------------------------------------------------------
// POST — Generate summary for a specific trainer
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const { trainer_id, period_start, period_end } = body as {
      trainer_id?: string;
      period_start?: string;
      period_end?: string;
    };

    if (!trainer_id) {
      return NextResponse.json(
        { error: "trainer_id is required" },
        { status: 400 }
      );
    }

    // Default to last 30 days if period not specified
    const now = new Date();
    const effectivePeriodEnd =
      period_end ?? now.toISOString().split("T")[0];
    const effectivePeriodStart =
      period_start ??
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

    // Check for a valid cache entry first
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("data, generated_at, expires_at")
      .eq("studio_id", STUDIO_ID)
      .eq("cache_type", "trainer_summary")
      .eq("entity_id", trainer_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.data) {
      return NextResponse.json({
        trainer_id,
        summary: cached.data as TrainerSummaryResult,
        cached: true,
        generated_at: cached.generated_at,
      });
    }

    // Fetch trainer profile
    const { data: trainer, error: trainerError } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("id", trainer_id)
      .eq("studio_id", STUDIO_ID)
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: "Trainer not found" },
        { status: 404 }
      );
    }

    // Build metrics from Supabase data
    const metrics = await buildTrainerMetrics(
      supabase,
      trainer_id,
      trainer.full_name ?? "Unknown Trainer",
      effectivePeriodStart,
      effectivePeriodEnd
    );

    // Generate summary
    const summary = await generateTrainerSummary(metrics);

    // Cache result (non-blocking)
    await cacheResult(supabase, trainer_id, summary);

    return NextResponse.json({
      trainer_id,
      trainer_name: trainer.full_name,
      metrics,
      summary,
      cached: false,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("POST /api/ai/trainer-summary error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Generate summaries for all active trainers (batch)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Fetch all active trainers
    const { data: trainers, error: trainersError } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("studio_id", STUDIO_ID)
      .eq("role", "trainer")
      .limit(MAX_BATCH_SIZE);

    if (trainersError) {
      console.error("Failed to fetch trainers:", trainersError);
      return NextResponse.json(
        { error: "Failed to fetch trainers" },
        { status: 500 }
      );
    }

    if (!trainers || trainers.length === 0) {
      return NextResponse.json({ trainers: [], generated_at: new Date().toISOString() });
    }

    // Default period: last 30 days
    const now = new Date();
    const periodEnd = now.toISOString().split("T")[0];
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Generate summaries for each trainer
    const results: {
      trainer_id: string;
      trainer_name: string;
      summary: TrainerSummaryResult;
      cached: boolean;
    }[] = [];

    for (const trainer of trainers) {
      // Check cache first
      const { data: cached } = await supabase
        .from("ai_cache")
        .select("data, generated_at")
        .eq("studio_id", STUDIO_ID)
        .eq("cache_type", "trainer_summary")
        .eq("entity_id", trainer.id)
        .gt("expires_at", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached?.data) {
        results.push({
          trainer_id: trainer.id,
          trainer_name: trainer.full_name ?? "Unknown Trainer",
          summary: cached.data as TrainerSummaryResult,
          cached: true,
        });
        continue;
      }

      // Build metrics and generate summary
      const metrics = await buildTrainerMetrics(
        supabase,
        trainer.id,
        trainer.full_name ?? "Unknown Trainer",
        periodStart,
        periodEnd
      );

      const summary = await generateTrainerSummary(metrics);

      // Cache result
      await cacheResult(supabase, trainer.id, summary);

      results.push({
        trainer_id: trainer.id,
        trainer_name: trainer.full_name ?? "Unknown Trainer",
        summary,
        cached: false,
      });
    }

    return NextResponse.json({
      trainers: results,
      period_start: periodStart,
      period_end: periodEnd,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/ai/trainer-summary error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
