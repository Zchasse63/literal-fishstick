import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateBriefing, BriefingContext } from "@/lib/ai/briefing";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/ai/briefing
 * Generate an AI-powered daily briefing for the studio owner.
 * Caches the briefing for 30 minutes before regenerating.
 */
export async function GET() {
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase, studioId } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Check for a cached briefing from the last 30 minutes
    const { data: cached } = await supabase
      .from("ai_briefings")
      .select("briefing, metrics, generated_at")
      .eq("studio_id", studioId)
      .gte(
        "generated_at",
        new Date(Date.now() - 30 * 60 * 1000).toISOString()
      )
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        briefing: cached.briefing,
        metrics: cached.metrics,
        generated_at: cached.generated_at,
        cached: true,
      });
    }

    // Gather all metrics in parallel
    const [
      classesResult,
      bookingsResult,
      checkinsResult,
      revenueTodayResult,
      revenueMtdResult,
      activeMembersResult,
      newMembersResult,
      expiringCreditsResult,
      waitlistedResult,
    ] = await Promise.all([
      // Today's classes
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .gte("starts_at", new Date().toISOString().split("T")[0])
        .lt(
          "starts_at",
          new Date(Date.now() + 86400000).toISOString().split("T")[0]
        ),

      // Today's bookings
      supabase.rpc("count_today_bookings", { p_studio_id: studioId }).then(
        (res) => res,
        () => ({ data: null, error: null, count: null, status: 200, statusText: "OK" })
      ),

      // Today's check-ins
      supabase.rpc("count_today_checkins", { p_studio_id: studioId }).then(
        (res) => res,
        () => ({ data: null, error: null, count: null, status: 200, statusText: "OK" })
      ),

      // Revenue today
      supabase
        .from("transactions")
        .select("amount")
        .eq("studio_id", studioId)
        .eq("status", "completed")
        .gte("created_at", new Date().toISOString().split("T")[0])
        .lt(
          "created_at",
          new Date(Date.now() + 86400000).toISOString().split("T")[0]
        ),

      // Revenue MTD
      supabase
        .from("transactions")
        .select("amount")
        .eq("studio_id", studioId)
        .eq("status", "completed")
        .gte(
          "created_at",
          new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString()
            .split("T")[0]
        ),

      // Active members
      supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("membership_status", "active"),

      // New members this week
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 86400000).toISOString()
        ),

      // Expiring credits in 7 days
      supabase
        .from("credit_packs")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .gt("credits_remaining", 0)
        .gte("expires_at", new Date().toISOString())
        .lte(
          "expires_at",
          new Date(Date.now() + 7 * 86400000).toISOString()
        ),

      // Waitlisted today
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("status", "waitlisted"),
    ]);

    // Calculate total capacity for today's classes
    const { data: classesWithCapacity } = await supabase
      .from("classes")
      .select("capacity")
      .eq("studio_id", studioId)
      .gte("starts_at", new Date().toISOString().split("T")[0])
      .lt(
        "starts_at",
        new Date(Date.now() + 86400000).toISOString().split("T")[0]
      );

    const totalCapacity =
      classesWithCapacity?.reduce(
        (sum, c) => sum + (c.capacity ?? 0),
        0
      ) ?? 0;

    // Count at-risk members (active but no check-in in 30 days)
    // Using a simple approach: active members minus those who checked in recently
    const { count: recentlyActiveCount } = await supabase
      .from("bookings")
      .select("member_id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("status", "checked_in")
      .gte("checked_in_at", new Date(Date.now() - 30 * 86400000).toISOString());

    const activeMembers = activeMembersResult.count ?? 0;
    const atRiskMembers = Math.max(
      0,
      activeMembers - (recentlyActiveCount ?? 0)
    );

    // Sum revenue amounts
    const revenueToday =
      revenueTodayResult.data?.reduce(
        (sum: number, t: { amount: number }) => sum + (t.amount ?? 0),
        0
      ) ?? 0;

    const revenueMtd =
      revenueMtdResult.data?.reduce(
        (sum: number, t: { amount: number }) => sum + (t.amount ?? 0),
        0
      ) ?? 0;

    // Count today's bookings — try RPC first, fallback to a basic count
    let todayBookings = 0;
    if (typeof bookingsResult.data === "number") {
      todayBookings = bookingsResult.data;
    }

    let todayCheckins = 0;
    if (typeof checkinsResult.data === "number") {
      todayCheckins = checkinsResult.data;
    }

    const metrics: BriefingContext = {
      today_classes: classesResult.count ?? 0,
      today_bookings: todayBookings,
      total_capacity: totalCapacity,
      checkins_today: todayCheckins,
      revenue_today: revenueToday / 100, // assuming cents
      revenue_mtd: revenueMtd / 100,
      active_members: activeMembers,
      at_risk_members: atRiskMembers,
      new_members_this_week: newMembersResult.count ?? 0,
      expiring_credits_7d: expiringCreditsResult.count ?? 0,
      waitlisted_today: waitlistedResult.count ?? 0,
    };

    // Generate the briefing
    const briefing = await generateBriefing(metrics);
    const generatedAt = new Date().toISOString();

    // Cache the briefing (best-effort, don't fail if table doesn't exist)
    await supabase
      .from("ai_briefings")
      .insert({
        studio_id: studioId,
        briefing,
        metrics,
        generated_at: generatedAt,
      })
      .then(
        () => { /* success */ },
        () => { /* Table may not exist yet — that's fine */ }
      );

    return NextResponse.json({
      briefing,
      metrics,
      generated_at: generatedAt,
      cached: false,
    });
  } catch (err) {
    console.error("GET /api/ai/briefing error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
