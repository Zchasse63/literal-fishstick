import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateReport, type SavedReportConfig } from "@/lib/reports/engine";
import { generateCSV, type CSVColumnConfig } from "@/lib/reports/csv-export";
import {
  generatePDF,
  type PDFColumnConfig,
} from "@/lib/reports/pdf-export";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const ALLOWED_ROLES = ["owner", "admin", "manager"];
const PDF_ASYNC_THRESHOLD = 500;
const STORAGE_BUCKET = "report-exports";

/**
 * POST /api/reports/[id]/export
 *
 * Export a saved report as CSV or PDF.
 * Body: { format: 'csv' | 'pdf' }
 *
 * For CSV: generates and returns the file directly.
 * For PDF: if > 500 rows, returns { async: true, message: "..." }.
 *          Otherwise generates the PDF, uploads to Supabase Storage,
 *          creates a report_exports row, and returns the download URL.
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

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json();
    const { format } = body as { format?: string };

    if (!format || !["csv", "pdf"].includes(format)) {
      return NextResponse.json(
        { error: 'format must be "csv" or "pdf"' },
        { status: 400 }
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

    // ─── Generate Report Data ──────────────────────────────────
    const config: SavedReportConfig = {
      report_type: report.report_type,
      columns: report.columns ?? [],
      filters: report.filters ?? [],
      time_range: report.time_range ?? undefined,
      group_by: report.group_by ?? undefined,
      sort_by: report.sort_by ?? undefined,
      sort_direction: report.sort_direction ?? "desc",
      limit: format === "csv" ? 50_000 : 10_000,
      offset: 0,
    };

    const result = await generateReport(supabase, studioId, config);

    // ─── Build column configs from report columns ──────────────
    const columns: (CSVColumnConfig & PDFColumnConfig)[] = (
      report.columns as string[]
    ).map((col: string) => ({
      key: col,
      label: col
        .replace(/\./g, " ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    }));

    // ─── CSV Export ────────────────────────────────────────────
    if (format === "csv") {
      const csvContent = generateCSV(result.rows, columns);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${report.name.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.csv`;
      const storagePath = `${studioId}/${id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, csvContent, {
          contentType: "text/csv; charset=utf-8",
          upsert: false,
        });

      if (uploadError) {
        // If bucket doesn't exist or upload fails, return the CSV directly
        console.error("Storage upload failed, returning CSV inline:", uploadError.message);
        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fileName}"`,
          },
        });
      }

      // Create signed URL (1 hour expiry)
      const { data: signedUrl } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600);

      // Create report_exports row
      const { data: exportRecord } = await supabase
        .from("report_exports")
        .insert({
          report_id: id,
          studio_id: studioId,
          format: "csv",
          status: "completed",
          file_path: storagePath,
          file_size: new TextEncoder().encode(csvContent).length,
          row_count: result.rows.length,
          created_by: user.id,
        })
        .select()
        .single();

      return NextResponse.json({
        data: {
          export_id: exportRecord?.id,
          format: "csv",
          file_name: fileName,
          download_url: signedUrl?.signedUrl ?? null,
          row_count: result.rows.length,
        },
      });
    }

    // ─── PDF Export ────────────────────────────────────────────
    if (format === "pdf") {
      // For large datasets, defer to async processing (Inngest job in future)
      if (result.total_count > PDF_ASYNC_THRESHOLD) {
        // Create a pending export record
        const { data: exportRecord } = await supabase
          .from("report_exports")
          .insert({
            report_id: id,
            studio_id: studioId,
            format: "pdf",
            status: "processing",
            row_count: result.total_count,
            created_by: user.id,
          })
          .select()
          .single();

        return NextResponse.json({
          async: true,
          export_id: exportRecord?.id,
          message:
            "Report is being generated. This PDF contains a large dataset and will be available shortly. Check the exports list for status.",
        });
      }

      // Generate PDF synchronously for small datasets
      try {
        const pdfBuffer = await generatePDF({
          title: report.name,
          dateRange: report.time_range ?? undefined,
          summary: result.summary,
          rows: result.rows,
          columns,
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `${report.name.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.pdf`;
        const storagePath = `${studioId}/${id}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, pdfBuffer, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          // If storage fails, return the PDF inline
          console.error("Storage upload failed, returning PDF inline:", uploadError.message);
          return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${fileName}"`,
            },
          });
        }

        // Create signed URL
        const { data: signedUrl } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 3600);

        // Create report_exports row
        const { data: exportRecord } = await supabase
          .from("report_exports")
          .insert({
            report_id: id,
            studio_id: studioId,
            format: "pdf",
            status: "completed",
            file_path: storagePath,
            file_size: pdfBuffer.length,
            row_count: result.rows.length,
            created_by: user.id,
          })
          .select()
          .single();

        return NextResponse.json({
          data: {
            export_id: exportRecord?.id,
            format: "pdf",
            file_name: fileName,
            download_url: signedUrl?.signedUrl ?? null,
            row_count: result.rows.length,
          },
        });
      } catch (pdfError) {
        const message =
          pdfError instanceof Error
            ? pdfError.message
            : "PDF generation failed";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/reports/[id]/export error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
