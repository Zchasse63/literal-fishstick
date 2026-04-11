import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from "@/lib/constants";

/**
 * GET /api/waivers/[id]
 * Fetch a single waiver (including full content) for preview / editing.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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

    const { data: waiver, error } = await supabase
      .from("waivers")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!waiver) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    return NextResponse.json({ data: waiver });
  } catch (err) {
    console.error("GET /api/waivers/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/waivers/[id]
 * Update a waiver's name or active status. Content is immutable — to change
 * the content, upload a new version via POST /api/waivers.
 *
 * Body: { name?, is_active? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined && typeof body.name === "string") {
      if (body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.is_active !== undefined && typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("waivers")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select("id, name, version, is_active, created_at, updated_at")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    // Activity log
    const { error: activityError } = await supabase
      .from("activity_log")
      .insert({
        studio_id: studioId,
        actor_id: user.id,
        type: "settings_updated",
        subject_type: "waiver",
        subject_id: id,
        description: `Waiver updated: ${updated.name} (v${updated.version})`,
        metadata: updates,
      });

    if (activityError) {
      console.error(
        "PUT /api/waivers/[id]: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/waivers/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
