import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_ROLES = ["owner", "manager", "trainer"];

/**
 * GET /api/ai/insights
 *
 * List active AI insights with optional filtering.
 * Query params: type, urgency, limit (default 20)
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

    // Rate limit: 20 requests per minute per user
    const rl = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const urgency = searchParams.get("urgency");
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "20", 10),
      100
    );

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from("ai_insights")
      .select("*", { count: "exact" })
      .eq("studio_id", studioId)
      .eq("status", "active")
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq("type", type);
    }

    if (urgency) {
      query = query.eq("urgency", urgency);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("GET /api/ai/insights query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/ai/insights error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
