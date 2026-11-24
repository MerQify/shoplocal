import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Staff products sidebar filter layout and sticky action bar", () => {
  const pageSource = read("app/(admin)/staff/products/page.tsx");

  it("selectClass includes w-full and truncate for uniform sizing and clean truncation", () => {
    expect(pageSource).toContain(
      'const selectClass =\n  "w-full truncate rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary";',
    );
  });

  it("renders a two-column layout with sidebar and main area", () => {
    expect(pageSource).toContain('<aside className="w-full lg:w-72 shrink-0">');
    expect(pageSource).toContain('<main className="min-w-0 flex-1 space-y-4">');
  });

  it("houses all 8 filter dimensions within the sidebar form", () => {
    // Status
    expect(pageSource).toContain('name="status"');
    // Category
    expect(pageSource).toContain('name="category"');
    // Brand
    expect(pageSource).toContain('name="brand"');
    // Restriction
    expect(pageSource).toContain('name="restriction"');
    // Stock
    expect(pageSource).toContain('name="stock"');
    // Needs attention
    expect(pageSource).toContain('name="needs"');
    // Sort
    expect(pageSource).toContain('name="sort"');
    // Per page
    expect(pageSource).toContain('name="perPage"');
    // Apply filters
    expect(pageSource).toContain("Apply filters");
  });

  it("mounts the SelectAllHeaderCheckbox and StickyBulkActionBar", () => {
    expect(pageSource).toContain("<SelectAllHeaderCheckbox />");
    expect(pageSource).toContain("<StickyBulkActionBar categories={categories} />");
  });

  it("renders low-stock default form inside a popover for store admins", () => {
    expect(pageSource).toContain('const isStoreAdmin = auth.via !== "STAFF";');
    expect(pageSource).toContain("<LowStockDefaultForm current={lowStockDefault} />");
    expect(pageSource).toContain("Low-stock default: {lowStockDefault}");
  });
});
