import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/members
 * List members with search and filter support.
 * Query params: search, status, membership_type, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const membershipType = searchParams.get("membership_type");
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    let query = supabase
      .from("profiles")
      .select("*, memberships(id, type, status, started_at, expires_at)", {
        count: "exact",
      })
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Full-text search on name and email
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (membershipType) {
      query = query.eq("memberships.type", membershipType);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/members error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/members
 * Create a new member profile.
 * Body: { email, full_name, phone?, roles? }
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

    const body = await request.json();
    const { email, full_name, phone, roles } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: "email and full_name are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Check for duplicate email within the studio
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 409 }
      );
    }

    const { data: member, error: insertError } = await supabase
      .from("profiles")
      .insert({
        email,
        full_name,
        phone: phone ?? null,
        roles: roles ?? ["member"],
        studio_id: studioId,
        status: "active",
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
      action: "member_created",
      entity_type: "profile",
      entity_id: member.id,
      metadata: { email, full_name },
    });

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (err) {
    console.error("POST /api/members error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
