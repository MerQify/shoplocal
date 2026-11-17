import { describe, expect, it } from "vitest";
import {
  sortProductsHierarchically,
  type DatabaseProductForExport,
} from "@/lib/product-templates/export";
import {
  CATEGORY_EXPORT_COLUMNS,
  categoryToExportRow,
  exportCategoriesToCsv,
  generateBlankCategoryCsv,
  type CategoryForExport,
} from "@/lib/category-templates/export";
import {
  DISCOUNT_EXPORT_COLUMNS,
  discountToExportRow,
  exportDiscountsToCsv,
  generateBlankDiscountCsv,
  type DiscountForExport,
} from "@/lib/discount-templates/export";
import {
  FILTER_EXPORT_COLUMNS,
  filterToExportRows,
  exportFiltersToCsv,
  generateBlankFilterCsv,
  type VendorAttributeForExport,
} from "@/lib/filter-templates/export";
import { UNIVERSAL_COLUMNS, UNIVERSAL_COLUMN_INSTRUCTIONS } from "@/lib/product-templates/schema";
import { parseCsvGrid } from "@/lib/product-templates/csv";

describe("Category-First Hierarchical Sorting", () => {
  it("sorts products by Department -> Category -> Product Name", () => {
    const p1: Partial<DatabaseProductForExport> = {
      id: "1",
      name: "Zucchini 500g",
      category: { name: "Vegetables", slug: "vegetables", parent: { name: "Fresh Produce" } },
    };
    const p2: Partial<DatabaseProductForExport> = {
      id: "2",
      name: "Apples Royal Gala 1kg",
      category: { name: "Fruits", slug: "fruits", parent: { name: "Fresh Produce" } },
    };
    const p3: Partial<DatabaseProductForExport> = {
      id: "3",
      name: "Basmati Rice 5kg",
      category: { name: "Rice & Grains", slug: "rice-grains", parent: { name: "Groceries" } },
    };
    const p4: Partial<DatabaseProductForExport> = {
      id: "4",
      name: "Asparagus 250g",
      category: { name: "Vegetables", slug: "vegetables", parent: { name: "Fresh Produce" } },
    };
    const p5: Partial<DatabaseProductForExport> = {
      id: "5",
      name: "Uncategorized Item",
      category: { name: "General", slug: "general", parent: null },
    };

    const sorted = sortProductsHierarchically([p1, p2, p3, p4, p5] as DatabaseProductForExport[]);

    // Expected order:
    // 1. Fresh Produce -> Fruits -> Apples Royal Gala
    // 2. Fresh Produce -> Vegetables -> Asparagus
    // 3. Fresh Produce -> Vegetables -> Zucchini
    // 4. General -> General -> Uncategorized Item
    // 5. Groceries -> Rice & Grains -> Basmati Rice
    expect(sorted.map((p) => p.name)).toEqual([
      "Apples Royal Gala 1kg",
      "Asparagus 250g",
      "Zucchini 500g",
      "Uncategorized Item",
      "Basmati Rice 5kg",
    ]);
  });
});

describe("Categories Export Templates", () => {
  it("includes non-editable notice in the category ID header", () => {
    expect(CATEGORY_EXPORT_COLUMNS[0]).toBe("Category ID [DO NOT EDIT]");
  });

  it("serializes category with parent department and product count", () => {
    const category: CategoryForExport = {
      id: "cat-101",
      name: "Rice & Grains",
      slug: "rice-grains",
      sortOrder: 2,
      isActive: true,
      allowsCustomNote: false,
      parent: { id: "dept-1", name: "Groceries", slug: "groceries" },
      _count: { products: 120 },
    };

    const row = categoryToExportRow(category);
    expect(row["Category ID [DO NOT EDIT]"]).toBe("cat-101");
    expect(row["Category Name*"]).toBe("Rice & Grains");
    expect(row["Slug*"]).toBe("rice-grains");
    expect(row["Department (Parent Category)"]).toBe("Groceries");
    expect(row["Department Slug"]).toBe("groceries");
    expect(row["Sort Order"]).toBe("2");
    expect(row["Is Active"]).toBe("TRUE");
    expect(row["Allows Custom Note"]).toBe("FALSE");
    expect(row["Total Products"]).toBe("120");
  });

  it("exports categories to RFC-4180 CSV with UTF-8 BOM", () => {
    const categories: CategoryForExport[] = [
      {
        id: "cat-1",
        name: "Butchery",
        slug: "butchery",
        sortOrder: 1,
        isActive: true,
        allowsCustomNote: true,
      },
    ];

    const csv = exportCategoriesToCsv(categories);
    expect(csv.startsWith("\uFEFF")).toBe(true);

    const grid = parseCsvGrid(csv);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual([...CATEGORY_EXPORT_COLUMNS]);
    expect(grid[1][1]).toBe("Butchery");
    expect(grid[1][7]).toBe("TRUE"); // allows custom note
  });

  it("generates blank category template headers", () => {
    const csv = generateBlankCategoryCsv();
    const grid = parseCsvGrid(csv);
    expect(grid).toHaveLength(1);
    expect(grid[0]).toEqual([...CATEGORY_EXPORT_COLUMNS]);
  });
});

describe("Discount Codes Export Templates", () => {
  it("includes non-editable notice in the discount code ID header", () => {
    expect(DISCOUNT_EXPORT_COLUMNS[0]).toBe("Discount Code ID [DO NOT EDIT]");
  });

  it("formats percentage and fixed amount discounts with correct statuses", () => {
    const pctDiscount: DiscountForExport = {
      id: "disc-pct",
      code: "WELCOME10",
      description: "10% off first order",
      kind: "PERCENTAGE",
      value: 1000, // 1000 basis points = 10%
      minSubtotalPence: 2000,
      startsAt: "2026-01-01",
      endsAt: "2029-12-31",
      remainingRedemptions: 50,
      maxPerCustomer: 1,
      isActive: true,
    };

    const row = discountToExportRow(pctDiscount);
    expect(row["Discount Code ID [DO NOT EDIT]"]).toBe("disc-pct");
    expect(row["Code*"]).toBe("WELCOME10");
    expect(row["Kind*"]).toBe("PERCENTAGE");
    expect(row["Value Display*"]).toBe("10%");
    expect(row["Raw Value*"]).toBe("1000");
    expect(row["Min Spend (£)"]).toBe("20.00");
    expect(row["Status"]).toBe("ACTIVE");

    // Expired discount
    const expiredDiscount: DiscountForExport = {
      id: "disc-exp",
      code: "SUMMER5",
      description: "Expired promo",
      kind: "FIXED_AMOUNT",
      value: 500, // £5.00
      minSubtotalPence: 0,
      startsAt: "2025-01-01",
      endsAt: "2025-08-31",
      remainingRedemptions: null,
      maxPerCustomer: null,
      isActive: true,
    };
    const expRow = discountToExportRow(expiredDiscount);
    expect(expRow["Value Display*"]).toBe("5.00");
    expect(expRow["Status"]).toBe("EXPIRED");

    // Exhausted discount
    const exhaustedDiscount: DiscountForExport = {
      id: "disc-exh",
      code: "ONELEFT",
      description: "Exhausted promo",
      kind: "FIXED_AMOUNT",
      value: 200,
      minSubtotalPence: 0,
      startsAt: "2026-01-01",
      endsAt: null,
      remainingRedemptions: 0,
      maxPerCustomer: 1,
      isActive: true,
    };
    const exhRow = discountToExportRow(exhaustedDiscount);
    expect(exhRow["Status"]).toBe("EXHAUSTED");
  });

  it("exports discounts to RFC-4180 CSV with UTF-8 BOM", () => {
    const discounts: DiscountForExport[] = [
      {
        id: "d-1",
        code: "TEST15",
        description: "15% off",
        kind: "PERCENTAGE",
        value: 1500,
        minSubtotalPence: 1000,
        startsAt: "2026-01-01",
        endsAt: null,
        remainingRedemptions: null,
        maxPerCustomer: null,
        isActive: true,
      },
    ];

    const csv = exportDiscountsToCsv(discounts);
    expect(csv.startsWith("\uFEFF")).toBe(true);

    const grid = parseCsvGrid(csv);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual([...DISCOUNT_EXPORT_COLUMNS]);
    expect(grid[1][1]).toBe("TEST15");
  });

  it("generates blank discount code template headers", () => {
    const csv = generateBlankDiscountCsv();
    const grid = parseCsvGrid(csv);
    expect(grid).toHaveLength(1);
    expect(grid[0]).toEqual([...DISCOUNT_EXPORT_COLUMNS]);
  });
});

describe("Filters & Attributes Export Templates", () => {
  it("includes non-editable notice in the attribute and option ID headers", () => {
    expect(FILTER_EXPORT_COLUMNS[0]).toBe("Attribute ID [DO NOT EDIT]");
    expect(FILTER_EXPORT_COLUMNS[6]).toBe("Option ID [DO NOT EDIT]");
  });

  it("serializes attribute and each of its options as separate rows", () => {
    const attr: VendorAttributeForExport = {
      id: "attr-diet",
      name: "Dietary & Halal",
      slug: "dietary",
      kind: "LIST",
      unit: null,
      showOnCard: true,
      sortOrder: 1,
      options: [
        { id: "opt-1", name: "HMC Certified", slug: "hmc", sortOrder: 1 },
        { id: "opt-2", name: "Vegetarian", slug: "veg", sortOrder: 2 },
      ],
    };

    const rows = filterToExportRows(attr);
    expect(rows).toHaveLength(2);
    expect(rows[0]["Attribute ID [DO NOT EDIT]"]).toBe("attr-diet");
    expect(rows[0]["Attribute Name*"]).toBe("Dietary & Halal");
    expect(rows[0]["Option ID [DO NOT EDIT]"]).toBe("opt-1");
    expect(rows[0]["Option Name"]).toBe("HMC Certified");

    expect(rows[1]["Option ID [DO NOT EDIT]"]).toBe("opt-2");
    expect(rows[1]["Option Name"]).toBe("Vegetarian");
  });

  it("exports filters to RFC-4180 CSV with UTF-8 BOM", () => {
    const attrs: VendorAttributeForExport[] = [
      {
        id: "attr-meat",
        name: "Meat Cut",
        slug: "meat-cut",
        kind: "LIST",
        unit: null,
        showOnCard: false,
        sortOrder: 2,
        options: [{ id: "opt-m1", name: "Boneless", slug: "boneless", sortOrder: 1 }],
      },
    ];

    const csv = exportFiltersToCsv(attrs);
    expect(csv.startsWith("\uFEFF")).toBe(true);

    const grid = parseCsvGrid(csv);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual([...FILTER_EXPORT_COLUMNS]);
    expect(grid[1][1]).toBe("Meat Cut");
    expect(grid[1][7]).toBe("Boneless");
  });

  it("generates blank filter template headers", () => {
    const csv = generateBlankFilterCsv();
    const grid = parseCsvGrid(csv);
    expect(grid).toHaveLength(1);
    expect(grid[0]).toEqual([...FILTER_EXPORT_COLUMNS]);
  });
});

describe("Universal Column Instructions Completeness", () => {
  it("provides detailed instruction metadata for every universal column", () => {
    for (const col of UNIVERSAL_COLUMNS) {
      const info = UNIVERSAL_COLUMN_INSTRUCTIONS[col];
      expect(info, `Missing instruction for column: ${col}`).toBeDefined();
      expect(info.description.length).toBeGreaterThan(5);
      expect(info.example.length).toBeGreaterThan(0);
    }
  });
});
