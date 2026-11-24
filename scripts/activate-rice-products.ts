import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readWorkbookSheets } from "./lib/read-spreadsheet";
import { readVar } from "./aheed-data-inventory";
import { deriveUnitPricePenceForSort } from "../components/product/unit-price";
import { slugify } from "../lib/catalogue-form";

/**
 * scripts/activate-rice-products.ts
 *
 * Activates and organizes the 120 Rice & Grain products from
 * "misc/Aheed Stock/Aheed_Food_Centre_Rice_Price_List.xlsx" under:
 *   Food Cupboard -> Rice & Grains (slug: rice-grains, categoryId: 2fb3c4c8-a539-42a8-89fc-5faee6092b4b)
 *
 * Operations:
 *  1. Ensures brand "A1 Fahar" is created if missing.
 *  2. Resolves each of the 120 product lines:
 *     - Pack size: 1kg, 2kg, 5kg, 10kg, 20kg
 *     - Net content: amount (1, 2, 5, 10, 20), unit "KILOGRAM"
 *     - Unit price pence per base unit derived
 *     - Base price set to spreadsheet price in pence
 *     - Brand assigned (Tilda, Daawat, Niru, Laila, Kohinoor, etc.)
 *     - Clean display name ("<Brand> <Variety> – <Size>kg")
 *     - Sets category to rice-grains
 *     - Sets isActive = true
 *     - Sets inventory stockMode = UNTRACKED with InventoryAuditLog (EXCEL_IMPORT)
 *     - Updates or creates product (idempotent)
 *  3. Updates StockImportRun (54410042-eef5-4d51-aeaa-60751b3ffa8f) lines to APPLIED.
 *
 * Usage:
 *   npx tsx scripts/activate-rice-products.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]
 */

function flags(argv: readonly string[]) {
  const at = (flag: string) => (argv.indexOf(flag) >= 0 ? argv[argv.indexOf(flag) + 1] : undefined);
  return {
    file: argv[0],
    key: argv[1],
    apply: argv.includes("--apply"),
    production: argv.includes("--production"),
    confirmHost: at("--confirm-host"),
  };
}

function resolveBrandName(productName: string): string | null {
  const p = productName.trim();
  if (p.startsWith("Tilda")) return "Tilda";
  if (p.startsWith("Niru")) return "Niru";
  if (p.startsWith("Inndu")) return "Inndu";
  if (p.startsWith("Enrich")) return "Enrich";
  if (p.startsWith("Kaaviya")) return "Kaaviya";
  if (p.startsWith("Sankar") || p.startsWith("Shankar")) return "Shankar";
  if (p.startsWith("Ajmi")) return "Ajmi";
  if (p.startsWith("Daawat")) return "Daawat";
  if (p.startsWith("Laila")) return "Laila";
  if (p.startsWith("Kohinoor")) return "Kohinoor";
  if (p.startsWith("Akash")) return "Akash";
  if (p.startsWith("Apna")) return "Apna";
  if (p.startsWith("Trolly Boy") || p.startsWith("Tolly Boy")) return "Tolly Boy";
  if (p.startsWith("Mahmood")) return "Mahmood";
  if (p.startsWith("Tropical Sun")) return "Tropical Sun";
  if (p.startsWith("Ani") || p.startsWith("Aani")) return "Aani";
  if (p.startsWith("Surya")) return "Surya";
  if (p.startsWith("Veetee")) return "Veetee";
  if (p.startsWith("Sunland")) return "Sunland";
  if (p.startsWith("Mayil")) return "Mayil";
  if (p.startsWith("Ahmed")) return "Ahmed";
  if (p.startsWith("Afraid")) return "Afraid";
  if (p.startsWith("Aubkass")) return "Aubkass";
  if (p.startsWith("Soghaat")) return "Soghaat";
  if (p.startsWith("Banadir")) return "Banadir";
  if (p.startsWith("A1 Fahar")) return "A1 Fahar";
  if (p.startsWith("Island Sun")) return "Island Sun";
  if (p.startsWith("AAA")) return "AAA";
  if (p.startsWith("Asli")) return "Asli";
  if (p.startsWith("Anjoman")) return "Anjoman";
  if (p.startsWith("Heera")) return "Heera";
  if (p.startsWith("Annam")) return "Annam";
  if (p.startsWith("India Gate")) return "India Gate";
  if (p.startsWith("Trophy")) return "Trophy";
  return null;
}

function formatCleanName(rawName: string, sizeNum: number): string {
  let name = rawName.trim();
  name = name
    .replace(/^Sankar\b/, "Shankar")
    .replace(/^Trolly Boy\b/, "Tolly Boy")
    .replace(/^Ani\b/, "Aani")
    .replace(/\bEast Cook\b/, "Easy Cook")
    .replace(/^Afraid\b/, "Afraid")
    .replace(/^Aubkass Sell\b/, "Aubkass Sella");

  return `${name} – ${sizeNum}kg`;
}

function uniqueSlug(existingSlugs: Set<string>, name: string): string {
  const base = slugify(name).slice(0, 90) || "rice-product";
  let s = base;
  for (let n = 2; existingSlugs.has(s); n++) {
    s = `${base}-${n}`;
  }
  existingSlugs.add(s);
  return s;
}

// Known catalog product matches from old POS import
const KNOWN_EXACT_MATCHES: Record<number, string> = {
  2: "f48d6a3c-1bb5-411d-9234-f250f896db54", // 1kg Tilda Pure Basmati -> "TILDA PURE ORIGINAL BASMATI RICE 1KG"
  5: "09b59c3c-7516-48c8-9b59-9f6390b705f8", // 1kg Niru Ponni Boiled Rice -> "NIRU PONNI BOILED RICE IKG"
  7: "13b749ce-c657-4478-addd-8d4c4687fbc6", // 1kg Niru Idly Rice -> "NIRU IDLY RICE 1KG"
  8: "30ac7d78-d54f-43ad-ad90-d8211ca36de9", // 1kg Niru Red Raw Rice -> "RED RAW RICE 1 KG"
  9: "63875899-114a-473a-b57c-585c99c0fd69", // 1kg Niru Parboiled Rice -> "NIRU PARBOILD COUNTRY RICE"
  24: "1d2d3465-e192-4418-a47a-f56870dd6acf", // 2kg Daawat Extra Long Basmati -> "DAAWAT EXTRA LONG"
  25: "87b1ab95-c7a2-4d2f-83c2-5491bd143449", // 2kg Laila Basmati -> "LAILA BROWN BASMATI 2KG"
  27: "0232d761-854b-4ebf-a12d-20d0eb61509c", // 2kg Akash Basmati -> "AKASH BASMATI 2KG"
  29: "ea9de929-3bdf-419b-ab09-ae94576fe9e4", // 2kg Trolly Boy Easy Cook -> "TOLLY BOY 2KG"
  35: "c520ca08-f1b2-46c5-9f61-7d023039102a", // 5kg Tilda Pure Basmati -> "TILDA PURE O BASMATI"
  36: "0201d171-8043-44f2-89a1-13b71ac70d04", // 5kg Tilda Brown Basmati -> "TILDA WHOLEGRAIN 5 KG"
  40: "0fd1fefd-e527-47d2-ad52-080fad8bd89c", // 5kg Laila Basmati -> "LAILA BASMATI RICE 5KG"
  48: "d2feddb4-7b70-4045-9f8a-84efd3b79b1a", // 5kg Veetee Basmati Extra Long -> "VEETEE MEGA BASMATI EXTRA LONG 5KG"
  52: "33887465-9ba4-419e-976e-3e4b78971f11", // 5kg Mottai Karuppan Rice -> "R/R MOTTAKARUPAN RICE 5KG"
  55: "25d10d24-a567-4347-8d08-43890f6cdb30", // 5kg Ani Red Raw Rice -> "AANI RED RAW RICE"
  57: "6a67c514-c159-4ae5-be71-cfd7990494cf", // 5kg Niru Poonahari Mottakarupan -> "POONAGARI MOTTAIKARUPPAN"
  60: "be19beb5-5276-4c3d-897a-87a1e54bc66f", // 5kg Afraid Sella Rice -> "AFRIDI LONG BASMATI 5KG"
  61: "105c9bc2-f99d-4837-a322-248cc10557dc", // 5kg Aubkass Sell Rice -> "ABU KASS5KG"
  65: "01cdf177-b672-4061-88dd-25f5d81f415b", // 5kg Apna Rice -> "APNA RICE PERFECTION"
  67: "d5c146e2-9d2c-404d-ae86-364585cb8efe", // 5kg AAA Green Dragon Rice -> "GREEN DRAGON JASMINE RICE 5KG]"
  69: "d107e25d-be83-41f1-b877-688c88ada1e4", // 5kg Tolly Boy Easy Cook -> "TROLLY BOY RICE"
  71: "58a4d299-653e-4991-8ab1-415bd015d958", // 5kg Tropical Sun Golden Sella -> "TS GOLDEN SELLA BASMATI 5KG"
  73: "8a23c88d-dea4-4cb8-b157-c47c1f2e2b38", // 5kg Tilda Golden Sella Rice -> "TILDA GOLDEN SELLA BASMATI RICE 5KG"
  75: "805bd6e5-4413-46b9-b5de-a1effbc48806", // 5kg Anjoman Rice -> "5KG ANJOMAN RICE"
  76: "281571e8-49c4-4df8-8592-b918f80f5cb8", // 5kg Egyptian Rice -> "EGYPTIAN RICE"
  77: "3a6c7e3b-2e8d-4439-a0af-388973ad1e6e", // 5kg Shankar Thanjavur Ponni Boiled -> "SHANKER PONNI BOILED 5KG"
  79: "3906240b-cf9b-4538-8026-7a1717b7836b", // 5kg Shankar Andhra Sona Masoori -> "SHANKAR SONA MASOORI 5KG"
  80: "aa0bae62-1329-4b67-97d9-d9c2f586ffa8", // 5kg Shankar Idly Rice -> "SHANKAR IDLY RICE 5KG"
  82: "09bc6eb7-3a86-4fdc-8935-e91b4069e315", // 5kg Niru Matta Rice -> "NIRU MATTA RICE 5KG"
  84: "c4ce3619-f72e-481d-80b8-3747e094d41f", // 5kg Shankar Jeera Samba Rice -> "5KG JEERASAMBA"
  86: "8c4199d2-cb6e-454d-bd58-1158584703da", // 5kg Tilda Long Grain Basmati -> "TILDA 5KG EASY COOK RICE"
  89: "b5cb1c3a-3fc4-4a06-8ecb-80cdd47d52c7", // 10kg Aani Basmati -> "AANI BASMATI RICE"
  95: "8537f23c-ae47-44aa-99fa-38341ce58fa6", // 10kg Laila Basmati Rice -> "LAILA BASMATI RICE 10KG"
  97: "d1080c15-e089-47ed-8354-0e833a1106ee", // 10kg Tilda Pure Basmati Rice -> "TILDA BASMATI 10KG"
  98: "732d31ea-d026-4466-a27c-74b52def85cf", // 10kg Tropical Sun Gold Sella Basmati -> "TROPICAL SUN SELLA BASMATI RICE 10KG"
  101: "dffdfee1-2b26-4dd6-a5ff-b57af96a0efc", // 10kg Tilda Gold Sella Basmati -> "TILDA GOLDEN SELA BASMATI RICE 10KG"
  104: "387eb872-97b8-433b-8335-6f8cccb4ff5f", // 10kg Shankar Thanjavur Ponni -> "SHANKAR PONNI BOILED 10KG"
  105: "43cb2c70-4d78-4117-84f5-72f3548336f7", // 10kg Shankar Andhra Sona Masoori -> "SHANKAR SONA MASOORI RICE 10KG"
};

const RICE_RUN_ID = "54410042-eef5-4d51-aeaa-60751b3ffa8f";
const BATCH_ID = "stock-import-54410042";

async function main() {
  const f = flags(process.argv.slice(2));
  if (!f.file || !f.key) {
    throw new Error(
      "usage: npx tsx scripts/activate-rice-products.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]",
    );
  }

  const url = readVar(f.file, f.key);
  if (!url) throw new Error(`${f.key} not found in ${f.file}`);
  const host = new URL(url).hostname;

  console.log(`\n============================================================`);
  console.log(`Database Host: ${host}`);
  console.log(f.apply ? "MODE: APPLY (live database writes)" : "MODE: DRY RUN (no writes)");
  console.log(`============================================================\n`);

  if (f.apply && f.confirmHost !== host) {
    throw new Error(`--apply requires --confirm-host ${host} (got ${f.confirmHost ?? "none"})`);
  }
  if (f.apply && /production/i.test(f.file) && !f.production) {
    throw new Error("REFUSED: a production secrets file also requires --production flag");
  }

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

  try {
    const vendor = await prisma.vendor.findFirst({
      where: { slug: "aheed-food-centre" },
      select: { id: true, slug: true, name: true },
    });
    if (!vendor) throw new Error("Vendor aheed-food-centre not found");
    const vendorId = vendor.id;

    // 1. Resolve Category "rice-grains"
    const riceCat = await prisma.category.findFirst({
      where: { vendorId, slug: "rice-grains" },
      select: { id: true, slug: true, name: true, isActive: true },
    });
    if (!riceCat) throw new Error("Category rice-grains not found");
    console.log(
      `Target Category: "${riceCat.name}" (${riceCat.id}) [isActive: ${riceCat.isActive}]`,
    );

    // 2. Resolve Brands
    let brands = await prisma.brand.findMany({
      where: { vendorId },
      select: { id: true, name: true, slug: true },
    });

    // Check if "A1 Fahar" exists, create if missing
    let a1Fahar = brands.find((b) => b.slug === "a1-fahar" || b.name.toLowerCase() === "a1 fahar");
    if (!a1Fahar) {
      if (f.apply) {
        a1Fahar = await prisma.brand.create({
          data: {
            vendorId,
            name: "A1 Fahar",
            slug: "a1-fahar",
          },
          select: { id: true, name: true, slug: true },
        });
        brands.push(a1Fahar);
        console.log(`Created brand "A1 Fahar" (${a1Fahar.id})`);
      } else {
        console.log(`[DRY RUN] Will create brand "A1 Fahar"`);
        a1Fahar = { id: "placeholder-a1-fahar-id", name: "A1 Fahar", slug: "a1-fahar" };
        brands.push(a1Fahar);
      }
    }

    const brandByName = new Map(brands.map((b) => [b.name.toLowerCase(), b]));

    // 3. Load spreadsheet
    const wb = readWorkbookSheets("misc/Aheed Stock/Aheed_Food_Centre_Rice_Price_List.xlsx");
    const sheet = wb.get("Rice Price List");
    if (!sheet) throw new Error("Sheet 'Rice Price List' not found");

    // 4. Load all products & inventory for Aheed
    const allProducts = await prisma.product.findMany({
      where: { vendorId },
      select: {
        id: true,
        name: true,
        slug: true,
        plu: true,
        basePrice: true,
        isActive: true,
        netContentAmount: true,
        netContentUnit: true,
        categoryId: true,
        brandId: true,
        importBatchId: true,
        inventory: { select: { id: true, stockMode: true, quantity: true } },
      },
    });

    const byId = new Map(allProducts.map((p) => [p.id, p]));
    const existingSlugs = new Set(allProducts.map((p) => p.slug));

    // Also load StockImportLine items for this run if present
    const importRun = await prisma.stockImportRun.findFirst({
      where: { id: RICE_RUN_ID, vendorId },
      include: {
        lines: { select: { id: true, rowNumber: true, status: true } },
      },
    });
    const lineByRowNumber = new Map(importRun?.lines.map((l) => [l.rowNumber, l]) ?? []);
    console.log(`StockImportRun lines loaded: ${lineByRowNumber.size}\n`);

    // 5. Plan operations
    interface PlanItem {
      rowIdx: number;
      sizeNum: number;
      rawName: string;
      cleanName: string;
      pricePence: number;
      brandId: string | null;
      brandName: string | null;
      action: "UPDATE" | "CREATE";
      targetId: string | null;
      targetProduct?: (typeof allProducts)[0];
    }

    const plan: PlanItem[] = [];

    for (let r = 1; r < sheet.length; r++) {
      const [packSize, rawName, priceStr] = sheet[r];
      if (!rawName?.trim()) continue;
      const rowIdx = r + 1;
      const sizeNum = parseInt(packSize.replace(/[^0-9]/g, ""), 10);
      const cleanPrice = String(priceStr).replace(/[£,\s]/g, "");
      const pricePence = Math.round(parseFloat(cleanPrice) * 100);

      const bName = resolveBrandName(rawName);
      const brand = bName ? brandByName.get(bName.toLowerCase()) : null;
      const brandId = brand?.id ?? null;
      const cleanName = formatCleanName(rawName, sizeNum);

      // Check if already matched
      const knownTargetId = KNOWN_EXACT_MATCHES[rowIdx] ?? null;
      let targetProduct = knownTargetId ? byId.get(knownTargetId) : undefined;

      // Idempotency: if already created in earlier run, match by name or slug
      if (!targetProduct) {
        const existingByName = allProducts.find(
          (p) => p.categoryId === riceCat.id && p.name.toLowerCase() === cleanName.toLowerCase(),
        );
        if (existingByName) {
          targetProduct = existingByName;
        }
      }

      const action = targetProduct ? "UPDATE" : "CREATE";

      plan.push({
        rowIdx,
        sizeNum,
        rawName: rawName.trim(),
        cleanName,
        pricePence,
        brandId,
        brandName: bName,
        action,
        targetId: targetProduct?.id ?? null,
        targetProduct,
      });
    }

    const updateItems = plan.filter((p) => p.action === "UPDATE");
    const createItems = plan.filter((p) => p.action === "CREATE");

    console.log(`============================================================`);
    console.log(`PLAN SUMMARY:`);
    console.log(`  Total Products: ${plan.length}`);
    console.log(`  UPDATE (Existing): ${updateItems.length}`);
    console.log(`  CREATE (New): ${createItems.length}`);
    console.log(`============================================================\n`);

    if (!f.apply) {
      console.log(`[DRY RUN] Sample 5 UPDATE operations:`);
      for (const u of updateItems.slice(0, 5)) {
        console.log(
          `  Row ${u.rowIdx}: UPDATE "${u.cleanName}" (£${(u.pricePence / 100).toFixed(2)}) [Brand: ${u.brandName ?? "None"}] -> Target "${u.targetProduct?.name}" (${u.targetId})`,
        );
      }

      console.log(`\n[DRY RUN] Sample 5 CREATE operations:`);
      for (const c of createItems.slice(0, 5)) {
        console.log(
          `  Row ${c.rowIdx}: CREATE "${c.cleanName}" (£${(c.pricePence / 100).toFixed(2)}) [Brand: ${c.brandName ?? "None"}]`,
        );
      }

      console.log(`\nDry run complete. Use --apply --confirm-host ${host} to execute live writes.`);
      return;
    }

    // 6. APPLY WRITES
    let updatedCount = 0;
    let createdCount = 0;
    let auditLogsCreated = 0;
    let linesApplied = 0;

    for (const item of plan) {
      const netContent = { amount: item.sizeNum, unit: "KILOGRAM" as const };
      const unitPricePencePerBaseUnit = deriveUnitPricePenceForSort(item.pricePence, netContent);

      if (item.action === "UPDATE" && item.targetProduct) {
        const p = item.targetProduct;
        // Update product
        await prisma.product.update({
          where: { id: p.id },
          data: {
            name: item.cleanName,
            basePrice: item.pricePence,
            categoryId: riceCat.id,
            brandId: item.brandId,
            netContentAmount: item.sizeNum,
            netContentUnit: "KILOGRAM",
            unitPricePencePerBaseUnit,
            isActive: true,
          },
        });
        updatedCount++;

        // Ensure inventory is UNTRACKED
        if (p.inventory) {
          if (p.inventory.stockMode !== "UNTRACKED") {
            const prevMode = p.inventory.stockMode;
            const prevQty = p.inventory.quantity;
            await prisma.inventory.update({
              where: { id: p.inventory.id },
              data: { stockMode: "UNTRACKED" },
            });

            await prisma.inventoryAuditLog.create({
              data: {
                vendorId,
                productId: p.id,
                inventoryId: p.inventory.id,
                previousQuantity: prevQty,
                newQuantity: prevQty,
                changeAmount: 0,
                previousStockMode: prevMode,
                newStockMode: "UNTRACKED",
                source: "EXCEL_IMPORT",
                reason: "Excel stock activation: Rice Price List",
              },
            });
            auditLogsCreated++;
          }
        } else {
          // Create inventory if missing
          const inv = await prisma.inventory.create({
            data: {
              vendorId,
              productId: p.id,
              quantity: 0,
              stockMode: "UNTRACKED",
              lowStockThreshold: 5,
            },
          });
          await prisma.inventoryAuditLog.create({
            data: {
              vendorId,
              productId: p.id,
              inventoryId: inv.id,
              previousQuantity: 0,
              newQuantity: 0,
              changeAmount: 0,
              previousStockMode: "UNKNOWN",
              newStockMode: "UNTRACKED",
              source: "EXCEL_IMPORT",
              reason: "Excel stock activation: Rice Price List",
            },
          });
          auditLogsCreated++;
        }

        // Update StockImportLine if present
        const line = lineByRowNumber.get(item.rowIdx);
        if (line) {
          await prisma.stockImportLine.update({
            where: { id: line.id },
            data: {
              status: "APPLIED",
              decision: "UPDATE",
              targetProductId: p.id,
              resultProductId: p.id,
              appliedAt: new Date(),
            },
          });
          linesApplied++;
        }
      } else {
        // CREATE new product
        const id = crypto.randomUUID();
        const slug = uniqueSlug(existingSlugs, item.cleanName);

        const newProd = await prisma.product.create({
          data: {
            id,
            vendorId,
            slug,
            name: item.cleanName,
            description: "",
            categoryId: riceCat.id,
            basePrice: item.pricePence,
            unitLabel: "each",
            netContentAmount: item.sizeNum,
            netContentUnit: "KILOGRAM",
            unitPricePencePerBaseUnit,
            brandId: item.brandId,
            isActive: true,
            vatRate: 0,
            isFresh: false,
            isHalal: true,
            isVegetarian: true,
            isGlutenFree: true,
            importBatchId: BATCH_ID,
            importSourceRow: item.rowIdx,
          },
        });

        // Create inventory
        const inv = await prisma.inventory.create({
          data: {
            vendorId,
            productId: id,
            quantity: 0,
            stockMode: "UNTRACKED",
            lowStockThreshold: 5,
          },
        });

        // Audit log
        await prisma.inventoryAuditLog.create({
          data: {
            vendorId,
            productId: id,
            inventoryId: inv.id,
            previousQuantity: 0,
            newQuantity: 0,
            changeAmount: 0,
            previousStockMode: "UNKNOWN",
            newStockMode: "UNTRACKED",
            source: "EXCEL_IMPORT",
            reason: "Excel stock activation: Rice Price List",
          },
        });

        createdCount++;
        auditLogsCreated++;

        // Update StockImportLine if present
        const line = lineByRowNumber.get(item.rowIdx);
        if (line) {
          await prisma.stockImportLine.update({
            where: { id: line.id },
            data: {
              status: "APPLIED",
              decision: "CREATE",
              resultProductId: newProd.id,
              appliedAt: new Date(),
            },
          });
          linesApplied++;
        }
      }
    }

    // Update StockImportRun updatedAt if present
    if (importRun) {
      await prisma.stockImportRun.update({
        where: { id: importRun.id },
        data: { updatedAt: new Date() },
      });
    }

    console.log(`\n============================================================`);
    console.log(`EXECUTION COMPLETED SUCCESSFULLY!`);
    console.log(`  Updated Products: ${updatedCount}`);
    console.log(`  Created Products: ${createdCount}`);
    console.log(`  Total Active Rice Products Processed: ${updatedCount + createdCount}`);
    console.log(`  Inventory Audit Logs Created: ${auditLogsCreated}`);
    console.log(`  StockImportLines Marked APPLIED: ${linesApplied}`);
    console.log(`============================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
