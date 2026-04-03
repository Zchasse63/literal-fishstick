import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateReport, type SavedReportConfig } from "@/lib/reports/engine";

const STUDIO_ID = "11111111-1111-1111-1111-111111111111";
const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * POST /api/reports/[id]/generate
 *
 * Generate report data from a saved report config. Returns JSON result
 * with rows, total_count, and summary.
 *
 * Optional body overrides: { time_range?, filters?, sort_by?, sort_direction?, limit?, offset? }
 */
export async function POST(
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

    // ─── Fetch Saved Report ────────────────────────────────────
    const { data: report, error: reportError } = await supabase
      .from("saved_reports")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // ─── Parse optional overrides from body ────────────────────
    let overrides: Partial<SavedReportConfig> = {};
    try {
      const body = await request.json();
      overrides = body ?? {};
    } catch {
      // No body or invalid JSON — use report defaults
    }

    // ─── Build config ──────────────────────────────────────────
    const config: SavedReportConfig = {
      report_type: report.report_type,
      columns: report.columns ?? [],
      filters: overrides.filters ?? report.filters ?? [],
      time_range: overrides.time_range ?? report.time_range ?? undefined,
      group_by: report.group_by ?? undefined,
      sort_by: overrides.sort_by ?? report.sort_by ?? undefined,
      sort_direction: overrides.sort_direction ?? report.sort_direction ?? "desc",
      limit: overrides.limit ?? 1000,
      offset: overrides.offset ?? 0,
    };

    // ─── Generate ──────────────────────────────────────────────
    const result = await generateReport(supabase, studioId, config);

    // Update last_run_at on the saved report
    await supabase
      .from("saved_reports")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      data: result.rows,
      total_count: result.total_count,
      summary: result.summary,
    });
  } catch (err) {
    console.error("POST /api/reports/[id]/generate error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
