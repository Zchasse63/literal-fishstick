import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const STUDIO_ID = "11111111-1111-1111-1111-111111111111";

/**
 * GET /api/reports/exports/[exportId]/download
 *
 * Redirect to a signed Supabase Storage URL for the export file.
 * The signed URL is valid for 1 hour.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { exportId } = await params;

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
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId = profile?.studio_id ?? STUDIO_ID;

    // ─── Fetch Export Record ───────────────────────────────────
    const { data: exportRecord, error: exportError } = await supabase
      .from("report_exports")
      .select("*")
      .eq("id", exportId)
      .eq("studio_id", studioId)
      .single();

    if (exportError || !exportRecord) {
      return NextResponse.json(
        { error: "Export not found" },
        { status: 404 }
      );
    }

    if (exportRecord.status !== "completed") {
      return NextResponse.json(
        {
          error: "Export is not ready",
          status: exportRecord.status,
        },
        { status: 409 }
      );
    }

    if (!exportRecord.file_path) {
      return NextResponse.json(
        { error: "Export file path missing" },
        { status: 500 }
      );
    }

    // ─── Create Signed URL ─────────────────────────────────────
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from("report-exports")
      .createSignedUrl(exportRecord.file_path, 3600);

    if (urlError || !signedUrl?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    // Redirect to the signed URL
    return NextResponse.redirect(signedUrl.signedUrl);
  } catch (err) {
    console.error("GET /api/reports/exports/[exportId]/download error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
