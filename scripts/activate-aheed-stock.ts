import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readWorkbookSheets } from "./lib/read-spreadsheet";
import { readVar } from "./aheed-data-inventory";

/**
 * scripts/activate-aheed-stock.ts
 *
 * Activates products from the "misc/Aheed Stock" spreadsheets in the catalog:
 *  - Spices (TRS, Rajah, Heera) & Shan mixes (both created batch & matched existing products)
 *  - Laziza mixes
 *  - Snacks (rolls, samosas, rotis, biryanis)
 *  - Fish & Seafood (batch items & matched catalog products)
 *  - Meat & Chicken cuts (matched catalog products)
 *  - Rice Price List (matched catalog products in rice-grains)
 *  - Activates category `spices-masalas`
 *
 * Guardrails:
 *  - basePrice > 0 only (never activates £0 lines)
 *  - restriction IS NULL only (never violates Product_restricted_inactive_check)
 *  - stockMode updated to UNTRACKED with InventoryAuditLog (EXCEL_IMPORT) if not already untracked
 *  - Never deactivates anything
 *
 * Usage:
 *   npx tsx scripts/activate-aheed-stock.ts <secrets file> <URL key> [--apply --confirm-host <host>] [--production]
 */

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGrams(s: string): number | null {
  const m = s.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g|grm|gm|gms)/);
  if (!m) return null;
  return m[2] === "kg" ? Math.round(parseFloat(m[1]) * 1000) : Math.round(parseFloat(m[1]));
}

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

async function main() {
  const f = flags(process.argv.slice(2));
  if (!f.file || !f.key) {
    throw new Error(
      "usage: npx tsx scripts/activate-aheed-stock.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]",
    );
  }

  const url = readVar(f.file, f.key);
  if (!url) throw new Error(`${f.key} not found in ${f.file}`);
  const host = new URL(url).hostname;

  console.log(`\n============================================================`);
  console.log(`Database Host: ${host}`);
  console.log(f.apply ? "MODE: APPLY (live writes)" : "MODE: DRY RUN (no writes)");
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

    // Load categories
    const categories = await prisma.category.findMany({
      where: { vendorId },
      select: { id: true, slug: true, name: true, isActive: true },
    });
    const catBySlug = new Map(categories.map((c) => [c.slug, c]));
    const catById = new Map(categories.map((c) => [c.id, c]));

    const riceGrainsCat = catBySlug.get("rice-grains");
    const chickenCat = catBySlug.get("chicken-poultry");
    const spicesCat = catBySlug.get("spices-masalas");
    const parentSnacksCat = catBySlug.get("snacks");

    // Ensure fresh-snacks subcategory is known
    let freshSnacksCat = catBySlug.get("fresh-snacks");
    if (!freshSnacksCat && parentSnacksCat) {
      if (f.apply) {
        freshSnacksCat = await prisma.category.create({
          data: {
            vendorId,
            name: "Snacks",
            slug: "fresh-snacks",
            parentId: parentSnacksCat.id,
            sortOrder: 5,
            isActive: true,
            allowsCustomNote: false,
            imageKey: "categories/snacks.jpg",
          },
          select: { id: true, slug: true, name: true, isActive: true },
        });
        catBySlug.set("fresh-snacks", freshSnacksCat);
        console.log(`Created subcategory "Snacks" [fresh-snacks] under "${parentSnacksCat.name}"`);
      } else {
        catBySlug.set("fresh-snacks", {
          id: "placeholder-fresh-snacks-id",
          slug: "fresh-snacks",
          name: "Snacks",
          isActive: true,
        });
      }
    }

    // Load all products for vendor
    const allProducts = await prisma.product.findMany({
      where: { vendorId },
      select: {
        id: true,
        name: true,
        slug: true,
        plu: true,
        basePrice: true,
        isActive: true,
        restriction: true,
        categoryId: true,
        importBatchId: true,
        netContentAmount: true,
        netContentUnit: true,
        category: { select: { id: true, slug: true, name: true, isActive: true } },
        brand: { select: { id: true, name: true } },
        inventory: { select: { id: true, stockMode: true, quantity: true } },
      },
    });

    const activeBefore = allProducts.filter((p) => p.isActive).length;
    console.log(`Vendor: ${vendor.name} (${vendor.id})`);
    console.log(`Total Products: ${allProducts.length}`);
    console.log(`Currently Active Products: ${activeBefore}\n`);

    const byId = new Map(allProducts.map((p) => [p.id, p]));

    // Map of product ID -> { product, reason, targetCategorySlug?: string }
    const candidateMap = new Map<
      string,
      { product: (typeof allProducts)[0]; reason: string; targetCategorySlug?: string }
    >();

    // 1. All products created in the stock-import batches
    const stockImportBatches = [
      "stock-import-202611141938", // Spices & Shan (62 products)
      "stock-import-202611141939", // Laziza (3 products)
      "stock-import-b9794cd9", // Snacks (20 products)
      "stock-import-e6e1a435", // Fish & Seafood (6 products)
    ];

    for (const p of allProducts) {
      if (p.importBatchId && stockImportBatches.includes(p.importBatchId)) {
        let targetCategorySlug: string | undefined;
        if (p.importBatchId === "stock-import-b9794cd9") {
          targetCategorySlug = "fresh-snacks";
        }
        candidateMap.set(p.id, {
          product: p,
          reason: `Stock import batch ${p.importBatchId}`,
          targetCategorySlug,
        });
      }
    }

    // 2. Products from StockImportRun lines in the database with decision UPDATE
    const runs = await prisma.stockImportRun.findMany({
      where: { vendorId },
      include: {
        lines: {
          select: {
            cleanName: true,
            decision: true,
            targetProductId: true,
          },
        },
      },
    });

    for (const run of runs) {
      for (const line of run.lines) {
        if (line.targetProductId && byId.has(line.targetProductId)) {
          const p = byId.get(line.targetProductId)!;
          if (line.decision === "UPDATE") {
            let targetCategorySlug: string | undefined;
            // Miscategorized rice in old POS import
            if (
              p.name.toLowerCase().includes("rice") ||
              p.name.toLowerCase().includes("basmati") ||
              run.fileName.includes("Rice")
            ) {
              if (["beverages", "milk-cream", "baby-care"].includes(p.category.slug)) {
                targetCategorySlug = "rice-grains";
              }
            }
            // Chicken liver from offal to chicken-poultry
            if (p.name.toLowerCase().includes("chicken liver") && p.category.slug === "offal") {
              targetCategorySlug = "chicken-poultry";
            }
            if (!candidateMap.has(p.id)) {
              candidateMap.set(p.id, {
                product: p,
                reason: `Run ${run.fileName} UPDATE for "${line.cleanName}"`,
                targetCategorySlug,
              });
            }
          }
        }
      }
    }

    // 3. Products in spices-masalas that were updated in #1570 (have Form attribute values)
    const prodsWithForm = await prisma.productAttributeValue.findMany({
      where: { vendorId },
      select: { productId: true },
    });
    const pidsWithForm = new Set(prodsWithForm.map((pv) => pv.productId));
    for (const pid of pidsWithForm) {
      if (byId.has(pid) && !candidateMap.has(pid)) {
        const p = byId.get(pid)!;
        if (p.category.slug === "spices-masalas") {
          candidateMap.set(p.id, {
            product: p,
            reason: `Spices/Shan product with Form attribute from #1570`,
          });
        }
      }
    }

    // 4. Match Laziza.xlsx
    const lazizaWb = readWorkbookSheets("misc/Aheed Stock/Laziza.xlsx");
    const lazizaSheet = lazizaWb.get("Sheet1");
    if (lazizaSheet) {
      const lazizaProds = allProducts.filter(
        (p) => /laziza/i.test(p.name) || p.brand?.name?.toLowerCase() === "laziza",
      );
      for (let r = 1; r < lazizaSheet.length; r++) {
        const [name] = lazizaSheet[r];
        if (!name?.trim()) continue;
        const tokens = norm(name)
          .split(" ")
          .filter((t) => t.length > 2 && t !== "masala");
        const cands = lazizaProds.filter((p) => {
          const pNorm = norm(p.name);
          return tokens.every((t) => pNorm.includes(t));
        });
        if (cands.length === 1 && !candidateMap.has(cands[0].id)) {
          candidateMap.set(cands[0].id, {
            product: cands[0],
            reason: `Laziza sheet row ${r}: "${name}"`,
            targetCategorySlug: "spices-masalas",
          });
        }
      }
    }

    // 5. Match Shan.xlsx
    const shanWb = readWorkbookSheets("misc/Aheed Stock/Shan.xlsx");
    const shanSheet = shanWb.get("Sheet1");
    if (shanSheet) {
      const shanProds = allProducts.filter(
        (p) => /shan/i.test(p.name) || p.brand?.name?.toLowerCase() === "shan",
      );
      for (let r = 1; r < shanSheet.length; r++) {
        const [name] = shanSheet[r];
        if (!name?.trim()) continue;
        const tokens = norm(name)
          .split(" ")
          .filter((t) => t.length > 2 && t !== "masala" && t !== "recipe" && t !== "mix");
        const cands = shanProds.filter((p) => {
          const pNorm = norm(p.name);
          return tokens.every((t) => pNorm.includes(t));
        });
        if (cands.length === 1 && !candidateMap.has(cands[0].id)) {
          candidateMap.set(cands[0].id, {
            product: cands[0],
            reason: `Shan sheet row ${r}: "${name}"`,
            targetCategorySlug: "spices-masalas",
          });
        }
      }
    }

    // 6. Match Rice Price List (Aheed_Food_Centre_Rice_Price_List.xlsx)
    const riceWb = readWorkbookSheets("misc/Aheed Stock/Aheed_Food_Centre_Rice_Price_List.xlsx");
    const riceSheet = riceWb.get("Rice Price List");
    if (riceSheet) {
      const riceCategoryProds = allProducts.filter((p) => p.category.slug === "rice-grains");
      for (let r = 1; r < riceSheet.length; r++) {
        const [size, name, priceStr] = riceSheet[r];
        if (!name?.trim() || !priceStr?.trim()) continue;
        const targetGrams = extractGrams(size);
        const nameTokens = norm(name)
          .split(" ")
          .filter((t) => t.length > 2);

        const candidates = riceCategoryProds.filter((p) => {
          const pNorm = norm(p.name);
          const hasTokens = nameTokens.every((t) => pNorm.includes(t));
          if (!hasTokens) return false;
          if (targetGrams !== null) {
            const pGrams = p.netContentAmount
              ? p.netContentUnit === "KILOGRAM"
                ? Math.round(p.netContentAmount * 1000)
                : Math.round(p.netContentAmount)
              : extractGrams(p.name);
            return pGrams === targetGrams;
          }
          return true;
        });

        if (candidates.length === 1 && !candidateMap.has(candidates[0].id)) {
          candidateMap.set(candidates[0].id, {
            product: candidates[0],
            reason: `Rice Price List row ${r}: "${name} ${size}"`,
          });
        }
      }
    }

    // Filter by safety constraints
    const toActivateList: {
      product: (typeof allProducts)[0];
      reason: string;
      targetCategorySlug?: string;
    }[] = [];

    let skippedAlreadyActive = 0;
    let skippedPriceZero = 0;
    let skippedRestricted = 0;

    for (const [id, item] of candidateMap) {
      const p = item.product;
      if (p.isActive) {
        skippedAlreadyActive++;
        continue;
      }
      if (p.restriction) {
        skippedRestricted++;
        console.log(`  [SKIPPED - RESTRICTED] ${p.name} (${p.restriction})`);
        continue;
      }
      if (p.basePrice <= 0) {
        skippedPriceZero++;
        console.log(`  [SKIPPED - £0 PRICE] ${p.name}`);
        continue;
      }
      toActivateList.push(item);
    }

    console.log(`\nCandidate Analysis:`);
    console.log(`  Total Evaluated: ${candidateMap.size}`);
    console.log(`  Already Active: ${skippedAlreadyActive}`);
    console.log(`  Skipped (Restricted): ${skippedRestricted}`);
    console.log(`  Skipped (£0 Price): ${skippedPriceZero}`);
    console.log(`  TO BE ACTIVATED: ${toActivateList.length}\n`);

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const item of toActivateList) {
      const slug = item.targetCategorySlug ?? item.product.category.slug;
      byCategory[slug] = (byCategory[slug] ?? 0) + 1;
    }

    console.log(`Activation Breakdown by Category:`);
    for (const [slug, count] of Object.entries(byCategory)) {
      const cat = catBySlug.get(slug);
      console.log(
        `  - Category "${cat?.name ?? slug}" [${slug}] (currently active: ${cat?.isActive}): ${count} products`,
      );
    }

    const needsSpicesCatActive =
      spicesCat && !spicesCat.isActive && (byCategory["spices-masalas"] ?? 0) > 0;
    if (needsSpicesCatActive) {
      console.log(`\nCategory "Spices & Masalas" will be activated (isActive: true).`);
    }

    if (!f.apply) {
      console.log(`\n[DRY RUN COMPLETE] To apply live writes to ${host}, re-run with:`);
      console.log(
        `  npx tsx scripts/activate-aheed-stock.ts ${f.file} ${f.key} --apply --confirm-host ${host}\n`,
      );
      return;
    }

    // APPLY PHASE
    console.log(`\n================ APPLYING LIVE WRITES ================`);

    let activatedCount = 0;
    let untrackedSetCount = 0;
    let categoryMovedCount = 0;

    for (const item of toActivateList) {
      const p = item.product;
      const targetCatSlug = item.targetCategorySlug;
      const targetCat = targetCatSlug ? catBySlug.get(targetCatSlug) : null;
      const moveCat = targetCat && targetCat.id !== p.categoryId;

      const needsUntracked = p.inventory?.stockMode !== "UNTRACKED";

      await prisma.$transaction(async (tx) => {
        // 1. Stock mode update if not already UNTRACKED
        if (needsUntracked) {
          const prevMode = p.inventory?.stockMode ?? "UNKNOWN";
          const prevQty = p.inventory?.quantity ?? 0;
          const inv = await tx.inventory.upsert({
            where: { productId: p.id },
            create: {
              vendorId,
              productId: p.id,
              quantity: 0,
              stockMode: "UNTRACKED",
            },
            update: {
              stockMode: "UNTRACKED",
              version: { increment: 1 },
            },
          });
          await tx.inventoryAuditLog.create({
            data: {
              vendorId,
              productId: p.id,
              inventoryId: inv.id,
              previousQuantity: prevQty,
              newQuantity: inv.quantity,
              changeAmount: inv.quantity - prevQty,
              previousStockMode: prevMode,
              newStockMode: "UNTRACKED",
              source: "EXCEL_IMPORT",
              reason: "Aheed Stock activation: set UNTRACKED and active",
              actorType: "SYSTEM",
            },
          });
          untrackedSetCount++;
        }

        // 2. Product update (isActive = true, category if moved)
        await tx.product.update({
          where: { id: p.id },
          data: {
            isActive: true,
            ...(moveCat ? { categoryId: targetCat!.id } : {}),
          },
        });
        activatedCount++;
        if (moveCat) categoryMovedCount++;
      });
    }

    // 3. Category activation if needed
    if (needsSpicesCatActive) {
      await prisma.category.update({
        where: { id: spicesCat.id },
        data: { isActive: true },
      });
      console.log(`Activated category: Spices & Masalas (id: ${spicesCat.id})`);
    }

    // Final verification
    const activeAfter = await prisma.product.count({ where: { vendorId, isActive: true } });
    console.log(`\n================ WRITES APPLIED SUCCESSFULLY ================`);
    console.log(`Products activated: ${activatedCount}`);
    console.log(`Stock mode set to UNTRACKED: ${untrackedSetCount}`);
    console.log(`Categories moved: ${categoryMovedCount}`);
    console.log(`Active products before: ${activeBefore}, after: ${activeAfter}`);
    console.log(`============================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
