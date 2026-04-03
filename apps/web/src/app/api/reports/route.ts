import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const STUDIO_ID = "11111111-1111-1111-1111-111111111111";
const ALLOWED_ROLES = ["admin", "manager"];

/**
 * GET /api/reports
 *
 * List saved reports with optional filtering and pagination.
 * Query params: search, report_type, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search");
    const reportType = searchParams.get("report_type");
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from("saved_reports")
      .select("*", { count: "exact" })
      .eq("studio_id", studioId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (reportType) {
      query = query.eq("report_type", reportType);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/reports error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports
 *
 * Create a new saved report.
 * Body: { name, description?, report_type, columns, filters, time_range?, group_by?, sort_by?, sort_direction? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json();
    const {
      name,
      description,
      report_type,
      columns,
      filters,
      time_range,
      group_by,
      sort_by,
      sort_direction,
    } = body;

    if (!name || !report_type) {
      return NextResponse.json(
        { error: "name and report_type are required" },
        { status: 400 }
      );
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { error: "columns must be a non-empty array" },
        { status: 400 }
      );
    }

    const validTypes = [
      "attendance",
      "revenue",
      "membership",
      "trainer_payroll",
      "trainer_performance",
      "churn_risk",
      "class_performance",
      "credit_pack_usage",
      "transaction_log",
      "failed_payments",
      "member_movement",
      "campaign_performance",
      "lead_pipeline",
      "custom",
    ];

    if (!validTypes.includes(report_type)) {
      return NextResponse.json(
        { error: `Invalid report_type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // ─── Insert ────────────────────────────────────────────────
    const { data: report, error: insertError } = await supabase
      .from("saved_reports")
      .insert({
        studio_id: studioId,
        name,
        description: description ?? null,
        report_type,
        columns,
        filters: filters ?? [],
        time_range: time_range ?? null,
        group_by: group_by ?? null,
        sort_by: sort_by ?? null,
        sort_direction: sort_direction ?? "desc",
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

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "report_created",
      subject_type: "saved_report",
      subject_id: report.id,
      metadata: { name, report_type },
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (err) {
    console.error("POST /api/reports error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
