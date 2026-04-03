import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * GET /api/reports/[id]/exports
 *
 * List past exports for a saved report.
 * Query params: limit, offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    // ─── Auth ──────────────────────────────────────────────────
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

    const studioId = profile?.studio_id ?? STUDIO_ID;
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    // ─── Verify report belongs to studio ───────────────────────
    const { data: report, error: reportError } = await supabase
      .from("saved_reports")
      .select("id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "20", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // ─── Fetch Exports ─────────────────────────────────────────
    const { data, error, count } = await supabase
      .from("report_exports")
      .select("*", { count: "exact" })
      .eq("report_id", id)
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/reports/[id]/exports error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
