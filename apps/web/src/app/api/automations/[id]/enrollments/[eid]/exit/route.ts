import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * POST /api/automations/[id]/enrollments/[eid]/exit
 * Manually exit a member from an automation enrollment.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id, eid } = await params;

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

    // Verify flow exists and belongs to studio
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

    // Verify enrollment exists and is in an exitable state
    const { data: enrollment, error: enrollError } = await supabase
      .from("automation_enrollments")
      .select("id, status, member_id")
      .eq("id", eid)
      .eq("flow_id", id)
      .single();

    if (enrollError || !enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    if (enrollment.status === "exited" || enrollment.status === "completed") {
      return NextResponse.json(
        { error: `Enrollment is already ${enrollment.status}` },
        { status: 409 }
      );
    }

    // Exit the enrollment
    const { data: updated, error: updateError } = await supabase
      .from("automation_enrollments")
      .update({
        status: "exited",
        exit_reason: "manual",
        exited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", eid)
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
      type: "enrollment_exited",
      subject_type: "automation_enrollment",
      subject_id: eid,
      metadata: {
        flow_id: id,
        member_id: enrollment.member_id,
        exit_reason: "manual",
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("POST /api/automations/[id]/enrollments/[eid]/exit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
