import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  writeWorkbook,
  buildColumnValidations,
  UNIVERSAL_DROPDOWN_RULES,
  ESSENTIAL_DROPDOWN_RULES,
} from "../lib/read-spreadsheet";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  UNIVERSAL_COLUMNS,
  ESSENTIAL_COLUMNS,
  UNIVERSAL_COLUMN_INSTRUCTIONS,
} from "../../lib/product-templates/schema";
import {
  productToUniversalRow,
  productToEssentialRow,
  sortProductsHierarchically,
  type DatabaseProductForExport,
} from "../../lib/product-templates/export";
import {
  BUNDLE_EXPORT_COLUMNS,
  bundleToExportRow,
  type BundleForExport,
} from "../../lib/bundle-templates/export";
import {
  PROMOTION_EXPORT_COLUMNS,
  promotionToExportRow,
  type PromotionForExport,
} from "../../lib/promotion-templates/export";
import {
  CATEGORY_EXPORT_COLUMNS,
  categoryToExportRow,
  type CategoryForExport,
} from "../../lib/category-templates/export";
import {
  DISCOUNT_EXPORT_COLUMNS,
  discountToExportRow,
  type DiscountForExport,
} from "../../lib/discount-templates/export";
import {
  FILTER_EXPORT_COLUMNS,
  filterToExportRows,
  type VendorAttributeForExport,
} from "../../lib/filter-templates/export";
import { formatCsvTable } from "../../lib/product-templates/csv";

function getAfcDbUrl(targetEnv: "staging" | "production" = "production"): string {
  const varsFile =
    targetEnv === "staging" ? "secrets/afc-staging.vars" : "secrets/afc-production.vars";
  const content = readFileSync(varsFile, "utf8");
  const match = content.match(/AFC_DIRECT_URL=([^\r\n]+)/);
  if (!match) throw new Error(`Could not find AFC_DIRECT_URL in ${varsFile}`);
  return match[1].trim();
}

async function main() {
  const targetEnv = process.argv.includes("--staging") ? "staging" : "production";
  console.log(`Connecting to AFC ${targetEnv} database...`);

  const connectionString = getAfcDbUrl(targetEnv);
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const vendor = await prisma.vendor.findFirst({
      where: { slug: "aheed-food-centre" },
    });

    if (!vendor) {
      throw new Error("Vendor 'aheed-food-centre' not found in database.");
    }

    console.log(
      `Querying complete operational dataset for vendor "${vendor.name}" (${vendor.id})...`,
    );

    // 1. Fetch Products
    const rawProducts = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: {
        brand: { select: { name: true } },
        category: {
          select: {
            name: true,
            slug: true,
            parent: { select: { name: true } },
          },
        },
        inventory: {
          select: {
            quantity: true,
            lowStockThreshold: true,
            stockMode: true,
          },
        },
        priceTier: {
          select: {
            groupQuantity: true,
            groupPricePence: true,
            isActive: true,
          },
        },
        attributeValues: {
          select: {
            attribute: { select: { name: true, slug: true } },
            option: { select: { name: true, slug: true } },
            numericValue: true,
          },
        },
        images: {
          select: {
            storageKey: true,
          },
        },
      },
    });

    // Hierarchical sort: Department -> Category -> Product Name
    const products = sortProductsHierarchically(
      rawProducts as unknown as DatabaseProductForExport[],
    );
    console.log(`✓ Retrieved & hierarchically sorted ${products.length} products.`);

    // 2. Fetch Categories
    const categories = await prisma.category.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        isActive: true,
        allowsCustomNote: true,
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    console.log(`✓ Retrieved ${categories.length} categories.`);

    // 3. Fetch Bundles
    const bundles = await prisma.bundle.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        isActive: true,
        sortOrder: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            sortOrder: true,
            product: { select: { name: true, unitLabel: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    console.log(`✓ Retrieved ${bundles.length} bundles.`);

    // 4. Fetch Promotions
    const promotions = await prisma.promotion.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        headline: true,
        subtitle: true,
        badgeText: true,
        callToActionText: true,
        linkUrl: true,
        priority: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
        channel: true,
        categoryId: true,
        bundleId: true,
        discountCodeId: true,
        productId: true,
        category: { select: { name: true } },
        bundle: { select: { name: true } },
        product: { select: { name: true } },
        discountCode: { select: { code: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });
    console.log(`✓ Retrieved ${promotions.length} promotions.`);

    // 5. Fetch Discounts
    const discounts = await prisma.discountCode.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        code: true,
        description: true,
        kind: true,
        value: true,
        minSubtotalPence: true,
        startsAt: true,
        endsAt: true,
        remainingRedemptions: true,
        maxPerCustomer: true,
        isActive: true,
      },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
    console.log(`✓ Retrieved ${discounts.length} discount codes.`);

    // 6. Fetch Filters & Attributes
    const filters = await prisma.vendorAttribute.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        unit: true,
        showOnCard: true,
        sortOrder: true,
        options: {
          select: {
            id: true,
            name: true,
            slug: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    console.log(`✓ Retrieved ${filters.length} attributes/filters.`);

    // --- Build Sheet Data ---

    // Tab 1: Products
    const productRows = products.map((p) => productToUniversalRow(p));
    const productSheetData: (string | number)[][] = [
      [...UNIVERSAL_COLUMNS],
      ...productRows.map((row) => UNIVERSAL_COLUMNS.map((col) => row[col] || "")),
    ];
    const universalColWidths = UNIVERSAL_COLUMNS.map((col) => {
      if (col === "Product Name*") return 38;
      if (col === "Description / Notes") return 45;
      if (col.startsWith("Product ID")) return 38;
      return Math.max(col.length + 3, 14);
    });

    // Tab 2: Categories
    const categoryRows = (categories as unknown as CategoryForExport[]).map((c) =>
      categoryToExportRow(c),
    );
    const categorySheetData: (string | number)[][] = [
      [...CATEGORY_EXPORT_COLUMNS],
      ...categoryRows.map((row) => CATEGORY_EXPORT_COLUMNS.map((col) => row[col] || "")),
    ];
    const categoryColWidths = CATEGORY_EXPORT_COLUMNS.map((col) => Math.max(col.length + 4, 16));

    // Tab 3: Bundles
    const bundleRows = (bundles as unknown as BundleForExport[]).map((b) => bundleToExportRow(b));
    const bundleSheetData: (string | number)[][] = [
      [...BUNDLE_EXPORT_COLUMNS],
      ...bundleRows.map((row) => BUNDLE_EXPORT_COLUMNS.map((col) => row[col] || "")),
    ];
    const bundleColWidths = BUNDLE_EXPORT_COLUMNS.map((col) => {
      if (col.includes("Summary") || col.includes("Specification")) return 45;
      return Math.max(col.length + 4, 16);
    });

    // Tab 4: Promotions
    const promoRows = (promotions as unknown as PromotionForExport[]).map((p) =>
      promotionToExportRow(p),
    );
    const promoSheetData: (string | number)[][] = [
      [...PROMOTION_EXPORT_COLUMNS],
      ...promoRows.map((row) => PROMOTION_EXPORT_COLUMNS.map((col) => row[col] || "")),
    ];
    const promoColWidths = PROMOTION_EXPORT_COLUMNS.map((col) => Math.max(col.length + 4, 16));

    // Tab 5: Discount Codes
    const discountRows = (discounts as unknown as DiscountForExport[]).map((d) =>
      discountToExportRow(d),
    );
    const discountSheetData: (string | number)[][] = [
      [...DISCOUNT_EXPORT_COLUMNS],
      ...discountRows.map((row) => DISCOUNT_EXPORT_COLUMNS.map((col) => row[col] || "")),
    ];
    const discountColWidths = DISCOUNT_EXPORT_COLUMNS.map((col) => Math.max(col.length + 4, 16));

    // Tab 6: Filters & Attributes
    const filterRowObjs: Record<string, string>[] = [];
    for (const attr of filters as unknown as VendorAttributeForExport[]) {
      const rows = filterToExportRows(attr);
      filterRowObjs.push(...rows);
    }
    const filterSheetData: (string | number)[][] = [
      [...FILTER_EXPORT_COLUMNS],
      ...filterRowObjs.map((row) => FILTER_EXPORT_COLUMNS.map((col) => row[col] || "")),
    ];
    const filterColWidths = FILTER_EXPORT_COLUMNS.map((col) => Math.max(col.length + 4, 16));

    // Tab 7: Field Instructions
    const instructionsHeader = [
      "Column Name",
      "Required / Optional",
      "Editable?",
      "Description & Constraints",
      "Example Values",
    ];
    const instructionsRows = UNIVERSAL_COLUMNS.map((col) => {
      const info = UNIVERSAL_COLUMN_INSTRUCTIONS[col];
      const isDoNotEdit = col.includes("[DO NOT EDIT]");
      return [
        col,
        info?.required ? "REQUIRED" : "Optional",
        isDoNotEdit ? "DO NOT EDIT (Leave unchanged for sync; leave blank for new)" : "Yes",
        info?.description || "",
        info?.example || "",
      ];
    });
    const instructionsSheetData: (string | number)[][] = [instructionsHeader, ...instructionsRows];
    const instructionsColWidths = [32, 20, 36, 60, 35];

    // Directories
    const outDirPublic = join(process.cwd(), "public", "templates");
    mkdirSync(outDirPublic, { recursive: true });

    const outDirReports = join(process.cwd(), ".import-reports", "exports");
    mkdirSync(outDirReports, { recursive: true });

    // 1. Write Standalone Product Stock Export (.xlsx with AutoFilter & Dropdowns)
    const stockXlsx = "aheed-food-centre-stock-export.xlsx";
    const universalValidations = buildColumnValidations(
      UNIVERSAL_COLUMNS,
      UNIVERSAL_DROPDOWN_RULES,
      products.length + 50,
    );
    writeWorkbook(join(outDirPublic, stockXlsx), [
      {
        name: "Products",
        rows: productSheetData,
        widths: universalColWidths,
        validations: universalValidations,
      },
    ]);
    writeWorkbook(join(outDirReports, stockXlsx), [
      {
        name: "Products",
        rows: productSheetData,
        widths: universalColWidths,
        validations: universalValidations,
      },
    ]);
    console.log(`✓ Wrote Standalone Stock Export (.xlsx) with AutoFilter and Dropdowns.`);

    // 2. Write Master Multi-Sheet Export (.xlsx with AutoFilter on all sheets)
    const masterXlsx = "aheed-food-centre-master-stock-export.xlsx";
    writeWorkbook(join(outDirPublic, masterXlsx), [
      {
        name: "Products",
        rows: productSheetData,
        widths: universalColWidths,
        validations: universalValidations,
      },
      { name: "Categories", rows: categorySheetData, widths: categoryColWidths },
      { name: "Bundles", rows: bundleSheetData, widths: bundleColWidths },
      { name: "Promotions", rows: promoSheetData, widths: promoColWidths },
      { name: "Discount Codes", rows: discountSheetData, widths: discountColWidths },
      { name: "Filters & Attributes", rows: filterSheetData, widths: filterColWidths },
      { name: "Field Instructions", rows: instructionsSheetData, widths: instructionsColWidths },
    ]);
    writeWorkbook(join(outDirReports, masterXlsx), [
      {
        name: "Products",
        rows: productSheetData,
        widths: universalColWidths,
        validations: universalValidations,
      },
      { name: "Categories", rows: categorySheetData, widths: categoryColWidths },
      { name: "Bundles", rows: bundleSheetData, widths: bundleColWidths },
      { name: "Promotions", rows: promoSheetData, widths: promoColWidths },
      { name: "Discount Codes", rows: discountSheetData, widths: discountColWidths },
      { name: "Filters & Attributes", rows: filterSheetData, widths: filterColWidths },
      { name: "Field Instructions", rows: instructionsSheetData, widths: instructionsColWidths },
    ]);
    console.log(
      `✓ Wrote Master Multi-Sheet Workbook (.xlsx) with 7 sheets, AutoFilters and Dropdowns.`,
    );

    // 3. Write Universal CSV
    const csvDataRows = productRows.map((row) => UNIVERSAL_COLUMNS.map((col) => row[col] || ""));
    const csvContent = formatCsvTable(UNIVERSAL_COLUMNS, csvDataRows);
    writeFileSync(join(outDirPublic, "aheed-food-centre-stock-export.csv"), csvContent, "utf8");
    writeFileSync(join(outDirReports, "aheed-food-centre-stock-export.csv"), csvContent, "utf8");
    console.log(`✓ Wrote Universal Stock Export (.csv).`);

    // 4. Write Essential CSV & XLSX
    const essentialRows = products.map((p) => productToEssentialRow(p));
    const essentialDataRows = essentialRows.map((row) =>
      ESSENTIAL_COLUMNS.map((col) => row[col] || ""),
    );
    const essentialCsv = formatCsvTable(ESSENTIAL_COLUMNS, essentialDataRows);
    writeFileSync(
      join(outDirPublic, "aheed-food-centre-essential-export.csv"),
      essentialCsv,
      "utf8",
    );
    writeFileSync(
      join(outDirReports, "aheed-food-centre-essential-export.csv"),
      essentialCsv,
      "utf8",
    );
    console.log(`✓ Wrote Essential Stock Export (.csv).`);

    const essentialSheetData: (string | number)[][] = [
      [...ESSENTIAL_COLUMNS],
      ...essentialDataRows,
    ];
    const essentialColWidths = ESSENTIAL_COLUMNS.map((col) => {
      if (col === "Product Name*") return 38;
      if (col.startsWith("Product ID")) return 38;
      return Math.max(col.length + 3, 14);
    });
    const essentialValidations = buildColumnValidations(
      ESSENTIAL_COLUMNS,
      ESSENTIAL_DROPDOWN_RULES,
      products.length + 50,
    );
    const essentialXlsx = "aheed-food-centre-essential-export.xlsx";
    writeWorkbook(join(outDirPublic, essentialXlsx), [
      {
        name: "Products",
        rows: essentialSheetData,
        widths: essentialColWidths,
        validations: essentialValidations,
      },
    ]);
    writeWorkbook(join(outDirReports, essentialXlsx), [
      {
        name: "Products",
        rows: essentialSheetData,
        widths: essentialColWidths,
        validations: essentialValidations,
      },
    ]);
    console.log(`✓ Wrote Essential Stock Export (.xlsx) with AutoFilter and Dropdowns.`);

    // 5. Write Blank Operational Templates
    writeFileSync(
      join(outDirPublic, "bundle-template.csv"),
      formatCsvTable(BUNDLE_EXPORT_COLUMNS, []),
      "utf8",
    );
    writeFileSync(
      join(outDirPublic, "promotion-template.csv"),
      formatCsvTable(PROMOTION_EXPORT_COLUMNS, []),
      "utf8",
    );
    writeFileSync(
      join(outDirPublic, "category-template.csv"),
      formatCsvTable(CATEGORY_EXPORT_COLUMNS, []),
      "utf8",
    );
    writeFileSync(
      join(outDirPublic, "discount-code-template.csv"),
      formatCsvTable(DISCOUNT_EXPORT_COLUMNS, []),
      "utf8",
    );
    writeFileSync(
      join(outDirPublic, "filter-template.csv"),
      formatCsvTable(FILTER_EXPORT_COLUMNS, []),
      "utf8",
    );
    console.log(
      `✓ Wrote Blank Operational Templates (.csv) for Bundles, Promotions, Categories, Discounts, Filters.`,
    );

    console.log(
      `Master stock export complete! Products: ${products.length}, Categories: ${categories.length}, Bundles: ${bundles.length}, Promotions: ${promotions.length}, Discounts: ${discounts.length}, Filters: ${filters.length}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  });
}
