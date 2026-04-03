import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * GET /api/leads
 * List leads with filtering and pagination.
 * Query params: status, source, score_min, score_max, assigned_to, search, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const scoreMin = searchParams.get("score_min");
    const scoreMax = searchParams.get("score_max");
    const assignedTo = searchParams.get("assigned_to");
    const search = searchParams.get("search");
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
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    let query = supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, email)", {
        count: "exact",
      })
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (source) {
      query = query.eq("source", source);
    }

    if (scoreMin) {
      query = query.gte("score", parseInt(scoreMin, 10));
    }

    if (scoreMax) {
      query = query.lte("score", parseInt(scoreMax, 10));
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads
 * Create a lead manually.
 * Body: { first_name, last_name, email, phone?, source?, notes?, assigned_to? }
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
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { first_name, last_name, email, phone, source, notes, assigned_to } = body;

    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { error: "first_name, last_name, and email are required" },
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

    // Deduplicate by email within the studio
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("email", email)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A lead with this email already exists" },
        { status: 409 }
      );
    }

    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        studio_id: studioId,
        first_name,
        last_name,
        email,
        phone: phone ?? null,
        source: source ?? "other",
        notes: notes ?? null,
        assigned_to: assigned_to ?? null,
        status: "new",
        score: 0,
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

    // Log initial activity
    await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      studio_id: studioId,
      activity_type: "created",
      description: `Lead created manually by staff`,
      performed_by: user.id,
    });

    // Log to activity_log
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "lead_created",
      subject_type: "lead",
      subject_id: lead.id,
      metadata: { email, source: source ?? "other" },
    });

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (err) {
    console.error("POST /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
