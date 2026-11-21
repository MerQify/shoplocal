import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "@e965/xlsx";
import { buildWorkbook, columnIndexToLetter } from "@/lib/spreadsheet/workbook";

/** #1714 R2 — the in-memory workbook builder the live xlsx download runs on the Worker. */

const sheets = [
  {
    name: "Products",
    rows: [
      ["Name", "Is Active", "Price"],
      ["Rice & <Grains>", "TRUE", 4.5],
      ['Tea "loose"', "FALSE", ""],
    ],
    widths: [30, 12, 10],
    validations: [{ sqref: "B2:B50", formula: "TRUE,FALSE", allowBlank: true }],
  },
  { name: "Filters & Attributes", rows: [["Attribute"], ["Brand"]] },
];

describe("buildWorkbook (#1714)", () => {
  const bytes = buildWorkbook(sheets);
  const files = unzipSync(bytes);
  const xml = (name: string) => strFromU8(files[name]);

  it("is a ZIP container", () => {
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });

  it("names both sheets in input order", () => {
    const workbook = xml("xl/workbook.xml");
    const names = [...workbook.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(["Products", "Filters &amp; Attributes"]);
  });

  it("puts an AutoFilter on every sheet with more than one row", () => {
    expect(xml("xl/worksheets/sheet1.xml")).toContain('<autoFilter ref="A1:C3"/>');
    expect(xml("xl/worksheets/sheet2.xml")).toContain('<autoFilter ref="A1:A2"/>');
  });

  it("carries the list validation on the validated sheet only", () => {
    expect(xml("xl/worksheets/sheet1.xml")).toMatch(
      /<dataValidation type="list"[^>]*sqref="B2:B50"><formula1>&quot;TRUE,FALSE&quot;<\/formula1>/,
    );
    expect(xml("xl/worksheets/sheet2.xml")).not.toContain("dataValidation");
  });

  it("round-trips through a real spreadsheet reader with values intact", () => {
    const wb = XLSX.read(bytes, { type: "array" });
    expect(wb.SheetNames).toEqual(["Products", "Filters & Attributes"]);
    const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Products, {
      header: 1,
      raw: false,
      defval: "",
    });
    expect(grid).toEqual([
      ["Name", "Is Active", "Price"],
      ["Rice & <Grains>", "TRUE", "4.5"],
      ['Tea "loose"', "FALSE", ""],
    ]);
  });

  it("drops XML-illegal control characters instead of emitting a file Excel refuses", () => {
    const out = unzipSync(buildWorkbook([{ name: "S", rows: [["a\u0001b"]] }]));
    expect(strFromU8(out["xl/worksheets/sheet1.xml"])).toContain(">ab<");
  });

  it("maps column indexes to letters", () => {
    expect([0, 25, 26, 61].map(columnIndexToLetter)).toEqual(["A", "Z", "AA", "BJ"]);
  });
});
