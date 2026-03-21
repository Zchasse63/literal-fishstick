import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/transactions
 * List transactions with pagination and filters.
 * Query params: page, limit, type, status, member_id, from, to
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const memberId = searchParams.get("member_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const offset = (page - 1) * limit;

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
      .from("transactions")
      .select(
        "*, member:profiles!transactions_member_id_fkey(id, full_name, email)",
        { count: "exact" }
      )
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq("type", type);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (memberId) {
      query = query.eq("member_id", memberId);
    }

    if (from) {
      query = query.gte("created_at", from);
    }

    if (to) {
      query = query.lte("created_at", to);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      count,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    console.error("GET /api/transactions error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Create a manual transaction (for cash payments, adjustments).
 * Body: { member_id, amount, type, description, status? }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    const body = await request.json();
    const { member_id, amount, type, description, status } = body;

    if (!member_id || amount === undefined || !type) {
      return NextResponse.json(
        { error: "member_id, amount, and type are required" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number") {
      return NextResponse.json(
        { error: "amount must be a number" },
        { status: 400 }
      );
    }

    // Verify member exists in this studio
    const { data: member } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", member_id)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { data: transaction, error: insertError } = await supabase
      .from("transactions")
      .insert({
        member_id,
        studio_id: studioId,
        amount,
        type,
        description: description ?? null,
        status: status ?? "completed",
        created_by: user.id,
      })
      .select("*, member:profiles!transactions_member_id_fkey(id, full_name, email)")
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
      action: "transaction_created",
      entity_type: "transaction",
      entity_id: transaction.id,
      metadata: { member_id, amount, type },
    });

    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (err) {
    console.error("POST /api/transactions error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
