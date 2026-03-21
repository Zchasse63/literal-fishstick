import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/segments/[id]
 * Fetch a segment with its evaluated member list.
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

    // Fetch the segment
    const { data: segment, error: segmentError } = await supabase
      .from("smart_segments")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    // Evaluate segment rules against the members table
    // Rules format: { field, operator, value }[]
    // Supported operators: eq, neq, gt, gte, lt, lte, ilike, in
    let membersQuery = supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("studio_id", studioId);

    const rules = segment.rules as Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;

    if (Array.isArray(rules)) {
      for (const rule of rules) {
        switch (rule.operator) {
          case "eq":
            membersQuery = membersQuery.eq(rule.field, rule.value);
            break;
          case "neq":
            membersQuery = membersQuery.neq(rule.field, rule.value);
            break;
          case "gt":
            membersQuery = membersQuery.gt(rule.field, rule.value);
            break;
          case "gte":
            membersQuery = membersQuery.gte(rule.field, rule.value);
            break;
          case "lt":
            membersQuery = membersQuery.lt(rule.field, rule.value);
            break;
          case "lte":
            membersQuery = membersQuery.lte(rule.field, rule.value);
            break;
          case "ilike":
            membersQuery = membersQuery.ilike(
              rule.field,
              `%${rule.value}%`
            );
            break;
          case "in":
            if (Array.isArray(rule.value)) {
              membersQuery = membersQuery.in(rule.field, rule.value);
            }
            break;
        }
      }
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      return NextResponse.json(
        { error: membersError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        ...segment,
        members: members ?? [],
        member_count: (members ?? []).length,
      },
    });
  } catch (err) {
    console.error("GET /api/segments/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/segments/[id]
 * Update a segment's rules, name, or color.
 * Body: { name?, description?, rules?, color?, icon? }
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

    // Check that the segment exists and is not a system segment
    const { data: existing } = await supabase
      .from("smart_segments")
      .select("id, is_system")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    if (existing.is_system) {
      return NextResponse.json(
        { error: "System segments cannot be modified" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = ["name", "description", "rules", "color", "icon"];

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
      .from("smart_segments")
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

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/segments/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/segments/[id]
 * Delete a non-system segment.
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

    // Check that segment exists and is not a system segment
    const { data: existing } = await supabase
      .from("smart_segments")
      .select("id, is_system")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    if (existing.is_system) {
      return NextResponse.json(
        { error: "System segments cannot be deleted" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("smart_segments")
      .delete()
      .eq("id", id)
      .eq("studio_id", studioId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/segments/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
