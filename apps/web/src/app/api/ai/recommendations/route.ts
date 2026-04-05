import { NextRequest, NextResponse } from "next/server";
import { generateRecommendations } from "@/lib/ai/recommendations";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/ai/recommendations?type=scheduling|pricing|retention|general
 * Generate AI-powered recommendations for the studio.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const type = searchParams.get("type") ?? "general";
    const validTypes = ["scheduling", "pricing", "retention", "general"];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase, studioId } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Gather context based on recommendation type
    const metrics: Record<string, unknown> = {};

    if (type === "scheduling" || type === "general") {
      // Class utilization data
      const { data: recentClasses } = await supabase
        .from("classes")
        .select("id, name, capacity, start_time")
        .eq("studio_id", studioId)
        .gte(
          "start_time",
          new Date(Date.now() - 30 * 86400000).toISOString()
        )
        .order("start_time", { ascending: false })
        .limit(50);

      metrics.recent_classes = recentClasses?.length ?? 0;

      // Average bookings per class
      if (recentClasses && recentClasses.length > 0) {
        const classIds = recentClasses.map((c) => c.id);
        const { count: totalBookings } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("class_id", classIds)
          .eq("studio_id", studioId)
          .in("status", ["confirmed", "checked_in"]);

        metrics.avg_bookings_per_class =
          recentClasses.length > 0
            ? Math.round((totalBookings ?? 0) / recentClasses.length)
            : 0;
        metrics.avg_capacity =
          recentClasses.reduce((sum, c) => sum + (c.capacity ?? 0), 0) /
          recentClasses.length;
      }
    }

    if (type === "pricing" || type === "general") {
      // Revenue metrics
      const { data: revenueData } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("studio_id", studioId)
        .eq("status", "completed")
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 86400000).toISOString()
        );

      const totalRevenue =
        revenueData?.reduce((sum, t) => sum + (t.amount ?? 0), 0) ?? 0;
      metrics.monthly_revenue = totalRevenue / 100;

      // Active member count for ARPM
      const { count: activeMembers } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("membership_status", "active");

      metrics.active_members = activeMembers ?? 0;
      metrics.arpm =
        (activeMembers ?? 0) > 0
          ? Math.round(totalRevenue / 100 / (activeMembers ?? 1))
          : 0;

      // Credit pack data
      const { count: expiringCredits } = await supabase
        .from("credit_packs")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .gt("credits_remaining", 0)
        .gte("expires_at", new Date().toISOString())
        .lte(
          "expires_at",
          new Date(Date.now() + 30 * 86400000).toISOString()
        );

      metrics.expiring_credits_30d = expiringCredits ?? 0;
    }

    if (type === "retention" || type === "general") {
      // At-risk members
      const { count: activeMembers } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("membership_status", "active");

      const { count: recentlyActive } = await supabase
        .from("bookings")
        .select("member_id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("status", "checked_in")
        .gte(
          "checked_in_at",
          new Date(Date.now() - 30 * 86400000).toISOString()
        );

      metrics.active_members = activeMembers ?? 0;
      metrics.at_risk_members = Math.max(
        0,
        (activeMembers ?? 0) - (recentlyActive ?? 0)
      );
      metrics.recently_active = recentlyActive ?? 0;

      // New members this month
      const { count: newMembers } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .gte(
          "created_at",
          new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ).toISOString()
        );

      metrics.new_members_this_month = newMembers ?? 0;
    }

    const recommendations = await generateRecommendations({
      type: type as "scheduling" | "pricing" | "retention" | "general",
      metrics,
    });

    return NextResponse.json({
      type,
      recommendations,
      metrics,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/ai/recommendations error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
