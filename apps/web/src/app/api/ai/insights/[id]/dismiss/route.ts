import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "manager", "trainer"];

/**
 * PUT /api/ai/insights/[id]/dismiss
 *
 * Dismiss an insight. Sets status='dismissed', dismissed_by, dismissed_at.
 * Body: optional { reason: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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
        { error: "Insufficient permissions." },
        { status: 403 }
      );
    }

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // ─── Parse Body ──────────────────────────────────────────
    // Optional `reason` field in body is accepted for API compatibility but
    // not persisted — the schema only tracks dismissed_by + dismissed_at.
    try {
      await request.json()
    } catch {
      // Body is optional
    }

    // ─── Update Insight ──────────────────────────────────────
    const { data: insight, error: updateError } = await supabase
      .from("ai_insights")
      .update({
        status: "dismissed",
        dismissed_by: user.id,
        dismissed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (updateError) {
      console.error("PUT /api/ai/insights/[id]/dismiss error:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (!insight) {
      return NextResponse.json(
        { error: "Insight not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: insight });
  } catch (err) {
    console.error("PUT /api/ai/insights/[id]/dismiss error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
