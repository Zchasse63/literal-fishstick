import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["admin", "manager"];

/**
 * GET /api/automations/[id]
 * Fetch automation flow detail with enrollment stats.
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    const { data: flow, error: flowError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (flowError || !flow) {
      return NextResponse.json(
        { error: "Automation flow not found" },
        { status: 404 }
      );
    }

    // Enrollment stats
    const { data: enrollments } = await supabase
      .from("automation_enrollments")
      .select("status")
      .eq("flow_id", id);

    const stats = {
      total: 0,
      active: 0,
      completed: 0,
      exited: 0,
      paused: 0,
    };

    for (const e of enrollments ?? []) {
      stats.total++;
      if (e.status === "active") stats.active++;
      else if (e.status === "completed") stats.completed++;
      else if (e.status === "exited") stats.exited++;
      else if (e.status === "paused") stats.paused++;
    }

    return NextResponse.json({
      data: { ...flow, enrollment_stats: stats },
    });
  } catch (err) {
    console.error("GET /api/automations/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/automations/[id]
 * Update automation flow. Increments version. Pauses active enrollments if flow was active.
 * Body: { name?, description?, trigger_type?, trigger_config?, steps?, is_active? }
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    // Fetch current flow
    const { data: existingFlow, error: fetchError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (fetchError || !existingFlow) {
      return NextResponse.json(
        { error: "Automation flow not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      "name",
      "description",
      "trigger_type",
      "trigger_config",
      "steps",
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

    // Increment version
    updates.version = (existingFlow.version ?? 0) + 1;
    updates.updated_at = new Date().toISOString();

    // If flow was active, pause active enrollments so they don't run stale steps
    if (existingFlow.is_active) {
      await supabase
        .from("automation_enrollments")
        .update({
          status: "paused",
          exit_reason: "flow_updated",
          updated_at: new Date().toISOString(),
        })
        .eq("flow_id", id)
        .eq("status", "active");
    }

    const { data: updated, error: updateError } = await supabase
      .from("automation_flows")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "automation_updated",
      entity_type: "automation_flow",
      entity_id: id,
      metadata: { updated_fields: Object.keys(updates), new_version: updates.version },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/automations/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automations/[id]
 * Exit all enrollments and delete the automation flow.
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    // Verify flow exists
    const { data: flow, error: flowError } = await supabase
      .from("automation_flows")
      .select("id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (flowError || !flow) {
      return NextResponse.json(
        { error: "Automation flow not found" },
        { status: 404 }
      );
    }

    // Exit all active/paused enrollments
    await supabase
      .from("automation_enrollments")
      .update({
        status: "exited",
        exit_reason: "flow_deleted",
        exited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("flow_id", id)
      .in("status", ["active", "paused"]);

    // Delete the flow
    const { error: deleteError } = await supabase
      .from("automation_flows")
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
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "automation_deleted",
      entity_type: "automation_flow",
      entity_id: id,
      metadata: {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/automations/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
