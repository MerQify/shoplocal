import { describe, expect, it } from "vitest";
import {
  buildEssentialSheets,
  buildMasterSheets,
  buildStockSheets,
} from "@/lib/product-templates/workbook-sheets";
import { ESSENTIAL_COLUMNS, UNIVERSAL_COLUMNS } from "@/lib/product-templates/schema";
import type { DatabaseProductForExport } from "@/lib/product-templates/export";

/** #1714 R4 — the pure sheet builders shared by the live download route and the offline script. */

function product(overrides: Partial<DatabaseProductForExport> = {}): DatabaseProductForExport {
  return {
    id: "p1",
    slug: "basmati-5kg",
    name: "Basmati 5kg",
    description: "",
    basePrice: 1499,
    unitLabel: "5kg",
    netContentAmount: null,
    netContentUnit: null,
    originalPrice: null,
    vatRate: 0,
    isActive: true,
    isFeatured: false,
    origin: null,
    isHalal: false,
    isFresh: false,
    isOrganic: false,
    isVegetarian: false,
    isGlutenFree: false,
    isHmcCertified: false,
    hmcReference: null,
    hmcVerifiedAt: null,
    restriction: null,
    plu: null,
    barcode: null,
    category: { name: "Rice", slug: "rice", parent: { name: "Groceries" } },
    inventory: { quantity: 0, lowStockThreshold: 3, stockMode: "TRACKED" },
    ...overrides,
  };
}

const products = [product(), product({ id: "p2", name: "Archived tea", isActive: false })];

describe("workbook sheet builders (#1714)", () => {
  it("stock workbook: one Products sheet, universal header, one row per product", () => {
    const sheets = buildStockSheets(products);
    expect(sheets.map((s) => s.name)).toEqual(["Products"]);
    expect(sheets[0].rows[0]).toEqual([...UNIVERSAL_COLUMNS]);
    expect(sheets[0].rows).toHaveLength(products.length + 1);
    const isActive = UNIVERSAL_COLUMNS.indexOf("Is Active" as (typeof UNIVERSAL_COLUMNS)[number]);
    expect(sheets[0].rows.slice(1).map((r) => r[isActive])).toEqual(["TRUE", "FALSE"]);
    expect(sheets[0].validations?.length).toBeGreaterThan(0);
  });

  it("essential workbook: one Products sheet, essential header", () => {
    const sheets = buildEssentialSheets(products);
    expect(sheets.map((s) => s.name)).toEqual(["Products"]);
    expect(sheets[0].rows[0]).toEqual([...ESSENTIAL_COLUMNS]);
    expect(sheets[0].rows).toHaveLength(products.length + 1);
  });

  it("master workbook: exactly seven tabs in the fixed order", () => {
    const sheets = buildMasterSheets({
      products,
      categories: [],
      bundles: [],
      promotions: [],
      discounts: [],
      filters: [],
    });
    expect(sheets.map((s) => s.name)).toEqual([
      "Products",
      "Categories",
      "Bundles",
      "Promotions",
      "Discount Codes",
      "Filters & Attributes",
      "Field Instructions",
    ]);
    expect(sheets[0].rows[0]).toEqual([...UNIVERSAL_COLUMNS]);
    expect(sheets[6].rows).toHaveLength(UNIVERSAL_COLUMNS.length + 1);
  });
});
