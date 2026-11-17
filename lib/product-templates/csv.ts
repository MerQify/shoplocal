/**
 * Pure RFC-4180 compliant CSV parser and serializer.
 * Dependency-free, safe for Edge / Cloudflare Workers runtime.
 */

/** Format a single cell for CSV */
export function escapeCsvCell(cell: string | number | boolean | null | undefined): string {
  if (cell === null || cell === undefined) return "";
  const str = String(cell);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Format a row of values into a CSV line */
export function formatCsvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(escapeCsvCell).join(",");
}

/** Format headers and data rows into complete CSV text with UTF-8 BOM */
export function formatCsvTable(
  headers: readonly string[] | string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const headerLine = formatCsvRow(headers as string[]);
  const dataLines = rows.map((r) => formatCsvRow(r));
  // \uFEFF ensures Microsoft Excel on Windows renders UTF-8 characters cleanly
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

/** Pure parser for CSV string into a 2D string grid */
export function parseCsvGrid(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++; // CRLF
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== "")) rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== "")) rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) rows.push(currentRow);
  }

  return rows;
}
