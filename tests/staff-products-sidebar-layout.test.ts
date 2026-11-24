import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Staff products sidebar filter layout and sticky action bar", () => {
  const pageSource = read("app/(admin)/staff/products/page.tsx");
  const layoutSource = read("components/staff/ProductCatalogLayout.tsx");
  const barSource = read("components/staff/StickyBulkActionBar.tsx");

  it("selectClass includes w-full and truncate for uniform sizing and clean truncation", () => {
    expect(pageSource).toContain(
      'const selectClass =\n  "w-full truncate rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary";',
    );
  });

  it("renders ProductCatalogLayout with collapsible sidebar and responsive main table", () => {
    expect(pageSource).toContain("<ProductCatalogLayout");
    expect(pageSource).toContain("activeFilterCount={activeFilterCount}");
    expect(pageSource).toContain("<FilterToggleBtn />");
    expect(layoutSource).toContain("<aside");
    expect(layoutSource).toContain("<main");
    expect(layoutSource).toContain("staff_products_filters_collapsed");
    expect(layoutSource).toContain("panel-left-close");
    expect(layoutSource).toContain("panel-left-open");
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

  it("displays compact Age Restricted badge under product name instead of bulky status column banner", () => {
    // Product column contains Age Restricted pill with tooltip
    expect(pageSource).toContain('product.restriction === "AGE_RESTRICTED"');
    expect(pageSource).toContain("Age Restricted");
    expect(pageSource).toContain('title="Cannot currently be sold online due to age restrictions"');
    // Status column excludes AGE_RESTRICTED to keep rows uncluttered
    expect(pageSource).toContain('product.restriction !== "AGE_RESTRICTED"');
  });

  it("mounts the SelectAllHeaderCheckbox and StickyBulkActionBar", () => {
    expect(pageSource).toContain("<SelectAllHeaderCheckbox />");
    expect(pageSource).toContain("<StickyBulkActionBar");
    expect(pageSource).toContain("categories={categories}");
    expect(pageSource).toContain("lowStockDefault={lowStockDefault}");
    expect(pageSource).toContain("isStoreAdmin={isStoreAdmin}");
  });

  it("StickyBulkActionBar applies low-stock alert threshold to selected products", () => {
    expect(barSource).toContain("Low-stock alert:");
    expect(barSource).toContain('name="lowStockThreshold"');
    expect(barSource).toContain("Apply to selected");
    expect(barSource).toContain("bulkSetLowStockThresholdAction");
  });

  it("Product drilldown edit page includes back navigation and 2-column responsive layout", () => {
    const editPageSource = read("app/(admin)/staff/products/[id]/page.tsx");
    expect(editPageSource).toContain('<PageContainer width="wide"');
    expect(editPageSource).toContain("Back to products");
    expect(editPageSource).toContain('href="/staff/products"');
    expect(editPageSource).toContain('<Icon name="arrow-left"');

    const formSource = read("components/staff/ProductForm.tsx");
    expect(formSource).toContain("grid-cols-1");
    expect(formSource).toContain("lg:grid-cols-12");
    expect(formSource).toContain("lg:col-span-8");
    expect(formSource).toContain("lg:col-span-4");
    expect(formSource).toContain('id="product-form"');
    expect(formSource).toContain('form="product-form"');
  });

  it("renders low-stock default form inside a popover for store admins for store-wide default", () => {
    expect(pageSource).toContain('const isStoreAdmin = auth.via !== "STAFF";');
    expect(pageSource).toContain("<LowStockDefaultForm current={lowStockDefault} />");
    expect(pageSource).toContain("Low-stock default: {lowStockDefault}");
  });
});
