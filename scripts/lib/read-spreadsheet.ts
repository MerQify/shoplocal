import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import * as XLSX from "@e965/xlsx";
import * as fflate from "fflate";

/**
 * #1216 R7, R8 — the ONE file that imports the spreadsheet package. Everything the importer does
 * with the result lives in `lib/catalogue-import/` (pure) so the dependency stays out of the Worker
 * bundle: `tests/catalogue-import-guards.test.ts` fails if anything outside `scripts/` imports it.
 *
 * `.csv`, `.xlsx` and `.xls` (legacy BIFF) are read through the same package, so the three formats
 * reach the planner as the same shape: a grid of strings. Cells are returned as the text a person
 * sees (`raw: false`), except in CSV where the text IS the value (`raw: true`) — nothing is parsed
 * into a number or a date on the way in, because a price cell "£4.10" and a PLU "00123" must reach
 * the planner exactly as written.
 */

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;

export interface SourceGrid {
  grid: string[][];
  /** 1-based row number of `grid[0]` in the original sheet (the sheet's range may not start at row 1). */
  firstRowNumber: number;
  sheetName: string;
}

export class UnsupportedFileError extends Error {}

export function readSourceGrid(path: string): SourceGrid {
  const extension = extname(path).toLowerCase();
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new UnsupportedFileError(
      `unsupported file type "${extension || "(none)"}"; accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`,
    );
  }

  let workbook: XLSX.WorkBook;
  if (extension === ".csv") {
    // Strip a UTF-8 byte-order mark; SheetJS would otherwise keep it inside the first header cell.
    const text = readFileSync(path, "utf8").replace(/^﻿/, "");
    workbook = XLSX.read(text, { type: "string", raw: true });
  } else {
    workbook = XLSX.read(readFileSync(path), { type: "buffer" });
  }

  const sheetName = workbook.SheetNames[0];
  if (sheetName === undefined) throw new Error("the file contains no sheet");
  const sheet = workbook.Sheets[sheetName];

  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });

  return {
    grid: grid.map((row) => row.map((cell) => String(cell ?? ""))),
    firstRowNumber: range ? range.s.r + 1 : 1,
    sheetName,
  };
}

/** Every sheet of a workbook as grids of strings (the review sheet carries two). */
export function readWorkbookSheets(path: string): Map<string, string[][]> {
  const workbook = XLSX.read(readFileSync(path), { type: "buffer" });
  const sheets = new Map<string, string[][]>();
  for (const name of workbook.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], {
      header: 1,
      raw: false,
      defval: "",
    });
    sheets.set(
      name,
      grid.map((row) => row.map((cell) => String(cell ?? ""))),
    );
  }
  return sheets;
}

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
  "Is Active": "TRUE,FALSE",
  "Is Featured": "TRUE,FALSE",
};

/** Standard enum validation lists for Essential stock sheets */
export const ESSENTIAL_DROPDOWN_RULES: Record<string, string> = {
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

/**
 * #1570, #1646 — write a workbook of plain-text sheets with optional AutoFilters and OpenXML
 * in-cell data validations. Kept here so this stays the one file that imports the spreadsheet package.
 */
export function writeWorkbook(path: string, sheets: SheetDefinition[]): void {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.widths) ws["!cols"] = sheet.widths.map((wch) => ({ wch }));
    if (sheet.rows.length > 1) ws["!autofilter"] = { ref: ws["!ref"] as string };
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }

  const rawBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const hasValidations = sheets.some((s) => s.validations && s.validations.length > 0);
  if (!hasValidations) {
    writeFileSync(path, rawBuffer);
    return;
  }

  // Inject OpenXML <dataValidations> into worksheets using fflate
  const files = fflate.unzipSync(new Uint8Array(rawBuffer));

  sheets.forEach((sheet, idx) => {
    if (!sheet.validations || sheet.validations.length === 0) return;
    const sheetFile = `xl/worksheets/sheet${idx + 1}.xml`;
    if (!files[sheetFile]) return;

    let xml = fflate.strFromU8(files[sheetFile]);

    const dvXml = `<dataValidations count="${sheet.validations.length}">${sheet.validations
      .map(
        (v) =>
          `<dataValidation type="list" allowBlank="${
            v.allowBlank !== false ? "1" : "0"
          }" showInputMessage="1" showErrorMessage="1" sqref="${v.sqref}"><formula1>&quot;${v.formula.replace(
            /"/g,
            "",
          )}&quot;</formula1></dataValidation>`,
      )
      .join("")}</dataValidations>`;

    // Insert prior to trailing XML nodes in compliance with ECMA-376 schema order
    const insertBeforeTags = [
      "<hyperlinks",
      "<printOptions",
      "<pageMargins",
      "<pageSetup",
      "<headerFooter",
      "<rowBreaks",
      "<colBreaks",
      "<customProperties",
      "<cellWatches",
      "<ignoredErrors",
      "<smartTags",
      "<drawing",
      "<picture",
      "<oleObjects",
      "<controls",
      "<webPublishItems",
      "<tableParts",
      "<extLst",
      "</worksheet>",
    ];

    let inserted = false;
    for (const tag of insertBeforeTags) {
      const pos = xml.indexOf(tag);
      if (pos !== -1) {
        xml = xml.slice(0, pos) + dvXml + xml.slice(pos);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      xml = xml.replace("</worksheet>", dvXml + "</worksheet>");
    }

    files[sheetFile] = fflate.strToU8(xml);
  });

  const modifiedBuffer = fflate.zipSync(files);
  writeFileSync(path, Buffer.from(modifiedBuffer));
}
