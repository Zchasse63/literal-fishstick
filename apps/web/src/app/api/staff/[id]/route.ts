import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * GET /api/staff/[id]
 * Fetch a single staff member with schedule and performance data.
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check
    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Fetch staff record with profile
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("*, profile:profiles!staff_profile_id_fkey(id, full_name, email, phone)")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    // Fetch upcoming classes assigned to this staff member (as trainer)
    const { data: upcomingClasses } = await supabase
      .from("classes")
      .select("id, title, start_time, end_time, capacity, status")
      .eq("trainer_id", staff.profile_id)
      .eq("studio_id", studioId)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(10);

    // Performance: count classes taught in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: classesLast30d } = await supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", staff.profile_id)
      .eq("studio_id", studioId)
      .gte("start_time", thirtyDaysAgo.toISOString())
      .lte("start_time", new Date().toISOString());

    // Count total check-ins for their classes in last 30 days
    const { data: recentClasses } = await supabase
      .from("classes")
      .select("id")
      .eq("trainer_id", staff.profile_id)
      .eq("studio_id", studioId)
      .gte("start_time", thirtyDaysAgo.toISOString())
      .lte("start_time", new Date().toISOString());

    let totalCheckIns = 0;
    if (recentClasses && recentClasses.length > 0) {
      const classIds = recentClasses.map((c) => c.id);
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds)
        .eq("studio_id", studioId)
        .eq("status", "checked_in");
      totalCheckIns = count ?? 0;
    }

    return NextResponse.json({
      data: {
        ...staff,
        upcoming_classes: upcomingClasses ?? [],
        performance: {
          classes_last_30d: classesLast30d ?? 0,
          check_ins_last_30d: totalCheckIns,
          avg_check_ins_per_class:
            (classesLast30d ?? 0) > 0
              ? Math.round((totalCheckIns / (classesLast30d ?? 1)) * 10) / 10
              : 0,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/staff/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/staff/[id]
 * Update a staff member's details.
 * Body: { role?, is_active?, hire_date? }
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    const body = await request.json();
    const allowedFields = ["role", "is_active", "hire_date"];

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

    const { data: updated, error } = await supabase
      .from("staff")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select("*, profile:profiles!staff_profile_id_fkey(id, full_name, email, phone)")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "staff_updated",
      subject_type: "staff",
      subject_id: id,
      metadata: updates,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/staff/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/staff/[id]
 * Deactivate a staff member (set is_active = false).
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    const { data: updated, error } = await supabase
      .from("staff")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("studio_id", studioId)
      .select("*, profile:profiles!staff_profile_id_fkey(id, full_name, email)")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "staff_deactivated",
      subject_type: "staff",
      subject_id: id,
      metadata: {},
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("DELETE /api/staff/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
