// ─── CSV Export ─────────────────────────────────────────────────────────────
//
// Generates a CSV string from report rows and column configuration.
// Sanitizes output to prevent formula injection in spreadsheet applications.
//

const FORMULA_INJECTION_CHARS = ["=", "+", "-", "@"];

/**
 * Sanitize a cell value to prevent CSV formula injection.
 * Prefixes dangerous characters with a single quote.
 */
function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Prefix formula-triggering characters with a single quote
  if (FORMULA_INJECTION_CHARS.some((ch) => str.startsWith(ch))) {
    return `'${str}`;
  }

  return str;
}

/**
 * Escape a value for CSV: wrap in double quotes if it contains
 * commas, double quotes, or newlines. Double quotes are escaped
 * by doubling them.
 */
function escapeCSV(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface CSVColumnConfig {
  key: string;
  label: string;
}

/**
 * Generate a CSV string from rows and column configuration.
 *
 * @param rows - Array of data rows
 * @param columns - Column configuration (key = field name, label = header)
 * @returns CSV string with BOM for Excel Unicode support
 */
export function generateCSV(
  rows: Record<string, unknown>[],
  columns: CSVColumnConfig[]
): string {
  const parts: string[] = [];

  // BOM for Unicode support in Excel
  parts.push("\uFEFF");

  // Header row
  parts.push(columns.map((col) => escapeCSV(col.label)).join(","));
  parts.push("\n");

  // Data rows
  for (const row of rows) {
    const cells = columns.map((col) => {
      const rawValue = resolveNestedValue(row, col.key);
      const sanitized = sanitizeCell(rawValue);
      return escapeCSV(sanitized);
    });
    parts.push(cells.join(","));
    parts.push("\n");
  }

  return parts.join("");
}

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
    if (current === null || current === undefined) {
      return null;
    }
    current = (current as Record<string, unknown>)[k];
  }

  return current;
}

/**
 * Stream-friendly CSV generator. Yields one row at a time as a string chunk.
 * Useful for large datasets to avoid building the entire CSV in memory.
 */
export function* generateCSVStream(
  rows: Record<string, unknown>[],
  columns: CSVColumnConfig[]
): Generator<string> {
  // BOM + header
  yield "\uFEFF" + columns.map((col) => escapeCSV(col.label)).join(",") + "\n";

  // Data rows
  for (const row of rows) {
    const cells = columns.map((col) => {
      const rawValue = resolveNestedValue(row, col.key);
      const sanitized = sanitizeCell(rawValue);
      return escapeCSV(sanitized);
    });
    yield cells.join(",") + "\n";
  }
}
