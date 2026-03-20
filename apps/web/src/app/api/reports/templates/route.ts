import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { REPORT_TEMPLATES } from "@/lib/reports/templates";

/**
 * GET /api/reports/templates
 *
 * List all pre-built report templates. Templates are static configurations
 * that can be used to pre-fill the report builder UI.
 *
 * Query params: report_type (optional filter)
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

    // ─── Optional filter by report_type ────────────────────────
    const { searchParams } = request.nextUrl;
    const reportType = searchParams.get("report_type");

    let templates = REPORT_TEMPLATES;

    if (reportType) {
      templates = templates.filter((t) => t.report_type === reportType);
    }

    return NextResponse.json({ data: templates, count: templates.length });
  } catch (err) {
    console.error("GET /api/reports/templates error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
