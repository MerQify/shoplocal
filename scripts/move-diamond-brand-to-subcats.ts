import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readVar } from "./aheed-data-inventory";

/**
 * scripts/move-diamond-brand-to-subcats.ts
 *
 * Ensures "Diamond" is established as a Brand (Brand table),
 * assigns brandId to all Diamond seafood products,
 * moves the products from the "diamond-brand" category to their appropriate subcategories:
 *   - Prawns -> prawns (Prawns)
 *   - Squid -> crab-squid-seafood (Crab & Squid)
 *   - Fish -> frozen-fish (Frozen Fish)
 * and deletes/retires the empty "diamond-brand" category.
 *
 * Usage:
 *   npx tsx scripts/move-diamond-brand-to-subcats.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]
 */

const PRAWNS_PRODUCTS = [
  "31/40 Headless, Skin-on Prawns – 400g",
  "31/40 Headless, Skin-off Prawns – 400g",
  "Diamond 31/40 Headless Skin-On Prawns – 400g (Pack of 2)",
  "Diamond 31/40 Headless Skin-Off Prawns – 400g (Pack of 2)",
];

const SQUID_PRODUCTS = ["Clean Squid – 1kg"];

const FROZEN_FISH_PRODUCTS = [
  "Keeri Whole",
  "Headless Sardines – 1kg",
  "Indian Mackerel – 1kg",
  "Anchovy – 1kg",
  "Emperor – 1kg",
  "Sow Parai – 1kg",
  "Tuna – 1kg",
  "Barracuda – 1kg",
  "Diamond Barracuda – 1kg",
  "Golden Pomfret – 1kg",
  "Talapath – 1kg",
  "Japanese Fish – 1kg",
  "King Fish – 500g",
  "Family Finger Fish – 1300g",
  "Travali – 700g",
  "Diamond Travali – 700g (Pack of 2)",
  "Reef Cod – 700g",
  "Silver Pomfret – 1kg",
  "Milk Fish – 800g",
  "Diamond Milk Fish – 800g (Pack of 2)",
  "Diamond Keeri Whole (Pack of 2)",
];

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
      "usage: npx tsx scripts/move-diamond-brand-to-subcats.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]",
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

    // 1. Ensure Brand Diamond
    let diamondBrand = await prisma.brand.findFirst({
      where: { vendorId, slug: "diamond" },
    });
    if (!diamondBrand) {
      if (f.apply) {
        diamondBrand = await prisma.brand.create({
          data: {
            vendorId,
            name: "Diamond",
            slug: "diamond",
          },
        });
        console.log(`Created Brand: "${diamondBrand.name}" (${diamondBrand.id})`);
      } else {
        console.log(`Brand "Diamond" needs creation.`);
        diamondBrand = {
          id: "placeholder-diamond-id",
          vendorId,
          name: "Diamond",
          slug: "diamond",
          imageKey: null,
        };
      }
    } else {
      console.log(`Brand: "${diamondBrand.name}" (${diamondBrand.id})`);
    }

    // 2. Load Categories
    const categories = await prisma.category.findMany({
      where: { vendorId },
      select: { id: true, slug: true, name: true, isActive: true, parentId: true },
    });
    const catBySlug = new Map(categories.map((c) => [c.slug, c]));

    const prawnsCat = catBySlug.get("prawns");
    const crabSquidCat = catBySlug.get("crab-squid-seafood");
    const frozenFishCat = catBySlug.get("frozen-fish");
    const diamondCat = catBySlug.get("diamond-brand");

    if (!prawnsCat || !crabSquidCat || !frozenFishCat) {
      throw new Error("Target seafood categories not found");
    }

    console.log(`\nTarget Categories:`);
    console.log(`  - Prawns: ${prawnsCat.name} [${prawnsCat.slug}] (${prawnsCat.id})`);
    console.log(
      `  - Crab & Squid: ${crabSquidCat.name} [${crabSquidCat.slug}] (${crabSquidCat.id})`,
    );
    console.log(
      `  - Frozen Fish: ${frozenFishCat.name} [${frozenFishCat.slug}] (${frozenFishCat.id})`,
    );
    if (diamondCat) {
      console.log(
        `  - Source Subcategory: ${diamondCat.name} [${diamondCat.slug}] (${diamondCat.id})`,
      );
    }

    // Load products
    const allProducts = await prisma.product.findMany({
      where: { vendorId },
      select: {
        id: true,
        name: true,
        basePrice: true,
        isActive: true,
        categoryId: true,
        brandId: true,
        category: { select: { slug: true, name: true } },
        brand: { select: { name: true } },
      },
    });

    const prodByName = new Map(allProducts.map((p) => [p.name.toLowerCase(), p]));

    const plannedMoves: {
      product: (typeof allProducts)[0];
      targetCat: typeof prawnsCat;
      needsMove: boolean;
      needsBrand: boolean;
    }[] = [];

    // Prawns items
    for (const name of PRAWNS_PRODUCTS) {
      const p = prodByName.get(name.toLowerCase());
      if (!p) throw new Error(`Product not found: "${name}"`);
      plannedMoves.push({
        product: p,
        targetCat: prawnsCat,
        needsMove: p.categoryId !== prawnsCat.id,
        needsBrand: p.brandId !== diamondBrand.id,
      });
    }

    // Squid items
    for (const name of SQUID_PRODUCTS) {
      const p = prodByName.get(name.toLowerCase());
      if (!p) throw new Error(`Product not found: "${name}"`);
      plannedMoves.push({
        product: p,
        targetCat: crabSquidCat,
        needsMove: p.categoryId !== crabSquidCat.id,
        needsBrand: p.brandId !== diamondBrand.id,
      });
    }

    // Frozen Fish items
    for (const name of FROZEN_FISH_PRODUCTS) {
      const p = prodByName.get(name.toLowerCase());
      if (!p) throw new Error(`Product not found: "${name}"`);
      plannedMoves.push({
        product: p,
        targetCat: frozenFishCat,
        needsMove: p.categoryId !== frozenFishCat.id,
        needsBrand: p.brandId !== diamondBrand.id,
      });
    }

    console.log(`\n--- Evaluated ${plannedMoves.length} Diamond Brand Products ---`);
    const moveCount = plannedMoves.filter((m) => m.needsMove).length;
    const brandCount = plannedMoves.filter((m) => m.needsBrand).length;
    console.log(`  Products needing category move: ${moveCount}`);
    console.log(`  Products needing brandId set to Diamond: ${brandCount}`);

    for (const m of plannedMoves) {
      console.log(
        `  - "${m.product.name}" -> Category: ${m.targetCat.slug} (current: ${m.product.category.slug}) | Brand: Diamond (current: ${m.product.brand?.name ?? "none"})`,
      );
    }

    if (!f.apply) {
      console.log(`\n[DRY RUN COMPLETE] To apply live writes to ${host}, re-run with:`);
      console.log(
        `  npx tsx scripts/move-diamond-brand-to-subcats.ts ${f.file} ${f.key} --apply --confirm-host ${host}\n`,
      );
      return;
    }

    // APPLY PHASE
    console.log(`\n================ APPLYING LIVE WRITES ================`);

    let appliedMoves = 0;
    let appliedBrands = 0;

    for (const m of plannedMoves) {
      await prisma.product.update({
        where: { id: m.product.id },
        data: {
          categoryId: m.targetCat.id,
          brandId: diamondBrand.id,
        },
      });
      if (m.needsMove) appliedMoves++;
      if (m.needsBrand) appliedBrands++;
    }

    console.log(`Products moved to subcategories: ${appliedMoves}`);
    console.log(`Products assigned brand "Diamond": ${appliedBrands}`);

    // Delete or deactivate diamond-brand category if empty
    if (diamondCat) {
      const remainingProds = await prisma.product.count({
        where: { vendorId, categoryId: diamondCat.id },
      });
      if (remainingProds === 0) {
        await prisma.category.delete({
          where: { id: diamondCat.id },
        });
        console.log(`Deleted empty subcategory: "${diamondCat.name}" [${diamondCat.slug}]`);
      } else {
        await prisma.category.update({
          where: { id: diamondCat.id },
          data: { isActive: false },
        });
        console.log(
          `Deactivated subcategory "${diamondCat.name}" (${remainingProds} products remain)`,
        );
      }
    }

    // Verification
    console.log(`\n--- Verification Breakdown ---`);
    const finalSubcats = await prisma.category.findMany({
      where: { vendorId, parentId: prawnsCat.parentId },
      select: { id: true, slug: true, name: true, isActive: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    for (const sc of finalSubcats) {
      const total = await prisma.product.count({ where: { vendorId, categoryId: sc.id } });
      const active = await prisma.product.count({
        where: { vendorId, categoryId: sc.id, isActive: true },
      });
      const diamondCount = await prisma.product.count({
        where: { vendorId, categoryId: sc.id, brand: { slug: "diamond" } },
      });
      console.log(
        `  - ${sc.sortOrder}. "${sc.name}" [${sc.slug}] | Total: ${total}, Active: ${active}, Diamond Brand: ${diamondCount}`,
      );
    }

    const totalDiamondProducts = await prisma.product.count({
      where: { vendorId, brand: { slug: "diamond" } },
    });
    console.log(
      `\nTotal products with Brand "Diamond" for Aheed Food Centre: ${totalDiamondProducts}`,
    );
    console.log(`============================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
