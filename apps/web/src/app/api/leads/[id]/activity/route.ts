import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "admin", "manager"];

const VALID_ACTIVITY_TYPES = [
  "call",
  "note",
  "email",
  "sms",
  "meeting",
  "tour",
  "follow_up",
  "status_changed",
  "form_submitted",
  "other",
];

/**
 * POST /api/leads/[id]/activity
 * Log an activity for a lead.
 * Body: { activity_type, description, metadata? }
 */
export async function POST(
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

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await request.json();
    const { activity_type, description, metadata } = body;

    if (!activity_type || !description) {
      return NextResponse.json(
        { error: "activity_type and description are required" },
        { status: 400 }
      );
    }

    if (!VALID_ACTIVITY_TYPES.includes(activity_type)) {
      return NextResponse.json(
        {
          error: `Invalid activity_type. Must be one of: ${VALID_ACTIVITY_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { data: activity, error: insertError } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: id,
        studio_id: studioId,
        activity_type,
        description,
        metadata: metadata ?? {},
        performed_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Update lead's last_activity_at
    await supabase
      .from("leads")
      .update({
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("studio_id", studioId);

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (err) {
    console.error("POST /api/leads/[id]/activity error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
