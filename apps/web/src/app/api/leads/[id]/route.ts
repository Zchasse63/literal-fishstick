import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { normalizePhone } from '@/lib/validation'

const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * GET /api/leads/[id]
 * Fetch lead detail with activity timeline.
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

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, email)")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch activity timeline
    const { data: activities } = await supabase
      .from("lead_activities")
      .select("*, performer:profiles!lead_activities_performed_by_fkey(id, full_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({
      data: {
        ...lead,
        activities: activities ?? [],
      },
    });
  } catch (err) {
    console.error("GET /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/leads/[id]
 * Update a lead.
 * Body: { first_name?, last_name?, email?, phone?, status?, source?, notes?, assigned_to?, score? }
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

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "status",
      "source",
      "notes",
      "assigned_to",
      "score",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (updates.phone !== undefined) {
      updates.phone = normalizePhone(updates.phone as string | null)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate email if being updated
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email as string)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (updateError) {
      // PGRST116 = "JSON object requested, multiple (or no) rows returned"
      // — surfaces when the lead doesn't exist or isn't in this studio.
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Log activity for status changes
    if (body.status) {
      await supabase.from("lead_activities").insert({
        lead_id: id,
        studio_id: studioId,
        activity_type: "status_changed",
        description: `Status changed to ${body.status}`,
        performed_by: user.id,
        metadata: { new_status: body.status },
      });
    }

    // Log to activity_log
    const u = updated as { first_name?: string; last_name?: string; email?: string };
    const leadName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'lead';
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "lead_updated",
      subject_type: "lead",
      subject_id: id,
      description: `Lead updated: ${leadName}`,
      metadata: updates,
    });

    if (activityError) {
      console.error(
        "PUT /api/leads/[id]: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leads/[id]
 * Delete a lead.
 */
export async function DELETE(
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

    // Delete associated activities first
    await supabase
      .from("lead_activities")
      .delete()
      .eq("lead_id", id);

    // Delete the lead
    const { error: deleteError } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .eq("studio_id", studioId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Log activity
    const { error: deleteActivityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "lead_deleted",
      subject_type: "lead",
      subject_id: id,
      description: `Lead deleted`,
      metadata: {},
    });

    if (deleteActivityError) {
      console.error(
        "DELETE /api/leads/[id]: activity_log insert failed",
        deleteActivityError.message
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
