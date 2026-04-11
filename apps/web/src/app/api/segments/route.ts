import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * GET /api/segments
 * List all smart segments with computed member counts.
 * Query params: system_only (boolean)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

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

    let query = supabase
      .from("smart_segments")
      .select("*")
      .eq("studio_id", studioId)
      .order("name");

    const systemOnly = searchParams.get("system_only");
    if (systemOnly === "true") {
      query = query.eq("is_system", true);
    }

    const { data: segments, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json(segments);
  } catch (err) {
    console.error("GET /api/segments error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/segments
 * Create a new custom smart segment.
 * Body: { name, description?, rules, color?, icon? }
 */
export async function POST(request: NextRequest) {
  try {
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

    // Tier 4.8: role check was missing on POST (GET had one). Mirror the
    // canonical owner/manager pattern.
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!body.rules || typeof body.rules !== "object") {
      return NextResponse.json(
        { error: "rules is required and must be an object" },
        { status: 400 }
      );
    }

    const segmentName = body.name.trim();

    const { data, error } = await supabase
      .from("smart_segments")
      .insert({
        studio_id: studioId,
        name: segmentName,
        description: body.description ?? null,
        rules: body.rules,
        color: body.color || "#4F46E5",
        icon: body.icon || "users",
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Tier 4.8: activity_log entry was missing entirely. Add capture-and-log
    // pattern. Uses 'settings_updated' type (settings/config-style resource)
    // since there's no dedicated segment_created type in the enum and this
    // is a low-volume admin operation.
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "settings_updated",
      subject_type: "smart_segment",
      subject_id: data.id,
      description: `Smart segment created: ${segmentName}`,
      metadata: {
        segment_name: segmentName,
        rules: body.rules,
      },
    });

    if (activityError) {
      console.error(
        "POST /api/segments: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/segments error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
