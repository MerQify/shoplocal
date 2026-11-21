import { strToU8, zipSync } from "fflate";

/**
 * #1714 — build an `.xlsx` workbook in memory, for the Worker and for scripts alike.
 *
 * Written straight to OpenXML on `fflate` rather than through `@e965/xlsx`: #1216 keeps the
 * spreadsheet package out of the Worker bundle (`tests/catalogue-import-guards.test.ts`), and these
 * sheets only need four features — inline-string/number cells, column widths, an AutoFilter on the
 * header row, and in-cell list validations. `scripts/lib/read-spreadsheet.ts`'s `writeWorkbook` is a
 * thin file-writing wrapper over `buildWorkbook`, so the offline export and the live download emit
 * the same bytes for the same sheets.
 *
 * No `node:` import and no Node byte-buffer type: this runs on a V8 isolate.
 */

export interface SheetDataValidation {
  /** Target range, e.g. "I2:I5000" */
  sqref: string;
  /** Comma-separated enum list, e.g. "0%,5%,20%" */
  formula: string;
  allowBlank?: boolean;
}

export interface SheetDefinition {
  name: string;
  rows: (string | number)[][];
  widths?: number[];
  validations?: SheetDataValidation[];
}

/** Standard enum validation lists for Universal stock sheets */
export const UNIVERSAL_DROPDOWN_RULES: Record<string, string> = {
  "VAT Rate": "0%,5%,20%",
  "Stock Mode*": "TRACKED,UNTRACKED,INFINITE,UNKNOWN",
  "Net Content Unit": "GRAM,KILOGRAM,MILLILITRE,LITRE,EACH",
  "Is Halal": "TRUE,FALSE",
  "Is Vegetarian": "TRUE,FALSE",
  "Is Fresh": "TRUE,FALSE",
  "Is Organic": "TRUE,FALSE",
  "Is Gluten Free": "TRUE,FALSE",
  "Is HMC Certified": "TRUE,FALSE",
  "Attr: Storage": "Ambient,Chilled,Frozen",
  "Image Available": "TRUE,FALSE",
  "Is Active": "TRUE,FALSE",
  "Is Featured": "TRUE,FALSE",
};

/** Standard enum validation lists for Essential stock sheets */
export const ESSENTIAL_DROPDOWN_RULES: Record<string, string> = {
  "Image Available": "TRUE,FALSE",
  "Stock Mode*": "TRACKED,UNTRACKED,INFINITE,UNKNOWN",
  "Is Active": "TRUE,FALSE",
};

/**
 * Convert zero-based column index to Excel column letter (0 -> A, 27 -> AB).
 */
export function columnIndexToLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Build column data validations matching header names against rules.
 */
export function buildColumnValidations(
  headers: readonly string[],
  validationRules: Record<string, string>,
  maxRows: number = 5000,
): SheetDataValidation[] {
  const validations: SheetDataValidation[] = [];
  headers.forEach((header, index) => {
    const formula = validationRules[header];
    if (formula) {
      const colLetter = columnIndexToLetter(index);
      validations.push({
        sqref: `${colLetter}2:${colLetter}${maxRows}`,
        formula,
        allowBlank: true,
      });
    }
  });
  return validations;
}

// XML 1.0 forbids C0 controls other than tab, LF and CR; a stray one makes Excel refuse the file.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellXml(ref: string, value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const text = String(value ?? "");
  if (text === "") return "";
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetRange(sheet: SheetDefinition): string {
  const columnCount = Math.max(1, ...sheet.rows.map((row) => row.length));
  const rowCount = Math.max(1, sheet.rows.length);
  return `A1:${columnIndexToLetter(columnCount - 1)}${rowCount}`;
}

function worksheetXml(sheet: SheetDefinition): string {
  const range = sheetRange(sheet);
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    `<dimension ref="${range}"/>`,
  ];
  // Element order below follows CT_Worksheet (ECMA-376): cols, sheetData, autoFilter, dataValidations.
  if (sheet.widths && sheet.widths.length > 0) {
    parts.push(
      `<cols>${sheet.widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("")}</cols>`,
    );
  }
  parts.push("<sheetData>");
  sheet.rows.forEach((row, r) => {
    const cells = row
      .map((value, c) => cellXml(`${columnIndexToLetter(c)}${r + 1}`, value))
      .join("");
    parts.push(`<row r="${r + 1}">${cells}</row>`);
  });
  parts.push("</sheetData>");
  if (sheet.rows.length > 1) parts.push(`<autoFilter ref="${range}"/>`);
  if (sheet.validations && sheet.validations.length > 0) {
    parts.push(
      `<dataValidations count="${sheet.validations.length}">${sheet.validations
        .map(
          (v) =>
            `<dataValidation type="list" allowBlank="${v.allowBlank !== false ? "1" : "0"}" showInputMessage="1" showErrorMessage="1" sqref="${v.sqref}"><formula1>&quot;${escapeXml(v.formula.replace(/"/g, ""))}&quot;</formula1></dataValidation>`,
        )
        .join("")}</dataValidations>`,
    );
  }
  parts.push("</worksheet>");
  return parts.join("");
}

/** Excel's rules for a sheet name: max 31 chars, none of `[]:*?/\`. */
function safeSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet";
}

/**
 * Build a workbook of plain-text sheets with optional column widths, a header-row AutoFilter on
 * every sheet with data, and OpenXML in-cell list validations.
 */
export function buildWorkbook(sheets: SheetDefinition[]): Uint8Array<ArrayBuffer> {
  if (sheets.length === 0) throw new Error("buildWorkbook needs at least one sheet");
  const names = sheets.map((s) => safeSheetName(s.name));

  const sheetEntries = names
    .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  const definedNames = sheets
    .map((sheet, i) => {
      if (sheet.rows.length <= 1) return "";
      const [start, end] = sheetRange(sheet).split(":");
      const abs = (ref: string) => ref.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");
      const quoted = `'${names[i].replace(/'/g, "''")}'`;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${escapeXml(`${quoted}!${abs(start)}:${abs(end)}`)}</definedName>`;
    })
    .join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ""}</workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join(
          "",
        )}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(worksheetXml(sheet));
  });

  // zipSync allocates a fresh ArrayBuffer; the narrower type lets it be a Response body.
  return zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>;
}
