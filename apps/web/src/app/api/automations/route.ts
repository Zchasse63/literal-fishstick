import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["admin", "manager"];

const VALID_TRIGGER_TYPES = [
  "member_created",
  "membership_purchased",
  "membership_cancelled",
  "membership_expiring",
  "booking_completed",
  "no_show",
  "check_in",
  "tag_added",
  "tag_removed",
  "inactivity",
  "birthday",
  "lead_created",
  "lead_status_changed",
  "credit_pack_low",
  "credit_pack_expired",
];

/**
 * GET /api/automations
 * List automation flows with enrollment counts.
 * Query params: is_active, trigger_type, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const isActive = searchParams.get("is_active");
    const triggerType = searchParams.get("trigger_type");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

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

    let query = supabase
      .from("automation_flows")
      .select("*", { count: "exact" })
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      query = query.eq("is_active", isActive === "true");
    }

    if (triggerType) {
      query = query.eq("trigger_type", triggerType);
    }

    const { data: flows, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch enrollment counts for each flow
    const flowIds = (flows ?? []).map((f: { id: string }) => f.id);
    let enrollmentCounts: Record<string, { active: number; total: number }> = {};

    if (flowIds.length > 0) {
      const { data: enrollments } = await supabase
        .from("automation_enrollments")
        .select("flow_id, status")
        .in("flow_id", flowIds);

      for (const enrollment of enrollments ?? []) {
        if (!enrollmentCounts[enrollment.flow_id]) {
          enrollmentCounts[enrollment.flow_id] = { active: 0, total: 0 };
        }
        enrollmentCounts[enrollment.flow_id].total++;
        if (enrollment.status === "active") {
          enrollmentCounts[enrollment.flow_id].active++;
        }
      }
    }

    const flowsWithCounts = (flows ?? []).map((flow: { id: string }) => ({
      ...flow,
      enrollment_counts: enrollmentCounts[flow.id] ?? { active: 0, total: 0 },
    }));

    return NextResponse.json({ data: flowsWithCounts, count });
  } catch (err) {
    console.error("GET /api/automations error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automations
 * Create a new automation flow.
 * Body: { name, trigger_type, trigger_config?, steps, description? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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

    const body = await request.json();
    const { name, trigger_type, trigger_config, steps, description } = body;

    if (!name || !trigger_type || !steps) {
      return NextResponse.json(
        { error: "name, trigger_type, and steps are required" },
        { status: 400 }
      );
    }

    if (!VALID_TRIGGER_TYPES.includes(trigger_type)) {
      return NextResponse.json(
        {
          error: `Invalid trigger_type. Must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "steps must be a non-empty array" },
        { status: 400 }
      );
    }

    const { data: flow, error: insertError } = await supabase
      .from("automation_flows")
      .insert({
        studio_id: studioId,
        name,
        description: description ?? null,
        trigger_type,
        trigger_config: trigger_config ?? {},
        steps,
        version: 1,
        is_active: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "automation_created",
      subject_type: "automation_flow",
      subject_id: flow.id,
      metadata: { name, trigger_type },
    });

    return NextResponse.json({ data: flow }, { status: 201 });
  } catch (err) {
    console.error("POST /api/automations error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
