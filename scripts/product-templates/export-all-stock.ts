import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeWorkbook } from "../lib/read-spreadsheet";
import {
  buildEssentialSheets,
  buildMasterSheets,
  buildStockSheets,
} from "../../lib/product-templates/workbook-sheets";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { UNIVERSAL_COLUMNS, ESSENTIAL_COLUMNS } from "../../lib/product-templates/schema";
import {
  productToUniversalRow,
  productToEssentialRow,
  sortProductsHierarchically,
  type DatabaseProductForExport,
} from "../../lib/product-templates/export";
import { BUNDLE_EXPORT_COLUMNS, type BundleForExport } from "../../lib/bundle-templates/export";
import {
  PROMOTION_EXPORT_COLUMNS,
  type PromotionForExport,
} from "../../lib/promotion-templates/export";
import {
  CATEGORY_EXPORT_COLUMNS,
  type CategoryForExport,
} from "../../lib/category-templates/export";
import {
  DISCOUNT_EXPORT_COLUMNS,
  type DiscountForExport,
} from "../../lib/discount-templates/export";
import {
  FILTER_EXPORT_COLUMNS,
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

    // --- Build Workbooks (#1714: same sheet builders as the live download route) ---
    const stockSheets = buildStockSheets(products);
    const essentialSheets = buildEssentialSheets(products);
    const masterSheets = buildMasterSheets({
      products,
      categories: categories as unknown as CategoryForExport[],
      bundles: bundles as unknown as BundleForExport[],
      promotions: promotions as unknown as PromotionForExport[],
      discounts: discounts as unknown as DiscountForExport[],
      filters: filters as unknown as VendorAttributeForExport[],
    });

    // #1714 — generated exports go ONLY to the gitignored reports folder. Anything under `public/` is
    // a static asset served with no sign-in; only the blank `*-template.*` files may be written there
    // (`tests/public-no-generated-exports.test.ts`).
    const outDirPublic = join(process.cwd(), "public", "templates");
    mkdirSync(outDirPublic, { recursive: true });

    const outDirReports = join(process.cwd(), ".import-reports", "exports");
    mkdirSync(outDirReports, { recursive: true });

    // 1. Standalone Product Stock Export (.xlsx with AutoFilter & Dropdowns)
    writeWorkbook(join(outDirReports, "stock-export.xlsx"), stockSheets);
    console.log(`✓ Wrote Standalone Stock Export (.xlsx) with AutoFilter and Dropdowns.`);

    // 2. Master Multi-Sheet Export (.xlsx with AutoFilter on all sheets)
    writeWorkbook(join(outDirReports, "master-stock-export.xlsx"), masterSheets);
    console.log(
      `✓ Wrote Master Multi-Sheet Workbook (.xlsx) with ${masterSheets.length} sheets, AutoFilters and Dropdowns.`,
    );

    // 3. Universal CSV
    const csvDataRows = products
      .map((p) => productToUniversalRow(p))
      .map((row) => UNIVERSAL_COLUMNS.map((col) => row[col] || ""));
    writeFileSync(
      join(outDirReports, "stock-export.csv"),
      formatCsvTable(UNIVERSAL_COLUMNS, csvDataRows),
      "utf8",
    );
    console.log(`✓ Wrote Universal Stock Export (.csv).`);

    // 4. Essential CSV & XLSX
    const essentialDataRows = products
      .map((p) => productToEssentialRow(p))
      .map((row) => ESSENTIAL_COLUMNS.map((col) => row[col] || ""));
    writeFileSync(
      join(outDirReports, "stock-essential-export.csv"),
      formatCsvTable(ESSENTIAL_COLUMNS, essentialDataRows),
      "utf8",
    );
    writeWorkbook(join(outDirReports, "stock-essential-export.xlsx"), essentialSheets);
    console.log(`✓ Wrote Essential Stock Export (.csv, .xlsx) with AutoFilter and Dropdowns.`);
    console.log(`  Exports written to ${outDirReports} (gitignored; never commit them).`);

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
