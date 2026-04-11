import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { normalizePhone } from '@/lib/validation'

// `studios` holds the business-identity fields (name, address, phone, etc.)
// while `studio_settings` holds operational/policy fields. The API merges
// them into a single payload for the client.
const STUDIO_FIELDS = [
  "name",
  "address",
  "city",
  "state",
  "zip",
  "phone",
  "email",
  "timezone",
] as const;

const STUDIO_SETTINGS_FIELDS = [
  "late_cancel_window_minutes",
  "strike_window_days",
  "strike_penalties",
  "strike_system_enabled",
  "unlimited_members_warning_only",
  "credit_grace_period_days",
  "waitlist_claim_window_minutes",
  "inventory_hold_minutes",
  "checkout_lock_minutes",
  "pilot_discount_rate",
  "member_discount_rate",
  "private_event_base_rate",
  "waiver_text",
] as const;

/**
 * GET /api/settings
 * Fetch studio settings — merged view of `studios` + `studio_settings`.
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
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const [{ data: studio }, { data: studioSettings }] = await Promise.all([
      supabase
        .from("studios")
        .select("name, address, city, state, zip, phone, email, timezone")
        .eq("id", studioId)
        .maybeSingle(),
      supabase
        .from("studio_settings")
        .select("*")
        .eq("studio_id", studioId)
        .maybeSingle(),
    ]);

    if (!studio && !studioSettings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        ...((studio as Record<string, unknown> | null) ?? {}),
        ...((studioSettings as Record<string, unknown> | null) ?? {}),
      },
    });
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
 * Update studio settings. Routes identity fields to `studios` and
 * operational/policy fields to `studio_settings` based on the real schema.
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
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const studioUpdates: Record<string, unknown> = {};
    for (const field of STUDIO_FIELDS) {
      if (body[field] !== undefined) {
        studioUpdates[field] =
          field === "phone"
            ? normalizePhone(body[field] as string | null)
            : body[field];
      }
    }

    const settingsUpdates: Record<string, unknown> = {};
    for (const field of STUDIO_SETTINGS_FIELDS) {
      if (body[field] !== undefined) {
        settingsUpdates[field] = body[field];
      }
    }

    if (
      Object.keys(studioUpdates).length === 0 &&
      Object.keys(settingsUpdates).length === 0
    ) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // Update studios (identity) if applicable
    if (Object.keys(studioUpdates).length > 0) {
      studioUpdates.updated_at = nowIso;
      const { error: studioError } = await supabase
        .from("studios")
        .update(studioUpdates)
        .eq("id", studioId);

      if (studioError) {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    // Upsert studio_settings (policy) if applicable
    if (Object.keys(settingsUpdates).length > 0) {
      settingsUpdates.updated_at = nowIso;

      const { data: existing } = await supabase
        .from("studio_settings")
        .select("id")
        .eq("studio_id", studioId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("studio_settings")
          .update(settingsUpdates)
          .eq("studio_id", studioId);

        if (error) {
          return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
          );
        }
      } else {
        const { error } = await supabase
          .from("studio_settings")
          .insert({ studio_id: studioId, ...settingsUpdates });

        if (error) {
          return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
          );
        }
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "settings_updated",
      subject_type: "studio_settings",
      subject_id: studioId,
      metadata: { studio: studioUpdates, settings: settingsUpdates },
    });

    // Return the merged view so the client can refresh without a second fetch
    const [{ data: studio }, { data: studioSettings }] = await Promise.all([
      supabase
        .from("studios")
        .select("name, address, city, state, zip, phone, email, timezone")
        .eq("id", studioId)
        .maybeSingle(),
      supabase
        .from("studio_settings")
        .select("*")
        .eq("studio_id", studioId)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      data: {
        ...((studio as Record<string, unknown> | null) ?? {}),
        ...((studioSettings as Record<string, unknown> | null) ?? {}),
      },
    });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
