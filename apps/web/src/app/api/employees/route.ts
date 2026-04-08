import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * GET /api/employees
 * List all employees for the studio.
 */
export async function GET(_request: NextRequest) {
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

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error, count } = await supabase
      .from("employees")
      .select("*, profiles:profile_id ( id, full_name, email, phone, roles )", { count: "exact" })
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/employees
 * Create a new employee profile.
 * Body: { full_name, email, phone?, role, employment_type, hire_date?, pay_rate?, pay_type? }
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
    const { full_name, email, phone, role, employment_type, hire_date, pay_rate, pay_type } = body;

    if (!full_name || !email || !role) {
      return NextResponse.json(
        { error: "full_name, email, and role are required" },
        { status: 400 }
      );
    }

    // Check if a profile already exists for this email
    let profileId: string;
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existingProfile) {
      profileId = existingProfile.id;
      // Add the role to the existing profile if not already present
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", profileId)
        .single();

      const currentRoles: string[] = fullProfile?.roles ?? [];
      if (!currentRoles.includes(role)) {
        await supabase
          .from("profiles")
          .update({ roles: [...currentRoles, role] })
          .eq("id", profileId);
      }
    } else {
      // Create a new profile
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          full_name,
          email,
          phone: phone ?? null,
          studio_id: studioId,
          roles: [role],
        })
        .select("id")
        .single();

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
      profileId = newProfile.id;
    }

    // Create the employee record
    const { data: employee, error: insertError } = await supabase
      .from("employees")
      .insert({
        profile_id: profileId,
        studio_id: studioId,
        status: "active",
        employment_type: employment_type ?? "part_time",
        hire_date: hire_date ?? null,
        pay_rate: pay_rate ?? null,
        pay_type: pay_type ?? "hourly",
      })
      .select("*, profiles:profile_id ( id, full_name, email, phone, roles )")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "employee_created",
      subject_type: "employee",
      subject_id: employee.id,
      metadata: { full_name, email, role },
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (err) {
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
