import {
  buildColumnValidations,
  ESSENTIAL_DROPDOWN_RULES,
  UNIVERSAL_DROPDOWN_RULES,
  type SheetDefinition,
} from "../spreadsheet/workbook";
import { ESSENTIAL_COLUMNS, UNIVERSAL_COLUMNS, UNIVERSAL_COLUMN_INSTRUCTIONS } from "./schema";
import {
  productToEssentialRow,
  productToUniversalRow,
  type DatabaseProductForExport,
} from "./export";
import {
  BUNDLE_EXPORT_COLUMNS,
  bundleToExportRow,
  type BundleForExport,
} from "../bundle-templates/export";
import {
  PROMOTION_EXPORT_COLUMNS,
  promotionToExportRow,
  type PromotionForExport,
} from "../promotion-templates/export";
import {
  CATEGORY_EXPORT_COLUMNS,
  categoryToExportRow,
  type CategoryForExport,
} from "../category-templates/export";
import {
  DISCOUNT_EXPORT_COLUMNS,
  discountToExportRow,
  type DiscountForExport,
} from "../discount-templates/export";
import {
  FILTER_EXPORT_COLUMNS,
  filterToExportRows,
  type VendorAttributeForExport,
} from "../filter-templates/export";

/**
 * #1714 — the sheets of the Stock, Essential and Master workbooks, built from records the caller
 * already fetched. Pure (no database), so the live download route and
 * `scripts/product-templates/export-all-stock.ts` produce the same tabs, columns and dropdowns.
 */

function grid<C extends string>(
  columns: readonly C[],
  rows: Record<C, string>[] | Record<string, string>[],
): (string | number)[][] {
  return [
    [...columns],
    ...rows.map((row) => columns.map((col) => (row as Record<string, string>)[col] || "")),
  ];
}

function universalWidths(): number[] {
  return UNIVERSAL_COLUMNS.map((col) => {
    if (col === "Product Name*") return 38;
    if (col === "Description / Notes") return 45;
    if (col.startsWith("Product ID")) return 38;
    return Math.max(col.length + 3, 14);
  });
}

function productsSheet(products: DatabaseProductForExport[]): SheetDefinition {
  return {
    name: "Products",
    rows: grid(
      UNIVERSAL_COLUMNS,
      products.map((p) => productToUniversalRow(p)),
    ),
    widths: universalWidths(),
    validations: buildColumnValidations(
      UNIVERSAL_COLUMNS,
      UNIVERSAL_DROPDOWN_RULES,
      products.length + 50,
    ),
  };
}

/** Universal stock workbook: one `Products` sheet. */
export function buildStockSheets(products: DatabaseProductForExport[]): SheetDefinition[] {
  return [productsSheet(products)];
}

/** Essential stock workbook: one `Products` sheet with the essential columns. */
export function buildEssentialSheets(products: DatabaseProductForExport[]): SheetDefinition[] {
  return [
    {
      name: "Products",
      rows: grid(
        ESSENTIAL_COLUMNS,
        products.map((p) => productToEssentialRow(p)),
      ),
      widths: ESSENTIAL_COLUMNS.map((col) => {
        if (col === "Product Name*") return 38;
        if (col.startsWith("Product ID")) return 38;
        return Math.max(col.length + 3, 14);
      }),
      validations: buildColumnValidations(
        ESSENTIAL_COLUMNS,
        ESSENTIAL_DROPDOWN_RULES,
        products.length + 50,
      ),
    },
  ];
}

export interface MasterWorkbookRecords {
  products: DatabaseProductForExport[];
  categories: CategoryForExport[];
  bundles: BundleForExport[];
  promotions: PromotionForExport[];
  discounts: DiscountForExport[];
  filters: VendorAttributeForExport[];
}

const standardWidths = (columns: readonly string[]) =>
  columns.map((col) => Math.max(col.length + 4, 16));

/**
 * Master operational workbook — seven tabs, in this order: Products, Categories, Bundles,
 * Promotions, Discount Codes, Filters & Attributes, Field Instructions.
 */
export function buildMasterSheets(records: MasterWorkbookRecords): SheetDefinition[] {
  const instructionsRows = UNIVERSAL_COLUMNS.map((col) => {
    const info = UNIVERSAL_COLUMN_INSTRUCTIONS[col];
    return [
      col,
      info?.required ? "REQUIRED" : "Optional",
      col.includes("[DO NOT EDIT]")
        ? "DO NOT EDIT (Leave unchanged for sync; leave blank for new)"
        : "Yes",
      info?.description || "",
      info?.example || "",
    ];
  });

  return [
    productsSheet(records.products),
    {
      name: "Categories",
      rows: grid(
        CATEGORY_EXPORT_COLUMNS,
        records.categories.map((c) => categoryToExportRow(c)),
      ),
      widths: standardWidths(CATEGORY_EXPORT_COLUMNS),
    },
    {
      name: "Bundles",
      rows: grid(
        BUNDLE_EXPORT_COLUMNS,
        records.bundles.map((b) => bundleToExportRow(b)),
      ),
      widths: BUNDLE_EXPORT_COLUMNS.map((col) =>
        col.includes("Summary") || col.includes("Specification")
          ? 45
          : Math.max(col.length + 4, 16),
      ),
    },
    {
      name: "Promotions",
      rows: grid(
        PROMOTION_EXPORT_COLUMNS,
        records.promotions.map((p) => promotionToExportRow(p)),
      ),
      widths: standardWidths(PROMOTION_EXPORT_COLUMNS),
    },
    {
      name: "Discount Codes",
      rows: grid(
        DISCOUNT_EXPORT_COLUMNS,
        records.discounts.map((d) => discountToExportRow(d)),
      ),
      widths: standardWidths(DISCOUNT_EXPORT_COLUMNS),
    },
    {
      name: "Filters & Attributes",
      rows: grid(
        FILTER_EXPORT_COLUMNS,
        records.filters.flatMap((attr) => filterToExportRows(attr)),
      ),
      widths: standardWidths(FILTER_EXPORT_COLUMNS),
    },
    {
      name: "Field Instructions",
      rows: [
        [
          "Column Name",
          "Required / Optional",
          "Editable?",
          "Description & Constraints",
          "Example Values",
        ],
        ...instructionsRows,
      ],
      widths: [32, 20, 36, 60, 35],
    },
  ];
}
