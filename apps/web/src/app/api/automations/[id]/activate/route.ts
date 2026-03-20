import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["admin", "manager"];

/**
 * POST /api/automations/[id]/activate
 * Set flow is_active=true and resume paused enrollments.
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

    if (flow.is_active) {
      return NextResponse.json(
        { error: "Automation flow is already active" },
        { status: 409 }
      );
    }

    // Activate the flow
    const { data: updated, error: updateError } = await supabase
      .from("automation_flows")
      .update({
        is_active: true,
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

    // Resume paused enrollments
    const { count: resumedCount } = await supabase
      .from("automation_enrollments")
      .update({
        status: "active",
        exit_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("flow_id", id)
      .eq("status", "paused");

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "automation_activated",
      entity_type: "automation_flow",
      entity_id: id,
      metadata: { resumed_enrollments: resumedCount ?? 0 },
    });

    return NextResponse.json({
      data: updated,
      resumed_enrollments: resumedCount ?? 0,
    });
  } catch (err) {
    console.error("POST /api/automations/[id]/activate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
