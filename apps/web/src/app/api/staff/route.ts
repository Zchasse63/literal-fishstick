import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { normalizePhone } from '@/lib/validation'

/**
 * GET /api/staff
 * List all staff members for the studio.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const role = searchParams.get("role");
    const isActive = searchParams.get("is_active");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    let query = supabase
      .from("staff")
      .select("*, profile:profiles!staff_profile_id_fkey(id, full_name, email, phone)", {
        count: "exact",
      })
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) {
      query = query.eq("role", role);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq("is_active", isActive === "true");
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/staff error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/staff
 * Create a new staff member.
 * Body: { email, full_name, role, phone?, hire_date? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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
    const { email, full_name, role, phone, hire_date } = body;

    if (!email || !full_name || !role) {
      return NextResponse.json(
        { error: "email, full_name, and role are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if a profile exists for this email; create one if not
    const { data: foundProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .eq("studio_id", studioId)
      .maybeSingle();

    let profileId: string;

    if (!foundProfile) {
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          email,
          full_name,
          phone: normalizePhone(phone) ?? null,
          roles: ["staff", role],
          studio_id: studioId,
          status: "active",
        })
        .select()
        .single();

      if (profileError || !newProfile) {
        return NextResponse.json(
          { error: profileError?.message ?? "Failed to create profile" },
          { status: 500 }
        );
      }
      profileId = newProfile.id;
    } else {
      profileId = foundProfile.id;
    }

    // Check for duplicate staff record
    const { data: existingStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", profileId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existingStaff) {
      return NextResponse.json(
        { error: "A staff record already exists for this person" },
        { status: 409 }
      );
    }

    const { data: staffRecord, error: staffError } = await supabase
      .from("staff")
      .insert({
        profile_id: profileId,
        studio_id: studioId,
        role,
        hire_date: hire_date ?? new Date().toISOString().split("T")[0],
        is_active: true,
      })
      .select("*, profile:profiles!staff_profile_id_fkey(id, full_name, email, phone)")
      .single();

    if (staffError) {
      return NextResponse.json(
        { error: staffError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "staff_created",
      subject_type: "staff",
      subject_id: staffRecord.id,
      metadata: { email, full_name, role },
    });

    return NextResponse.json({ data: staffRecord }, { status: 201 });
  } catch (err) {
    console.error("POST /api/staff error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
