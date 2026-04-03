import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/settings
 * Fetch studio settings.
 */
export async function GET(_request: NextRequest) {
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Try studio_settings table first, fall back to locations table
    const { data: settings, error: settingsError } = await supabase
      .from("studio_settings")
      .select("*")
      .eq("studio_id", studioId)
      .single();

    if (settingsError) {
      // Fallback: try fetching from locations
      const { data: location, error: locationError } = await supabase
        .from("locations")
        .select("*")
        .eq("studio_id", studioId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (locationError) {
        return NextResponse.json(
          { error: "Settings not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: location });
    }

    return NextResponse.json({ data: settings });
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Update studio settings.
 * Body: { name?, address?, phone?, email?, timezone?, operating_hours?,
 *         booking_rules?, notification_settings? }
 */
export async function PUT(request: NextRequest) {
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    const body = await request.json();
    const allowedFields = [
      "name",
      "address",
      "phone",
      "email",
      "timezone",
      "operating_hours",
      "booking_rules",
      "notification_settings",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    // Try to upsert into studio_settings
    const { data: existing } = await supabase
      .from("studio_settings")
      .select("id")
      .eq("studio_id", studioId)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("studio_settings")
        .update(updates)
        .eq("studio_id", studioId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from("studio_settings")
        .insert({ studio_id: studioId, ...updates })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      result = data;
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "settings_updated",
      subject_type: "studio_settings",
      subject_id: studioId,
      metadata: updates,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
