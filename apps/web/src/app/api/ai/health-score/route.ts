import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  generateHealthScore,
  HealthScoreInput,
  HealthScoreResult,
} from "@/lib/anthropic";

const STUDIO_ID = "11111111-1111-1111-1111-111111111111";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a HealthScoreInput for a given member by querying Supabase.
 */
async function buildHealthScoreInput(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  memberId: string
): Promise<HealthScoreInput | null> {
  const now = new Date();
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const ninetyDaysAgo = new Date(
    now.getTime() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();
  const sevenDaysFromNow = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Fetch member profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, full_name, membership_type, membership_status, join_date, created_at"
    )
    .eq("id", memberId)
    .eq("studio_id", STUDIO_ID)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Run all aggregate queries in parallel
  const [
    visits30dResult,
    visits90dResult,
    lastVisitResult,
    spend90dResult,
    creditsResult,
    creditsExpiringResult,
    totalBookingsResult,
    lateCancelsResult,
    noShowsResult,
  ] = await Promise.all([
    // Visits in last 30 days (checked-in bookings)
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "checked_in")
      .gte("checked_in_at", thirtyDaysAgo),

    // Visits in last 90 days
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "checked_in")
      .gte("checked_in_at", ninetyDaysAgo),

    // Last visit date
    supabase
      .from("bookings")
      .select("checked_in_at")
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "checked_in")
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Total spend in last 90 days (in cents from transactions)
    supabase
      .from("transactions")
      .select("amount")
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "completed")
      .gte("created_at", ninetyDaysAgo),

    // Credits remaining
    supabase
      .from("credit_packs")
      .select("remaining")
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .gt("remaining", 0),

    // Credits expiring within 7 days
    supabase
      .from("credit_packs")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .gt("remaining", 0)
      .gte("expires_at", now.toISOString())
      .lte("expires_at", sevenDaysFromNow),

    // Total bookings (for rate calculations)
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .gte("created_at", ninetyDaysAgo),

    // Late cancellations in last 90 days
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "late_cancelled")
      .gte("created_at", ninetyDaysAgo),

    // No-shows in last 90 days
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "no_show")
      .gte("created_at", ninetyDaysAgo),
  ]);

  const totalVisits30d = visits30dResult.count ?? 0;
  const totalVisits90d = visits90dResult.count ?? 0;

  // Calculate avg visits per week over the last 90 days
  const avgVisitsPerWeek =
    totalVisits90d > 0
      ? Math.round((totalVisits90d / (90 / 7)) * 100) / 100
      : 0;

  // Days since last visit
  let daysSinceLastVisit = 365; // default if never visited
  if (lastVisitResult.data?.checked_in_at) {
    const lastVisit = new Date(lastVisitResult.data.checked_in_at);
    daysSinceLastVisit = Math.floor(
      (now.getTime() - lastVisit.getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  // Total spend in dollars
  const totalSpend90d =
    (spend90dResult.data?.reduce(
      (sum: number, t: { amount: number }) => sum + (t.amount ?? 0),
      0
    ) ?? 0) / 100; // convert cents to dollars

  // Credits remaining
  const creditsRemaining =
    creditsResult.data?.reduce(
      (sum: number, c: { remaining: number }) => sum + (c.remaining ?? 0),
      0
    ) ?? 0;

  const creditsExpiring7d = creditsExpiringResult.count ?? 0;

  // Rates
  const totalBookings = totalBookingsResult.count ?? 0;
  const lateCancels = lateCancelsResult.count ?? 0;
  const noShows = noShowsResult.count ?? 0;

  const cancellationRate =
    totalBookings > 0
      ? Math.round((lateCancels / totalBookings) * 100) / 100
      : 0;
  const noShowRate =
    totalBookings > 0
      ? Math.round((noShows / totalBookings) * 100) / 100
      : 0;

  return {
    member_id: memberId,
    full_name: profile.full_name ?? "Unknown Member",
    membership_type: profile.membership_type ?? null,
    membership_status: profile.membership_status ?? null,
    join_date: profile.join_date ?? profile.created_at ?? null,
    total_visits_30d: totalVisits30d,
    total_visits_90d: totalVisits90d,
    avg_visits_per_week: avgVisitsPerWeek,
    days_since_last_visit: daysSinceLastVisit,
    total_spend_90d: totalSpend90d,
    credits_remaining: creditsRemaining,
    credits_expiring_7d: creditsExpiring7d,
    cancellation_rate: cancellationRate,
    no_show_rate: noShowRate,
  };
}

/**
 * Cache the health score result in ai_cache and update the member profile.
 */
async function cacheAndUpdateProfile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  memberId: string,
  result: HealthScoreResult
): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  // Cache in ai_cache (best-effort)
  await supabase
    .from("ai_cache")
    .upsert(
      {
        studio_id: STUDIO_ID,
        cache_type: "health_score",
        entity_id: memberId,
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
        console.error("Failed to cache health score:", err);
      }
    );

  // Update profile with health score fields (best-effort)
  await supabase
    .from("profiles")
    .update({
      health_score: result.score,
      health_score_updated_at: now,
      health_risk_level: result.risk_level,
    })
    .eq("id", memberId)
    .eq("studio_id", STUDIO_ID)
    .then(
      () => {
        /* success */
      },
      (err) => {
        console.error("Failed to update profile health score:", err);
      }
    );
}

// ---------------------------------------------------------------------------
// POST — Calculate health score for a single member
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { member_id } = body as { member_id?: string };

    if (!member_id) {
      return NextResponse.json(
        { error: "member_id is required" },
        { status: 400 }
      );
    }

    // Check for a valid cache entry first
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("data, generated_at, expires_at")
      .eq("studio_id", STUDIO_ID)
      .eq("cache_type", "health_score")
      .eq("entity_id", member_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.data) {
      return NextResponse.json({
        ...(cached.data as HealthScoreResult),
        cached: true,
        generated_at: cached.generated_at,
      });
    }

    // Build input from Supabase data
    const input = await buildHealthScoreInput(supabase, member_id);

    if (!input) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Generate health score
    const result = await generateHealthScore(input);

    // Cache and update profile (non-blocking)
    await cacheAndUpdateProfile(supabase, member_id, result);

    return NextResponse.json({
      ...result,
      cached: false,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("POST /api/ai/health-score error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Batch refresh health scores for all active members (cron)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active members
    const { data: activeMembers, error: membersError } = await supabase
      .from("profiles")
      .select("id")
      .eq("studio_id", STUDIO_ID)
      .eq("status", "active")
      .limit(200); // upper bound safety

    if (membersError || !activeMembers) {
      return NextResponse.json(
        { error: "Failed to fetch active members" },
        { status: 500 }
      );
    }

    // Get existing valid cache entries to skip
    const { data: validCaches } = await supabase
      .from("ai_cache")
      .select("entity_id")
      .eq("studio_id", STUDIO_ID)
      .eq("cache_type", "health_score")
      .gt("expires_at", new Date().toISOString());

    const cachedMemberIds = new Set(
      validCaches?.map((c) => c.entity_id) ?? []
    );

    // Filter to members that need a refresh
    const membersToProcess = activeMembers
      .filter((m) => !cachedMemberIds.has(m.id))
      .slice(0, BATCH_LIMIT);

    let processed = 0;
    let errors = 0;

    for (const member of membersToProcess) {
      try {
        const input = await buildHealthScoreInput(supabase, member.id);
        if (!input) {
          errors++;
          continue;
        }

        const result = await generateHealthScore(input);
        await cacheAndUpdateProfile(supabase, member.id, result);
        processed++;
      } catch (err) {
        console.error(
          `Health score error for member ${member.id}:`,
          err
        );
        errors++;
      }
    }

    return NextResponse.json({
      processed,
      errors,
      skipped_cached: activeMembers.length - membersToProcess.length,
      total_active: activeMembers.length,
    });
  } catch (err) {
    console.error("GET /api/ai/health-score error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
