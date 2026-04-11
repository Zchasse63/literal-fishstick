import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from "@/lib/constants";

/**
 * GET /api/waivers
 * List waivers for the current studio. Excludes the `content` field by
 * default (can be large). Use GET /api/waivers/[id] to fetch full content.
 *
 * Query params:
 *   - active: 'true' | 'false' — filter by is_active (default: all)
 *   - limit: max 100, default 50
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const activeParam = searchParams.get("active");
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10),
      100
    );

    let query = supabase
      .from("waivers")
      .select("id, name, version, is_active, created_at, updated_at", {
        count: "exact",
      })
      .eq("studio_id", studioId)
      .order("version", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (activeParam === "true") {
      query = query.eq("is_active", true);
    } else if (activeParam === "false") {
      query = query.eq("is_active", false);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/waivers error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/waivers
 * Upload a new waiver document. Each upload creates a new version — the
 * version number is auto-computed as max(existing) + 1 for the same
 * studio. Previous versions remain stored but can be marked inactive.
 *
 * Body: { name?, content, activate? }
 *   - name: optional display name (default: "Standard Waiver")
 *   - content: REQUIRED full text of the waiver (markdown / plain text)
 *   - activate: if true, also deactivates all prior waivers for this studio
 *     and sets the new one to active (default: true)
 */
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, content, activate } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "content is required and must be non-empty" },
        { status: 400 }
      );
    }

    // Soft length guard — waiver content should be at most ~100KB of text.
    if (content.length > 100_000) {
      return NextResponse.json(
        { error: "content exceeds maximum length of 100,000 characters" },
        { status: 400 }
      );
    }

    // Determine next version number
    const { data: existingVersions } = await supabase
      .from("waivers")
      .select("version")
      .eq("studio_id", studioId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion =
      existingVersions && existingVersions.length > 0
        ? (existingVersions[0].version as number) + 1
        : 1;

    const shouldActivate = activate !== false; // default true

    // If activating, deactivate existing waivers in the same studio first
    if (shouldActivate) {
      await supabase
        .from("waivers")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("studio_id", studioId)
        .eq("is_active", true);
    }

    const insertName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim()
        : "Standard Waiver";

    const { data: newWaiver, error: insertError } = await supabase
      .from("waivers")
      .insert({
        studio_id: studioId,
        name: insertName,
        content,
        version: nextVersion,
        is_active: shouldActivate,
      })
      .select("id, name, version, is_active, created_at, updated_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Activity log — capture-and-log pattern
    const { error: activityError } = await supabase
      .from("activity_log")
      .insert({
        studio_id: studioId,
        actor_id: user.id,
        type: "settings_updated",
        subject_type: "waiver",
        subject_id: newWaiver.id,
        description: `Waiver uploaded: ${insertName} (v${nextVersion})`,
        metadata: {
          waiver_name: insertName,
          version: nextVersion,
          is_active: shouldActivate,
          content_length: content.length,
        },
      });

    if (activityError) {
      console.error(
        "POST /api/waivers: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({ data: newWaiver }, { status: 201 });
  } catch (err) {
    console.error("POST /api/waivers error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
