import { describe, expect, it } from "vitest";
import {
  detectTemplateType,
  normalizeHeader,
  parseBoolean,
  parseInteger,
  parseMoneyToPence,
  formatPenceToGbp,
  UNIVERSAL_COLUMNS,
  ESSENTIAL_COLUMNS,
} from "@/lib/product-templates/schema";
import { formatCsvRow, formatCsvTable, parseCsvGrid } from "@/lib/product-templates/csv";
import {
  productToUniversalRow,
  productToEssentialRow,
  exportProductsToUniversalCsv,
  type DatabaseProductForExport,
} from "@/lib/product-templates/export";
import {
  analyzeTemplateGrid,
  type ExistingProductLookup,
} from "@/lib/product-templates/import";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("Product Templates - Header & Type Detection", () => {
  it("detects Universal Template from canonical headers", () => {
    const type = detectTemplateType([...UNIVERSAL_COLUMNS]);
    expect(type).toBe("universal");
  });

  it("detects Essential Template from canonical headers", () => {
    const type = detectTemplateType([...ESSENTIAL_COLUMNS]);
    expect(type).toBe("essential");
  });

  it("detects Essential Template even without asterisks or currency signs in headers", () => {
    const headers = [
      "Product ID",
      "Product Name",
      "Brand",
      "Category",
      "Price",
      "Unit/Pack Size",
      "Barcode",
      "PLU",
      "Stock Mode",
      "Current Stock",
      "Is Active",
    ];
    const type = detectTemplateType(headers);
    expect(type).toBe("essential");
  });

  it("returns 'unknown' for arbitrary non-template headers", () => {
    const headers = ["Random Col 1", "Col B", "Some Value"];
    expect(detectTemplateType(headers)).toBe("unknown");
  });
});

describe("Product Templates - Pure Parser & Formatter Helpers", () => {
  it("parses money strings to pence", () => {
    expect(parseMoneyToPence("14.99")).toBe(1499);
    expect(parseMoneyToPence("£14.99")).toBe(1499);
    expect(parseMoneyToPence("0.50")).toBe(50);
    expect(parseMoneyToPence("0")).toBe(0);
    expect(parseMoneyToPence("")).toBeNull();
    expect(parseMoneyToPence(null)).toBeNull();
    expect(parseMoneyToPence("invalid")).toBeNull();
    expect(parseMoneyToPence("-5.00")).toBeNull();
  });

  it("formats pence to GBP decimal string", () => {
    expect(formatPenceToGbp(1499)).toBe("14.99");
    expect(formatPenceToGbp(50)).toBe("0.50");
    expect(formatPenceToGbp(0)).toBe("0.00");
    expect(formatPenceToGbp(null)).toBe("");
  });

  it("parses boolean variations", () => {
    expect(parseBoolean("TRUE")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("FALSE")).toBe(false);
    expect(parseBoolean("no")).toBe(false);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("", true)).toBe(true);
    expect(parseBoolean(null, false)).toBe(false);
  });

  it("parses integers", () => {
    expect(parseInteger("45")).toBe(45);
    expect(parseInteger("0")).toBe(0);
    expect(parseInteger("-10")).toBe(-10);
    expect(parseInteger("abc")).toBeNull();
    expect(parseInteger("")).toBeNull();
  });
});

describe("Product Templates - Pure CSV Parser & Serializer", () => {
  it("formats and parses CSV cells with commas and quotes correctly", () => {
    const headers = ["Product Name*", "Description", "Price (£)*"];
    const rows = [
      ['Rice "Extra Long", 5kg', "Aromatic, long grain\nFluffy", "14.99"],
      ["Simple Sugar", "Pure cane", "1.20"],
    ];

    const csvText = formatCsvTable(headers, rows);
    const parsedGrid = parseCsvGrid(csvText);

    expect(parsedGrid).toHaveLength(3);
    expect(parsedGrid[0]).toEqual(["Product Name*", "Description", "Price (£)*"]);
    expect(parsedGrid[1][0]).toBe('Rice "Extra Long", 5kg');
    expect(parsedGrid[1][1]).toBe("Aromatic, long grain\nFluffy");
    expect(parsedGrid[1][2]).toBe("14.99");
    expect(parsedGrid[2][0]).toBe("Simple Sugar");
  });
});

describe("Product Templates - Zero-Decision Import & Validation Engine", () => {
  const existingProducts: ExistingProductLookup[] = [
    {
      id: "prod-uuid-1",
      name: "Daawat Basmati Rice 5kg",
      slug: "daawat-basmati-rice-5kg",
      barcode: "5012345678901",
      plu: "1001",
      basePrice: 1499,
      unitLabel: "5kg",
      isActive: true,
    },
    {
      id: "prod-uuid-2",
      name: "Fresh Halal Chicken Curry Cut 1kg",
      slug: "fresh-halal-chicken-curry-cut-1kg",
      barcode: null,
      plu: "2045",
      basePrice: 499,
      unitLabel: "1kg",
      isActive: true,
    },
  ];

  it("validates and creates new product without decision when valid", () => {
    const grid = [
      [...ESSENTIAL_COLUMNS],
      [
        "", // Product ID
        "Laila Basmati Rice 10kg", // Product Name*
        "Laila", // Brand*
        "Rice & Grains", // Category*
        "22.50", // Price (£)*
        "10kg", // Unit/Pack Size*
        "5012345678999", // Barcode
        "1002", // PLU
        "TRACKED", // Stock Mode*
        "30", // Current Stock
        "TRUE", // Is Active
      ],
    ];

    const result = analyzeTemplateGrid(grid, existingProducts);

    expect(result.templateType).toBe("essential");
    expect(result.validRowsCount).toBe(1);
    expect(result.invalidRowsCount).toBe(0);
    expect(result.createCount).toBe(1);
    expect(result.updateCount).toBe(0);

    const line = result.plannedLines[0];
    expect(line.action).toBe("CREATE");
    expect(line.autoReady).toBe(true);
    expect(line.row.name).toBe("Laila Basmati Rice 10kg");
    expect(line.row.brand).toBe("Laila");
    expect(line.row.pricePence).toBe(2250);
  });

  it("matches and updates existing product by Product ID automatically", () => {
    const grid = [
      [...ESSENTIAL_COLUMNS],
      [
        "prod-uuid-1",
        "Daawat Basmati Rice 5kg",
        "Daawat",
        "Rice & Grains",
        "15.99", // Price updated from 14.99
        "5kg",
        "5012345678901",
        "1001",
        "TRACKED",
        "50",
        "TRUE",
      ],
    ];

    const result = analyzeTemplateGrid(grid, existingProducts);

    expect(result.updateCount).toBe(1);
    const line = result.plannedLines[0];
    expect(line.action).toBe("UPDATE");
    expect(line.autoReady).toBe(true);
    expect(line.matchedProductId).toBe("prod-uuid-1");
    expect(line.reason).toBe("Matched by Product ID");
    expect(line.changes).toEqual([
      { field: "basePrice", oldValue: 1499, newValue: 1599 },
    ]);
  });

  it("matches and updates existing product by Barcode when ID is empty", () => {
    const grid = [
      [...ESSENTIAL_COLUMNS],
      [
        "", // Blank ID
        "Daawat Basmati Rice 5kg (Barcoded)",
        "Daawat",
        "Rice & Grains",
        "14.99",
        "5kg",
        "5012345678901", // Barcode matches prod-uuid-1
        "",
        "TRACKED",
        "40",
        "TRUE",
      ],
    ];

    const result = analyzeTemplateGrid(grid, existingProducts);

    expect(result.updateCount).toBe(1);
    const line = result.plannedLines[0];
    expect(line.action).toBe("UPDATE");
    expect(line.matchedProductId).toBe("prod-uuid-1");
    expect(line.reason).toContain("Matched by Barcode");
  });

  it("matches and updates existing product by PLU when ID and Barcode are empty", () => {
    const grid = [
      [...ESSENTIAL_COLUMNS],
      [
        "", // Blank ID
        "Halal Baby Chicken Curry Cut",
        "Aheed",
        "Chicken & Poultry",
        "5.49", // Price update
        "1kg",
        "",
        "2045", // PLU matches prod-uuid-2
        "UNTRACKED",
        "",
        "TRUE",
      ],
    ];

    const result = analyzeTemplateGrid(grid, existingProducts);

    expect(result.updateCount).toBe(1);
    const line = result.plannedLines[0];
    expect(line.action).toBe("UPDATE");
    expect(line.matchedProductId).toBe("prod-uuid-2");
    expect(line.reason).toContain("Matched by PLU");
  });

  it("flags missing mandatory fields (Name, Brand, Category, Price) with exact row errors", () => {
    const grid = [
      [...ESSENTIAL_COLUMNS],
      [
        "",
        "", // Missing name!
        "", // Missing brand!
        "Rice & Grains",
        "abc", // Invalid price!
        "", // Missing size!
        "",
        "",
        "INVALID_MODE", // Invalid stock mode!
        "",
        "TRUE",
      ],
    ];

    const result = analyzeTemplateGrid(grid, existingProducts);

    expect(result.validRowsCount).toBe(0);
    expect(result.invalidRowsCount).toBe(1);

    const line = result.plannedLines[0];
    expect(line.action).toBe("INVALID");
    expect(line.autoReady).toBe(false);

    const fieldsWithErrors = line.validationErrors.map((e) => e.field);
    expect(fieldsWithErrors).toContain("Product Name*");
    expect(fieldsWithErrors).toContain("Brand*");
    expect(fieldsWithErrors).toContain("Price (£)*");
    expect(fieldsWithErrors).toContain("Unit/Pack Size*");
    expect(fieldsWithErrors).toContain("Stock Mode*");
  });
});

describe("Product Templates - Architectural Guardrails", () => {
  it("ensures lib/product-templates does NOT import @e965/xlsx (Worker bundle safety)", () => {
    const dir = join(process.cwd(), "lib", "product-templates");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const content = readFileSync(join(dir, f), "utf8");
      expect(content).not.toContain("@e965/xlsx");
    }
  });
});
