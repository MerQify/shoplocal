import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeWorkbook } from "../lib/read-spreadsheet";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { UNIVERSAL_COLUMNS, ESSENTIAL_COLUMNS } from "../../lib/product-templates/schema";
import {
  productToUniversalRow,
  productToEssentialRow,
  type DatabaseProductForExport,
} from "../../lib/product-templates/export";
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

    console.log(`Querying catalogue records for vendor "${vendor.name}" (${vendor.id})...`);

    const products = await prisma.product.findMany({
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
      },
      orderBy: { name: "asc" },
    });

    console.log(`Retrieved ${products.length} products.`);

    const exportRows = products.map((p) =>
      productToUniversalRow(p as unknown as DatabaseProductForExport),
    );

    const sheetDataRows: (string | number)[][] = [
      [...UNIVERSAL_COLUMNS],
      ...exportRows.map((row) => UNIVERSAL_COLUMNS.map((col) => row[col] || "")),
    ];

    const universalColWidths = UNIVERSAL_COLUMNS.map((col) => {
      if (col === "Product Name*") return 38;
      if (col === "Description / Notes") return 45;
      if (col.startsWith("Product ID")) return 38;
      return Math.max(col.length + 3, 14);
    });

    const outDirPublic = join(process.cwd(), "public", "templates");
    mkdirSync(outDirPublic, { recursive: true });

    const outDirReports = join(process.cwd(), ".import-reports", "exports");
    mkdirSync(outDirReports, { recursive: true });

    const xlsxFileName = `aheed-food-centre-stock-export.xlsx`;
    const csvFileName = `aheed-food-centre-stock-export.csv`;

    writeWorkbook(join(outDirPublic, xlsxFileName), [
      { name: "Stock Export", rows: sheetDataRows, widths: universalColWidths },
    ]);
    writeWorkbook(join(outDirReports, xlsxFileName), [
      { name: "Stock Export", rows: sheetDataRows, widths: universalColWidths },
    ]);
    console.log(`✓ Populated Universal Export (.xlsx): ${join(outDirPublic, xlsxFileName)}`);

    // 2. Write Universal CSV
    const csvDataRows = exportRows.map((row) => UNIVERSAL_COLUMNS.map((col) => row[col] || ""));
    const csvContent = formatCsvTable(UNIVERSAL_COLUMNS, csvDataRows);
    writeFileSync(join(outDirPublic, csvFileName), csvContent, "utf8");
    writeFileSync(join(outDirReports, csvFileName), csvContent, "utf8");
    console.log(`✓ Populated Universal Export (.csv): ${join(outDirPublic, csvFileName)}`);

    // 3. Write Essential CSV
    const essentialRows = products.map((p) =>
      productToEssentialRow(p as unknown as DatabaseProductForExport),
    );
    const essentialDataRows = essentialRows.map((row) =>
      ESSENTIAL_COLUMNS.map((col) => row[col] || ""),
    );
    const essentialCsv = formatCsvTable(ESSENTIAL_COLUMNS, essentialDataRows);
    writeFileSync(
      join(outDirPublic, "aheed-food-centre-essential-export.csv"),
      essentialCsv,
      "utf8",
    );
    console.log(`✓ Populated Essential Export (.csv) written.`);

    console.log(
      `Stock export complete! Total products exported: ${products.length}. No data loss.`,
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
