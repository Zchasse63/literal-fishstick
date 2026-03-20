import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/email-preferences/[memberId]
 * Get email preferences for a member. Creates default preferences if none exist.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { memberId } = await params;

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
    const userRoles: string[] = profile?.roles ?? [];
    const isAdmin = userRoles.some((r: string) => ["admin", "manager"].includes(r));

    // Members can view their own preferences; admins can view anyone's
    if (user.id !== memberId && !isAdmin) {
      return NextResponse.json(
        { error: "You can only view your own email preferences" },
        { status: 403 }
      );
    }

    // Verify the member exists
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", memberId)
      .eq("studio_id", studioId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Try to fetch existing preferences
    let { data: preferences } = await supabase
      .from("email_preferences")
      .select("*")
      .eq("member_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    // Create default preferences if none exist
    if (!preferences) {
      const { data: created, error: createError } = await supabase
        .from("email_preferences")
        .insert({
          member_id: memberId,
          studio_id: studioId,
          marketing_email: true,
          transactional_email: true,
          booking_confirmations: true,
          booking_reminders: true,
          membership_updates: true,
          promotions: true,
          newsletter: true,
          community_updates: true,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        );
      }
      preferences = created;
    }

    return NextResponse.json({ data: preferences });
  } catch (err) {
    console.error("GET /api/email-preferences/[memberId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/email-preferences/[memberId]
 * Update email preferences for a member.
 * Body: { marketing_email?, transactional_email?, booking_confirmations?,
 *         booking_reminders?, membership_updates?, promotions?, newsletter?,
 *         community_updates? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { memberId } = await params;

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
    const userRoles: string[] = profile?.roles ?? [];
    const isAdmin = userRoles.some((r: string) => ["admin", "manager"].includes(r));

    // Members can update their own preferences; admins can update anyone's
    if (user.id !== memberId && !isAdmin) {
      return NextResponse.json(
        { error: "You can only update your own email preferences" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      "marketing_email",
      "transactional_email",
      "booking_confirmations",
      "booking_reminders",
      "membership_updates",
      "promotions",
      "newsletter",
      "community_updates",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "boolean") {
          return NextResponse.json(
            { error: `${field} must be a boolean` },
            { status: 400 }
          );
        }
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

    // Ensure preferences row exists (upsert)
    const { data: existing } = await supabase
      .from("email_preferences")
      .select("id")
      .eq("member_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("email_preferences")
        .update(updates)
        .eq("member_id", memberId)
        .eq("studio_id", studioId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("email_preferences")
        .insert({
          member_id: memberId,
          studio_id: studioId,
          marketing_email: true,
          transactional_email: true,
          booking_confirmations: true,
          booking_reminders: true,
          membership_updates: true,
          promotions: true,
          newsletter: true,
          community_updates: true,
          ...updates,
        })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "email_preferences_updated",
      entity_type: "email_preferences",
      entity_id: memberId,
      metadata: updates,
    });

    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error("PUT /api/email-preferences/[memberId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
