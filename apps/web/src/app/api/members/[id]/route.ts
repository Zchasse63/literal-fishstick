import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/members/[id]
 * Fetch single member with profile, bookings summary, transaction summary, tags, credit packs.
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
      authProfile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Role check
    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Fetch member profile with memberships
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("*, memberships(id, type, status, started_at, expires_at)")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Fetch tags
    const { data: tags } = await supabase
      .from("member_tags")
      .select("*")
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });

    // Total bookings count
    const { count: totalBookings } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", id)
      .eq("studio_id", studioId);

    // Bookings in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: recentBookings } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Transaction summary
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount")
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .eq("status", "completed");

    const totalSpend = (transactions ?? []).reduce(
      (sum, t) => sum + (t.amount ?? 0),
      0
    );

    // Credit packs
    const { data: creditPacks } = await supabase
      .from("credit_packs")
      .select("*")
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      data: {
        ...member,
        tags: tags ?? [],
        credit_packs: creditPacks ?? [],
        bookings_summary: {
          total: totalBookings ?? 0,
          last_30_days: recentBookings ?? 0,
        },
        transaction_summary: {
          total_spend: totalSpend,
          transaction_count: (transactions ?? []).length,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/members/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/members/[id]
 * Update member details.
 * Body: { full_name?, email?, phone?, membership_tier?, membership_status?,
 *         credits_remaining?, notes?, exclude_from_analytics?, roles? }
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
      authProfile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Role check — only owner/manager can update members (prevents privilege escalation)
    const callerRoles: string[] = authProfile?.roles ?? [];
    if (!callerRoles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // NOTE: 'roles' intentionally excluded — role changes require owner-only endpoint
    const allowedFields = [
      "full_name",
      "email",
      "phone",
      "membership_tier",
      "membership_status",
      "credits_remaining",
      "notes",
      "exclude_from_analytics",
    ];

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
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "member_updated",
      subject_type: "profile",
      subject_id: id,
      metadata: updates,
    });

    // Invalidate AI cache entries for this member so stale predictions
    // (churn, health score, etc.) are regenerated on next request.
    await supabase
      .from("ai_cache")
      .delete()
      .eq("studio_id", studioId)
      .eq("entity_id", id);

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/members/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/members/[id]
 * Soft-delete a member (set status to 'archived').
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
      authProfile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "member_archived",
      subject_type: "profile",
      subject_id: id,
      metadata: {},
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("DELETE /api/members/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
