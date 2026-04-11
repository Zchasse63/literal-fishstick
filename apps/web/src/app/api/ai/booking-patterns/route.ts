import { NextResponse } from "next/server";
import {
  analyzeBookingPatterns,
  BookingPatternInput,
  BookingPatternResult,
} from "@/lib/ai/booking-patterns";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// GET — Analyze booking patterns for the studio
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

    // -----------------------------------------------------------------------
    // Check cache first
    // -----------------------------------------------------------------------

    const { data: cached } = await supabase
      .from("ai_cache")
      .select("result, created_at, expires_at")
      .eq("studio_id", STUDIO_ID)
      .eq("cache_key", `booking_pattern:${STUDIO_ID}`)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result) {
      return NextResponse.json({
        ...(cached.result as BookingPatternResult),
        cached: true,
        generated_at: cached.created_at,
      });
    }

    // -----------------------------------------------------------------------
    // Query 90 days of class data with aggregated booking metrics
    // -----------------------------------------------------------------------

    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch classes from the last 90 days
    const { data: classesRaw, error: classesError } = await supabase
      .from("classes")
      .select(
        "id, title, starts_at, capacity, booked_count, checked_in_count, status"
      )
      .eq("studio_id", STUDIO_ID)
      .gte("starts_at", ninetyDaysAgo)
      .order("starts_at", { ascending: true });

    if (classesError) {
      console.error("Failed to fetch classes:", classesError);
      return NextResponse.json(
        { error: "Failed to fetch class data" },
        { status: 500 }
      );
    }

    if (!classesRaw || classesRaw.length === 0) {
      return NextResponse.json(
        { error: "No class data available for the last 90 days" },
        { status: 404 }
      );
    }

    // Fetch staff for trainer name mapping
    const { data: staffRaw } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("studio_id", STUDIO_ID);

    const staffMap = new Map<string, string>(
      (staffRaw ?? []).map((s) => [s.id, s.full_name])
    );

    // Fetch bookings to determine trainer assignments per class
    // Classes may have a trainer_id field; check the data
    const { data: classesWithTrainer } = await supabase
      .from("classes")
      .select("id, trainer_id")
      .eq("studio_id", STUDIO_ID)
      .gte("starts_at", ninetyDaysAgo);

    const trainerByClassId = new Map<string, string | null>();
    for (const c of classesWithTrainer ?? []) {
      const trainerId = (c as Record<string, unknown>).trainer_id as
        | string
        | null;
      trainerByClassId.set(
        c.id,
        trainerId ? (staffMap.get(trainerId) ?? null) : null
      );
    }

    // -----------------------------------------------------------------------
    // Aggregate class data by (title, day_of_week, hour)
    // -----------------------------------------------------------------------

    interface ClassAggregate {
      id: string; // representative class ID
      title: string;
      day_of_week: number;
      hour: number;
      capacity: number;
      total_booked: number;
      total_checked_in: number;
      session_count: number;
      trainer_name: string | null;
    }

    const aggregates = new Map<string, ClassAggregate>();

    for (const cls of classesRaw) {
      const startsAt = new Date(cls.starts_at);
      const dayOfWeek = startsAt.getUTCDay();
      const hour = startsAt.getUTCHours();
      const key = `${cls.title}|${dayOfWeek}|${hour}`;

      const existing = aggregates.get(key);
      if (existing) {
        existing.total_booked += cls.booked_count ?? 0;
        existing.total_checked_in += cls.checked_in_count ?? 0;
        existing.session_count += 1;
        // Use max capacity (in case it changed)
        existing.capacity = Math.max(existing.capacity, cls.capacity ?? 0);
      } else {
        aggregates.set(key, {
          id: cls.id,
          title: cls.title,
          day_of_week: dayOfWeek,
          hour,
          capacity: cls.capacity ?? 0,
          total_booked: cls.booked_count ?? 0,
          total_checked_in: cls.checked_in_count ?? 0,
          session_count: 1,
          trainer_name: trainerByClassId.get(cls.id) ?? null,
        });
      }
    }

    const classesInput: BookingPatternInput["classes"] = Array.from(
      aggregates.values()
    ).map((agg) => ({
      id: agg.id,
      title: agg.title,
      day_of_week: agg.day_of_week,
      hour: agg.hour,
      capacity: agg.capacity,
      avg_booked:
        agg.session_count > 0
          ? Math.round((agg.total_booked / agg.session_count) * 100) / 100
          : 0,
      avg_checked_in:
        agg.session_count > 0
          ? Math.round((agg.total_checked_in / agg.session_count) * 100) / 100
          : 0,
      total_sessions: agg.session_count,
      trainer_name: agg.trainer_name,
    }));

    // -----------------------------------------------------------------------
    // Compute studio-level metrics
    // -----------------------------------------------------------------------

    // Total active members
    const { count: totalMembers } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("membership_status", "active");

    // Average daily bookings over the 90-day window
    const totalBookings = classesRaw.reduce(
      (sum, c) => sum + (c.booked_count ?? 0),
      0
    );
    const avgDailyBookings = Math.round((totalBookings / 90) * 100) / 100;

    // Peak utilization percentage
    let peakUtilization = 0;
    for (const cls of classesInput) {
      if (cls.capacity > 0) {
        const util = (cls.avg_booked / cls.capacity) * 100;
        if (util > peakUtilization) {
          peakUtilization = util;
        }
      }
    }
    peakUtilization = Math.round(peakUtilization * 100) / 100;

    // -----------------------------------------------------------------------
    // Build input and analyze
    // -----------------------------------------------------------------------

    const input: BookingPatternInput = {
      studio_id: STUDIO_ID,
      classes: classesInput,
      total_members: totalMembers ?? 0,
      avg_daily_bookings: avgDailyBookings,
      peak_utilization_pct: peakUtilization,
    };

    const result = await analyzeBookingPatterns(input);

    // -----------------------------------------------------------------------
    // Cache result (best-effort)
    // -----------------------------------------------------------------------

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

    await supabase
      .from("ai_cache")
      .upsert(
        {
          studio_id: STUDIO_ID,
          cache_key: `booking_pattern:${STUDIO_ID}`,
          cache_type: "booking_pattern",
          entity_id: STUDIO_ID, // studio-level analysis
          result: result as unknown as Record<string, unknown>,
          expires_at: expiresAt,
        },
        { onConflict: "studio_id,cache_key" }
      )
      .then(
        () => {
          /* success */
        },
        (err) => {
          console.error("Failed to cache booking pattern result:", err);
        }
      );

    return NextResponse.json({
      ...result,
      cached: false,
      generated_at: now,
    });
  } catch (err) {
    console.error("GET /api/ai/booking-patterns error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
