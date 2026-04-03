import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { normalizePhone } from '@/lib/validation'

/**
 * GET /api/members
 * List members with search and filter support.
 * Query params: search, status, membership_type, limit, offset
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (auth.error) return auth.error;
  const { supabase, studioId } = auth;

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const membershipType = searchParams.get("membership_type");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  let query = supabase
      .from("members")
      .select("*, profiles:profile_id ( id, full_name, email, phone, avatar_url )", {
        count: "exact",
      })
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `profiles.full_name.ilike.%${search}%,profiles.email.ilike.%${search}%,profiles.phone.ilike.%${search}%`
    );
  }
  if (status) query = query.eq("membership_status", status);
  if (membershipType) query = query.eq("membership_tier", membershipType);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}

/**
 * POST /api/members
 * Create a new member profile.
 * Body: { email, full_name, phone?, roles? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (auth.error) return auth.error;
  const { user, supabase, studioId } = auth;

  const body = await request.json();
  const { email, full_name, phone, roles } = body;

  if (!email || !full_name) {
    return NextResponse.json(
      { error: "email and full_name are required" },
      { status: 400 },
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

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
      { status: 409 },
    );
  }

  const { data: member, error: insertError } = await supabase
    .from("profiles")
    .insert({
      email,
      full_name,
      phone: normalizePhone(phone) ?? null,
      roles: roles ?? ["member"],
      studio_id: studioId,
      status: "active",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Log activity
  await supabase.from("activity_log").insert({
    studio_id: studioId,
    actor_id: user.id,
    type: "member_created",
    subject_type: "profile",
    subject_id: member.id,
    metadata: { email, full_name },
  });

  return NextResponse.json({ data: member }, { status: 201 });
}
