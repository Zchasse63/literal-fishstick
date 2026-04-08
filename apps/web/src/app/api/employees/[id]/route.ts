import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * GET /api/employees/[id]
 * Get a single employee by ID.
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

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID;

    const { data, error } = await supabase
      .from("employees")
      .select("*, profiles:profile_id ( id, full_name, email, phone, roles )")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (error) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/employees/[id]
 * Update an employee.
 * Body: { full_name?, email?, phone?, role?, employment_type?, hire_date?, pay_rate?, pay_type?, status? }
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

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId = authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { full_name, email, phone, role, employment_type, hire_date, pay_rate, pay_type, status } = body;

    // Fetch the employee to get profile_id
    const { data: employee, error: fetchError } = await supabase
      .from("employees")
      .select("id, profile_id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (fetchError || !employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Update employee fields
    const employeeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (employment_type !== undefined) employeeUpdates.employment_type = employment_type;
    if (hire_date !== undefined) employeeUpdates.hire_date = hire_date;
    if (pay_rate !== undefined) employeeUpdates.pay_rate = pay_rate;
    if (pay_type !== undefined) employeeUpdates.pay_type = pay_type;
    if (status !== undefined) employeeUpdates.status = status;

    const { error: updateError } = await supabase
      .from("employees")
      .update(employeeUpdates)
      .eq("id", id)
      .eq("studio_id", studioId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update profile fields if provided
    const profileUpdates: Record<string, unknown> = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (email !== undefined) profileUpdates.email = email;
    if (phone !== undefined) profileUpdates.phone = phone;

    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", employee.profile_id);
    }

    // Fetch updated record
    const { data: updated } = await supabase
      .from("employees")
      .select("*, profiles:profile_id ( id, full_name, email, phone, roles )")
      .eq("id", id)
      .single();

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "employee_updated",
      subject_type: "employee",
      subject_id: id,
      metadata: body,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/employees/[id]
 * Soft-delete: set status to inactive.
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

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId = authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("employees")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("studio_id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "employee_deactivated",
      subject_type: "employee",
      subject_id: id,
      metadata: {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
