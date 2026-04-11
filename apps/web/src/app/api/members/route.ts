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

  // Search path: two-step query. PostgREST can't reliably .or() across
  // fields of a joined relation — when search is present we first resolve
  // matching profile IDs, then filter members by those ids.
  let profileIdsMatchingSearch: string[] | null = null;
  if (search) {
    const escaped = search.replace(/[%,]/g, "");
    const { data: matchingProfiles, error: profileSearchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("studio_id", studioId)
      .or(
        `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`
      )
      .limit(1000);

    if (profileSearchError) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    profileIdsMatchingSearch = (matchingProfiles ?? []).map((p) => p.id);

    // No matching profiles → empty result set
    if (profileIdsMatchingSearch.length === 0) {
      return NextResponse.json({ data: [], count: 0 });
    }
  }

  let query = supabase
      .from("members")
      .select("*, profiles:profile_id ( id, full_name, email, phone, avatar_url )", {
        count: "exact",
      })
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

  if (profileIdsMatchingSearch) {
    query = query.in("profile_id", profileIdsMatchingSearch);
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

  // BUG-010 Layer 1: profiles has no `status` column; `is_active` defaults to true.
  const { data: profile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      email,
      full_name,
      phone: normalizePhone(phone) ?? null,
      roles: roles ?? ["member"],
      studio_id: studioId,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // BUG-010 Layer 2: also insert the matching `members` row so the directory
  // list (which joins members → profiles) actually surfaces the new record.
  // Roll back the profile on partial failure to avoid leaking orphan rows.
  const { error: memberInsertError } = await supabase
    .from("members")
    .insert({
      profile_id: profile.id,
      studio_id: studioId,
      membership_status: "active",
      join_date: new Date().toISOString().slice(0, 10),
    });

  if (memberInsertError) {
    await supabase.from("profiles").delete().eq("id", profile.id);
    return NextResponse.json(
      { error: `Failed to create member row: ${memberInsertError.message}` },
      { status: 500 }
    );
  }

  // Log activity — BUG-010 Layers 3 & 4: `member_created` is now valid in the
  // CHECK constraint, and `description` is NOT NULL so it must be passed.
  // The Supabase client does not throw on insert errors, so we explicitly
  // capture and log any failure. We do not roll back the profile+member
  // writes — the activity log is observability, not business-critical, and
  // the user has genuinely been created.
  const { error: activityError } = await supabase
    .from("activity_log")
    .insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "member_created",
      subject_type: "profile",
      subject_id: profile.id,
      description: `Member created: ${full_name}`,
      metadata: { email, full_name },
    });

  if (activityError) {
    console.error(
      "POST /api/members: activity_log insert failed",
      activityError.message,
    );
  }

  return NextResponse.json({ data: profile }, { status: 201 });
}
