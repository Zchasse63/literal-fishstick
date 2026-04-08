import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  predictChurn,
  ChurnInput,
  ChurnPredictionResult,
} from "@/lib/ai/churn-prediction";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the visit trend by comparing the last 30 days to the previous 30 days.
 */
function calculateVisitTrend(
  visitsLast30d: number,
  visitsPrevious30d: number
): ChurnInput["visit_trend"] {
  if (visitsLast30d === 0 && visitsPrevious30d === 0) return "stopped";
  if (visitsLast30d === 0 && visitsPrevious30d > 0) return "stopped";
  if (visitsPrevious30d === 0) return "increasing";

  const changeRatio = visitsLast30d / visitsPrevious30d;
  if (changeRatio >= 1.15) return "increasing";
  if (changeRatio <= 0.7) return "declining";
  return "stable";
}

/**
 * Determine spend trend by comparing recent vs earlier 90-day spend.
 */
function calculateSpendTrend(
  spendRecent45d: number,
  spendEarlier45d: number
): ChurnInput["spend_trend"] {
  if (spendEarlier45d === 0 && spendRecent45d === 0) return "stable";
  if (spendEarlier45d === 0) return "increasing";

  const changeRatio = spendRecent45d / spendEarlier45d;
  if (changeRatio >= 1.15) return "increasing";
  if (changeRatio <= 0.7) return "declining";
  return "stable";
}

/**
 * Build a ChurnInput for a given member by querying Supabase.
 */
async function buildChurnInput(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  memberId: string
): Promise<ChurnInput | null> {
  const now = new Date();
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const sixtyDaysAgo = new Date(
    now.getTime() - 60 * 24 * 60 * 60 * 1000
  ).toISOString();
  const fortyFiveDaysAgo = new Date(
    now.getTime() - 45 * 24 * 60 * 60 * 1000
  ).toISOString();
  const ninetyDaysAgo = new Date(
    now.getTime() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();
  const sevenDaysFromNow = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Fetch member with joined profile
  const { data: memberRow, error: memberError } = await supabase
    .from("members")
    .select(
      "id, membership_tier, membership_status, join_date, created_at, profiles:profile_id ( full_name, email )"
    )
    .eq("id", memberId)
    .eq("studio_id", STUDIO_ID)
    .single();

  if (memberError || !memberRow) {
    return null;
  }

  const profile = {
    full_name: (memberRow.profiles as any)?.full_name ?? "Unknown Member",
    email: (memberRow.profiles as any)?.email ?? "",
    membership_type: memberRow.membership_tier,
    membership_status: memberRow.membership_status,
    join_date: memberRow.join_date,
    created_at: memberRow.created_at,
  };

  // Run all aggregate queries in parallel
  const [
    visitsLast30dResult,
    visitsPrevious30dResult,
    lastVisitResult,
    spendRecent45dResult,
    spendEarlier45dResult,
    lateCancelsResult,
    noShowsResult,
    creditsResult,
    creditsExpiringResult,
    emailEngagementResult,
    referralResult,
    merchResult,
  ] = await Promise.all([
    // Visits in last 30 days (checked-in bookings)
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "checked_in")
      .gte("checked_in_at", thirtyDaysAgo),

    // Visits in previous 30 days (30-60 days ago)
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "checked_in")
      .gte("checked_in_at", sixtyDaysAgo)
      .lt("checked_in_at", thirtyDaysAgo),

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

    // Spend in recent 45 days (for trend: recent half of 90d window)
    supabase
      .from("transactions")
      .select("amount")
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "completed")
      .gte("created_at", fortyFiveDaysAgo),

    // Spend in earlier 45 days (45-90 days ago)
    supabase
      .from("transactions")
      .select("amount")
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "completed")
      .gte("created_at", ninetyDaysAgo)
      .lt("created_at", fortyFiveDaysAgo),

    // Late cancellations in last 30 days
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "late_cancelled")
      .gte("created_at", thirtyDaysAgo),

    // No-shows in last 30 days
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "no_show")
      .gte("created_at", thirtyDaysAgo),

    // Credits remaining
    supabase
      .from("credit_packs")
      .select("credits_remaining")
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .gt("credits_remaining", 0),

    // Credits expiring within 7 days
    supabase
      .from("credit_packs")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .gt("credits_remaining", 0)
      .gte("expires_at", now.toISOString())
      .lte("expires_at", sevenDaysFromNow),

    // Recent email engagement (opened in last 30 days)
    supabase
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("recipient_email", profile.email ?? "")
      .not("opened_at", "is", null)
      .gte("created_at", thirtyDaysAgo),

    // Referral activity (check member_tags for referral)
    supabase
      .from("member_tags")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("tag", "referral_made"),

    // Merch purchase in last 90 days
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("type", "merchandise")
      .eq("status", "completed")
      .gte("created_at", ninetyDaysAgo),
  ]);

  // ─── Error checks for critical queries ──────────────────────
  // If member visit counts or last-visit queries fail, we cannot produce a
  // meaningful churn prediction, so bail out early.
  if (visitsLast30dResult.error) {
    console.error("Churn: visitsLast30d query failed", visitsLast30dResult.error);
    return null;
  }
  if (visitsPrevious30dResult.error) {
    console.error("Churn: visitsPrevious30d query failed", visitsPrevious30dResult.error);
    return null;
  }
  if (lastVisitResult.error) {
    console.error("Churn: lastVisit query failed", lastVisitResult.error);
    return null;
  }
  if (spendRecent45dResult.error) {
    console.error("Churn: spendRecent45d query failed", spendRecent45dResult.error);
    return null;
  }
  if (spendEarlier45dResult.error) {
    console.error("Churn: spendEarlier45d query failed", spendEarlier45dResult.error);
    return null;
  }
  if (lateCancelsResult.error) {
    console.error("Churn: lateCancels query failed", lateCancelsResult.error);
    return null;
  }
  if (noShowsResult.error) {
    console.error("Churn: noShows query failed", noShowsResult.error);
    return null;
  }

  const visitsLast30d = visitsLast30dResult.count ?? 0;
  const visitsPrevious30d = visitsPrevious30dResult.count ?? 0;

  // Days since last visit
  let daysSinceLastVisit = 365; // default if never visited
  if (lastVisitResult.data?.checked_in_at) {
    const lastVisit = new Date(lastVisitResult.data.checked_in_at);
    daysSinceLastVisit = Math.floor(
      (now.getTime() - lastVisit.getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  // Spend calculations (amounts in cents -> dollars)
  const spendRecent45d =
    (spendRecent45dResult.data?.reduce(
      (sum: number, t: { amount: number }) => sum + (t.amount ?? 0),
      0
    ) ?? 0) / 100;

  const spendEarlier45d =
    (spendEarlier45dResult.data?.reduce(
      (sum: number, t: { amount: number }) => sum + (t.amount ?? 0),
      0
    ) ?? 0) / 100;

  const totalSpend90d = spendRecent45d + spendEarlier45d;

  // Credits
  const creditsRemaining =
    creditsResult.data?.reduce(
      (sum: number, c: { credits_remaining: number }) => sum + (c.credits_remaining ?? 0),
      0
    ) ?? 0;

  const creditsExpiringSoon = (creditsExpiringResult.count ?? 0) > 0;

  // Engagement signals
  const engagementSignals: string[] = [];
  if ((emailEngagementResult.count ?? 0) > 0) {
    engagementSignals.push("opened recent email");
  }
  if ((referralResult.count ?? 0) > 0) {
    engagementSignals.push("referred a friend");
  }
  if ((merchResult.count ?? 0) > 0) {
    engagementSignals.push("purchased merch recently");
  }

  return {
    member_id: memberId,
    full_name: profile.full_name ?? "Unknown Member",
    membership_type: profile.membership_type ?? null,
    membership_status: profile.membership_status ?? null,
    join_date: profile.join_date ?? profile.created_at ?? null,
    days_since_last_visit: daysSinceLastVisit,
    visit_trend: calculateVisitTrend(visitsLast30d, visitsPrevious30d),
    visits_last_30d: visitsLast30d,
    visits_previous_30d: visitsPrevious30d,
    total_spend_90d: totalSpend90d,
    spend_trend: calculateSpendTrend(spendRecent45d, spendEarlier45d),
    late_cancellations_30d: lateCancelsResult.count ?? 0,
    no_shows_30d: noShowsResult.count ?? 0,
    credits_remaining: creditsRemaining,
    credits_expiring_soon: creditsExpiringSoon,
    engagement_signals: engagementSignals,
  };
}

/**
 * Cache the churn prediction result in ai_cache.
 */
async function cacheResult(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  memberId: string,
  result: ChurnPredictionResult
): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await supabase
    .from("ai_cache")
    .upsert(
      {
        studio_id: STUDIO_ID,
        cache_type: "churn_narrative",
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
        console.error("Failed to cache churn prediction:", err);
      }
    );
}

// ---------------------------------------------------------------------------
// POST — Predict churn for a single member
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
      .eq("cache_type", "churn_narrative")
      .eq("entity_id", member_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.data) {
      return NextResponse.json({
        ...(cached.data as ChurnPredictionResult),
        cached: true,
        generated_at: cached.generated_at,
      });
    }

    // Build input from Supabase data
    const input = await buildChurnInput(supabase, member_id);

    if (!input) {
      return NextResponse.json(
        { error: "Member not found or failed to gather member data for churn analysis" },
        { status: 404 }
      );
    }

    // Generate churn prediction
    const result = await predictChurn(input);

    // Cache result (non-blocking)
    await cacheResult(supabase, member_id, result);

    return NextResponse.json({
      ...result,
      cached: false,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("POST /api/ai/churn-prediction error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
