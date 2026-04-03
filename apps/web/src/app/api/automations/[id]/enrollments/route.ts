import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * GET /api/automations/[id]/enrollments
 * List enrollments for an automation flow, paginated.
 * Query params: status, limit, offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
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

    // Verify flow exists and belongs to studio
    const { data: flow, error: flowError } = await supabase
      .from("automation_flows")
      .select("id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (flowError || !flow) {
      return NextResponse.json(
        { error: "Automation flow not found" },
        { status: 404 }
      );
    }

    let query = supabase
      .from("automation_enrollments")
      .select("*, member:profiles!automation_enrollments_member_id_fkey(id, full_name, email)", {
        count: "exact",
      })
      .eq("flow_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: enrollments, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ data: enrollments, count });
  } catch (err) {
    console.error("GET /api/automations/[id]/enrollments error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
