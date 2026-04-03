import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "manager", "trainer"];

/**
 * PUT /api/ai/insights/[id]/action
 *
 * Mark an insight as actioned. Sets status='actioned', actioned_at=now.
 */
export async function PUT(
  _request: NextRequest,
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
    const rl = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // ─── Update Insight ──────────────────────────────────────
    const { data: insight, error: updateError } = await supabase
      .from("ai_insights")
      .update({
        status: "actioned",
        actioned_at: new Date().toISOString(),
        actioned_by: user.id,
      })
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (updateError) {
      console.error("PUT /api/ai/insights/[id]/action error:", updateError);
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
    console.error("PUT /api/ai/insights/[id]/action error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
