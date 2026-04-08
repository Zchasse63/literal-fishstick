import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * GET /api/analytics/churn-rate
 * Calculate churn rate from active vs churned member counts.
 * Rate = churned / (active + churned)
 */
export async function GET(request: NextRequest) {
  try {
    // Suppress unused variable warning
    void request;

    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Count active members
    const { count: activeCount } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("membership_status", "active");

    // Count churned members (cancelled or expired)
    const { count: churnedCount } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .in("membership_status", ["cancelled", "expired"]);

    const active = activeCount ?? 0;
    const churned = churnedCount ?? 0;
    const total = active + churned;
    const rate = total > 0 ? Math.round((churned / total) * 10000) / 10000 : 0;

    return NextResponse.json({
      data: {
        active,
        churned,
        rate,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error("GET /api/analytics/churn-rate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
