import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["admin", "manager"];

/**
 * POST /api/automations/[id]/deactivate
 * Set flow is_active=false and pause all active enrollments.
 */
export async function POST(
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
      .select("id, is_active")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (flowError || !flow) {
      return NextResponse.json(
        { error: "Automation flow not found" },
        { status: 404 }
      );
    }

    if (!flow.is_active) {
      return NextResponse.json(
        { error: "Automation flow is already inactive" },
        { status: 409 }
      );
    }

    // Deactivate the flow
    const { data: updated, error: updateError } = await supabase
      .from("automation_flows")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
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

    // Pause all active enrollments
    const { count: pausedCount } = await supabase
      .from("automation_enrollments")
      .update({
        status: "paused",
        exit_reason: "flow_deactivated",
        updated_at: new Date().toISOString(),
      })
      .eq("flow_id", id)
      .eq("status", "active");

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "automation_deactivated",
      entity_type: "automation_flow",
      entity_id: id,
      metadata: { paused_enrollments: pausedCount ?? 0 },
    });

    return NextResponse.json({
      data: updated,
      paused_enrollments: pausedCount ?? 0,
    });
  } catch (err) {
    console.error("POST /api/automations/[id]/deactivate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
