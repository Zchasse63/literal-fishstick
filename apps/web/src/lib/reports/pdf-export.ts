// ─── PDF Export ─────────────────────────────────────────────────────────────
//
// Generates a branded PDF report using @react-pdf/renderer.
// Dynamically imports the library so the module can be loaded even if the
// dependency is not installed — in that case, generatePDF throws with a
// helpful message.
//

export interface PDFColumnConfig {
  key: string;
  label: string;
  width?: number; // percentage width, defaults to equal distribution
}

export interface PDFReportOptions {
  title: string;
  dateRange?: { from: string; to: string };
  summary: Record<string, number>;
  rows: Record<string, unknown>[];
  columns: PDFColumnConfig[];
}

const MAX_PDF_ROWS = 10_000;

/**
 * Resolve a potentially nested key like "member.full_name" from a row object.
 */
function resolveNestedValue(
  obj: Record<string, unknown>,
  key: string
): unknown {
  const keys = key.split(".");
  let current: unknown = obj;
  for (const k of keys) {
    if (current === null || current === undefined) return null;
    current = (current as Record<string, unknown>)[k];
  }
  return current;
}

/**
 * Format a summary key into a human-readable label.
 * e.g. "total_revenue" → "Total Revenue"
 */
function formatSummaryLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generate a branded PDF buffer from report data.
 *
 * If @react-pdf/renderer is not installed, throws an error with install
 * instructions.
 */
export async function generatePDF(
  options: PDFReportOptions
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ReactPDF: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let React: any;

  try {
    ReactPDF = await import("@react-pdf/renderer");
    React = await import("react");
  } catch {
    throw new Error(
      "PDF export not available — install @react-pdf/renderer: npm install @react-pdf/renderer"
    );
  }

  const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF;
  const { createElement: h } = React;

  const truncated = options.rows.length > MAX_PDF_ROWS;
  const rows = truncated ? options.rows.slice(0, MAX_PDF_ROWS) : options.rows;
  const colCount = options.columns.length;
  const defaultWidth = Math.floor(100 / colCount);

  // ─── Styles ────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 9,
      fontFamily: "Helvetica",
      color: "#1a1a1f",
    },
    header: {
      marginBottom: 20,
    },
    logo: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#4F46E5",
      marginBottom: 4,
    },
    title: {
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 4,
    },
    dateRange: {
      fontSize: 9,
      color: "#6b7280",
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: "row",
      marginBottom: 16,
      gap: 16,
    },
    summaryCard: {
      backgroundColor: "#f5f5f4",
      borderRadius: 4,
      padding: 8,
      flex: 1,
    },
    summaryLabel: {
      fontSize: 7,
      color: "#6b7280",
      marginBottom: 2,
    },
    summaryValue: {
      fontSize: 12,
      fontWeight: "bold",
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: "#4F46E5",
      color: "#ffffff",
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: 2,
      marginBottom: 1,
    },
    tableHeaderCell: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 8,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
    },
    tableRowAlt: {
      backgroundColor: "#fafafa",
    },
    tableCell: {
      fontSize: 8,
    },
    truncationNotice: {
      marginTop: 12,
      fontSize: 8,
      color: "#f97316",
      fontStyle: "italic",
    },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7,
      color: "#9ca3af",
    },
  });

  // ─── Build Document ────────────────────────────────────────────────
  const summaryEntries = Object.entries(options.summary).filter(
    ([key]) => key !== "total_count"
  );

  const doc = h(Document, null,
    h(Page, { size: "A4", style: styles.page, wrap: true },
      // Header
      h(View, { style: styles.header },
        h(Text, { style: styles.logo }, "Meridian"),
        h(Text, { style: styles.title }, options.title),
        options.dateRange
          ? h(Text, { style: styles.dateRange },
              `${options.dateRange.from} — ${options.dateRange.to}`
            )
          : null,
      ),

      // Summary cards
      summaryEntries.length > 0
        ? h(View, { style: styles.summaryRow },
            ...summaryEntries.slice(0, 4).map(([key, value]) =>
              h(View, { style: styles.summaryCard, key },
                h(Text, { style: styles.summaryLabel }, formatSummaryLabel(key)),
                h(Text, { style: styles.summaryValue },
                  typeof value === "number" && key.includes("revenue") || key.includes("amount") || key.includes("payout")
                    ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : value.toLocaleString("en-US")
                ),
              )
            )
          )
        : null,

      // Table header
      h(View, { style: styles.tableHeader, fixed: true },
        ...options.columns.map((col) =>
          h(Text, {
            key: col.key,
            style: {
              ...styles.tableHeaderCell,
              width: `${col.width ?? defaultWidth}%`,
            },
          }, col.label)
        )
      ),

      // Table rows
      ...rows.map((row, idx) =>
        h(View, {
          key: `row-${idx}`,
          style: {
            ...styles.tableRow,
            ...(idx % 2 === 1 ? styles.tableRowAlt : {}),
          },
          wrap: false,
        },
          ...options.columns.map((col) => {
            const value = resolveNestedValue(row, col.key);
            const display = value === null || value === undefined ? "—" : String(value);
            return h(Text, {
              key: col.key,
              style: {
                ...styles.tableCell,
                width: `${col.width ?? defaultWidth}%`,
              },
            }, display);
          })
        )
      ),

      // Truncation notice
      truncated
        ? h(Text, { style: styles.truncationNotice },
            `Data truncated to ${MAX_PDF_ROWS.toLocaleString()} rows. Export as CSV for the full dataset.`
          )
        : null,

      // Footer
      h(View, { style: styles.footer, fixed: true },
        h(Text, null, `Generated by Meridian — ${new Date().toISOString().split("T")[0]}`),
        h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`
        }),
      ),
    )
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
