import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readVar } from "./aheed-data-inventory";

/**
 * scripts/reorganize-and-activate-fruit-veg.ts
 *
 * Reorganizes the 51 Fruit & Vegetable products from "misc/Aheed Stock/Online Excel Sheet.xlsx"
 * into 6 distinct subcategories under "Fruit & Vegetables":
 *  1. Herbs & Leaves (herbs-leaves, sortOrder 10)
 *  2. Chillies & Peppers (chillies-peppers, sortOrder 20)
 *  3. Vegetables (fresh-vegetables, sortOrder 30)
 *  4. Onions (onions, sortOrder 40)
 *  5. Roots & Other (roots-other, sortOrder 50)
 *  6. Fruits (fresh-fruit, sortOrder 60)
 *
 * Sets all 51 products to:
 *  - isActive: true
 *  - stockMode: TRACKED
 *  - quantity: 0 (Out of stock so users cannot buy them until priced and stocked)
 *  - creates InventoryAuditLog records
 *
 * Usage:
 *   npx tsx scripts/reorganize-and-activate-fruit-veg.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]
 */

interface ProductDef {
  section:
    "Herbs & leaves" | "Chillies & peppers" | "Vegetables" | "Onions" | "Roots & other" | "Fruits";
  userItem: string;
  dbName: string;
  targetCategorySlug: string;
}

const PRODUCTS: ProductDef[] = [
  // Herbs & leaves (10) -> target: herbs-leaves
  {
    section: "Herbs & leaves",
    userItem: "Coriander",
    dbName: "Coriander",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Mint",
    dbName: "Mint",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Curry leaves",
    dbName: "Curry Leaves",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Parsley",
    dbName: "Parsley",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Spinach",
    dbName: "Spinach",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Spring onion",
    dbName: "Spring Onion",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Moringa leaves",
    dbName: "Moringa Leaves",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Drumsticks",
    dbName: "Drumsticks (Moringa)",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Ponnangani (Brazilian spinach)",
    dbName: "Ponnangani (Brazilian Spinach)",
    targetCategorySlug: "herbs-leaves",
  },
  {
    section: "Herbs & leaves",
    userItem: "Vallarai (Indian pennywort)",
    dbName: "Vallarai (Indian Pennywort)",
    targetCategorySlug: "herbs-leaves",
  },

  // Chillies & peppers (5) -> target: chillies-peppers
  {
    section: "Chillies & peppers",
    userItem: "Turkish chilli",
    dbName: "Turkish Chilli",
    targetCategorySlug: "chillies-peppers",
  },
  {
    section: "Chillies & peppers",
    userItem: "Bird's-eye chilli",
    dbName: "Bird's Eye Chilli",
    targetCategorySlug: "chillies-peppers",
  },
  {
    section: "Chillies & peppers",
    userItem: "Scotch bonnet",
    dbName: "Scotch Bonnet",
    targetCategorySlug: "chillies-peppers",
  },
  {
    section: "Chillies & peppers",
    userItem: "Mixed peppers",
    dbName: "Mixed Peppers",
    targetCategorySlug: "chillies-peppers",
  },
  {
    section: "Chillies & peppers",
    userItem: "Sweet pointed long peppers",
    dbName: "Sweet Pointed Long Peppers",
    targetCategorySlug: "chillies-peppers",
  },

  // Vegetables (15) -> target: fresh-vegetables
  {
    section: "Vegetables",
    userItem: "Sri Lankan aubergine",
    dbName: "Sri Lankan Aubergine",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Long dudi",
    dbName: "Long Dudi",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Indian okra",
    dbName: "Indian Okra",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Cabbage",
    dbName: "Cabbage",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Lettuce",
    dbName: "Lettuce",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Lemons",
    dbName: "Lemons",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Lime",
    dbName: "Limes",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "China ginger",
    dbName: "China Ginger",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Uganda ginger",
    dbName: "Uganda Ginger",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Raw peanut",
    dbName: "Raw Peanuts",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Wine tomatoes",
    dbName: "Vine Tomatoes",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Bottle gourd",
    dbName: "Bottle Gourd",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "White potatoes",
    dbName: "White Potatoes",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Red potatoes",
    dbName: "Red Potatoes",
    targetCategorySlug: "fresh-vegetables",
  },
  {
    section: "Vegetables",
    userItem: "Cucumber",
    dbName: "Cucumber",
    targetCategorySlug: "fresh-vegetables",
  },

  // Onions (6) -> target: onions
  {
    section: "Onions",
    userItem: "Bombay onion",
    dbName: "Bombay Onion",
    targetCategorySlug: "onions",
  },
  {
    section: "Onions",
    userItem: "White onion 4 kg",
    dbName: "White Onion – 4kg",
    targetCategorySlug: "onions",
  },
  {
    section: "Onions",
    userItem: "Red onion 4 kg",
    dbName: "Red Onion – 4kg",
    targetCategorySlug: "onions",
  },
  {
    section: "Onions",
    userItem: "White onion 1 kg",
    dbName: "White Onion – 1kg",
    targetCategorySlug: "onions",
  },
  {
    section: "Onions",
    userItem: "Red onion 1 kg",
    dbName: "Red Onion – 1kg",
    targetCategorySlug: "onions",
  },
  {
    section: "Onions",
    userItem: "Shallot onion",
    dbName: "Shallot Onion",
    targetCategorySlug: "onions",
  },

  // Roots & other (9) -> target: roots-other
  {
    section: "Roots & other",
    userItem: "Cassava",
    dbName: "Cassava",
    targetCategorySlug: "roots-other",
  },
  {
    section: "Roots & other",
    userItem: "Coconut",
    dbName: "Coconut",
    targetCategorySlug: "roots-other",
  },
  {
    section: "Roots & other",
    userItem: "Ripe plantain",
    dbName: "Ripe Plantain",
    targetCategorySlug: "roots-other",
  },
  { section: "Roots & other", userItem: "Yam", dbName: "Yam", targetCategorySlug: "roots-other" },
  {
    section: "Roots & other",
    userItem: "Garlic 10s",
    dbName: "Garlic – 10s",
    targetCategorySlug: "roots-other",
  },
  {
    section: "Roots & other",
    userItem: "Garlic 20s",
    dbName: "Garlic – 20s",
    targetCategorySlug: "roots-other",
  },
  {
    section: "Roots & other",
    userItem: "Garlic 40s",
    dbName: "Garlic – 40s",
    targetCategorySlug: "roots-other",
  },
  {
    section: "Roots & other",
    userItem: "White sweet potatoes",
    dbName: "White Sweet Potatoes",
    targetCategorySlug: "roots-other",
  },
  {
    section: "Roots & other",
    userItem: "Red sweet potatoes",
    dbName: "Red Sweet Potatoes",
    targetCategorySlug: "roots-other",
  },

  // Fruits (6) -> target: fresh-fruit
  { section: "Fruits", userItem: "Papaya", dbName: "Papaya", targetCategorySlug: "fresh-fruit" },
  { section: "Fruits", userItem: "Banana", dbName: "Banana", targetCategorySlug: "fresh-fruit" },
  {
    section: "Fruits",
    userItem: "Watermelon",
    dbName: "Watermelon",
    targetCategorySlug: "fresh-fruit",
  },
  { section: "Fruits", userItem: "Avocado", dbName: "Avocado", targetCategorySlug: "fresh-fruit" },
  {
    section: "Fruits",
    userItem: "Pomegranate",
    dbName: "Pomegranate",
    targetCategorySlug: "fresh-fruit",
  },
  { section: "Fruits", userItem: "Orange", dbName: "Orange", targetCategorySlug: "fresh-fruit" },
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
      "usage: npx tsx scripts/reorganize-and-activate-fruit-veg.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]",
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

    // Load Department fruit-veg
    const fruitVegDept = await prisma.category.findFirst({
      where: { vendorId, slug: "fruit-veg" },
      select: { id: true, slug: true, name: true },
    });
    if (!fruitVegDept) throw new Error("Department fruit-veg not found");

    console.log(`Department: ${fruitVegDept.name} (${fruitVegDept.id})`);

    // Load existing categories
    const categories = await prisma.category.findMany({
      where: { vendorId },
      select: { id: true, slug: true, name: true, parentId: true, isActive: true, sortOrder: true },
    });
    const catBySlug = new Map(categories.map((c) => [c.slug, c]));

    // Define the desired 6 subcategories:
    // 1. herbs-leaves: reuse herbs-salads if present, or create
    // 2. chillies-peppers: create if not present
    // 3. fresh-vegetables: update name to "Vegetables", sortOrder 30
    // 4. onions: create if not present
    // 5. roots-other: create if not present
    // 6. fresh-fruit: update name to "Fruits", sortOrder 60

    console.log(`\n--- Evaluating Subcategories ---`);

    const subcatPlan: {
      slug: string;
      name: string;
      sortOrder: number;
      action: "reuse" | "create" | "update";
      existingId?: string;
    }[] = [];

    // 1. Herbs & Leaves
    const existingHerbs = catBySlug.get("herbs-leaves") || catBySlug.get("herbs-salads");
    if (existingHerbs) {
      subcatPlan.push({
        slug: "herbs-leaves",
        name: "Herbs & Leaves",
        sortOrder: 10,
        action: existingHerbs.slug === "herbs-leaves" ? "update" : "reuse",
        existingId: existingHerbs.id,
      });
    } else {
      subcatPlan.push({
        slug: "herbs-leaves",
        name: "Herbs & Leaves",
        sortOrder: 10,
        action: "create",
      });
    }

    // 2. Chillies & Peppers
    const existingChillies = catBySlug.get("chillies-peppers");
    if (existingChillies) {
      subcatPlan.push({
        slug: "chillies-peppers",
        name: "Chillies & Peppers",
        sortOrder: 20,
        action: "update",
        existingId: existingChillies.id,
      });
    } else {
      subcatPlan.push({
        slug: "chillies-peppers",
        name: "Chillies & Peppers",
        sortOrder: 20,
        action: "create",
      });
    }

    // 3. Vegetables
    const existingVeg = catBySlug.get("fresh-vegetables");
    if (existingVeg) {
      subcatPlan.push({
        slug: "fresh-vegetables",
        name: "Vegetables",
        sortOrder: 30,
        action: "update",
        existingId: existingVeg.id,
      });
    } else {
      subcatPlan.push({
        slug: "fresh-vegetables",
        name: "Vegetables",
        sortOrder: 30,
        action: "create",
      });
    }

    // 4. Onions
    const existingOnions = catBySlug.get("onions");
    if (existingOnions) {
      subcatPlan.push({
        slug: "onions",
        name: "Onions",
        sortOrder: 40,
        action: "update",
        existingId: existingOnions.id,
      });
    } else {
      subcatPlan.push({ slug: "onions", name: "Onions", sortOrder: 40, action: "create" });
    }

    // 5. Roots & Other
    const existingRoots = catBySlug.get("roots-other");
    if (existingRoots) {
      subcatPlan.push({
        slug: "roots-other",
        name: "Roots & Other",
        sortOrder: 50,
        action: "update",
        existingId: existingRoots.id,
      });
    } else {
      subcatPlan.push({
        slug: "roots-other",
        name: "Roots & Other",
        sortOrder: 50,
        action: "create",
      });
    }

    // 6. Fruits
    const existingFruit = catBySlug.get("fresh-fruit");
    if (existingFruit) {
      subcatPlan.push({
        slug: "fresh-fruit",
        name: "Fruits",
        sortOrder: 60,
        action: "update",
        existingId: existingFruit.id,
      });
    } else {
      subcatPlan.push({ slug: "fresh-fruit", name: "Fruits", sortOrder: 60, action: "create" });
    }

    for (const sc of subcatPlan) {
      console.log(
        `  Subcategory: "${sc.name}" [${sc.slug}] -> action: ${sc.action} (sortOrder: ${sc.sortOrder})`,
      );
    }

    // Load all products for vendor
    const allProducts = await prisma.product.findMany({
      where: { vendorId },
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        isActive: true,
        restriction: true,
        categoryId: true,
        category: { select: { id: true, slug: true, name: true } },
        inventory: { select: { id: true, stockMode: true, quantity: true } },
      },
    });

    const prodByName = new Map(allProducts.map((p) => [p.name.toLowerCase(), p]));

    const plannedProducts: {
      def: ProductDef;
      product: (typeof allProducts)[0];
      targetSlug: string;
      needsMove: boolean;
      needsActivation: boolean;
      needsStockUpdate: boolean;
    }[] = [];

    for (const def of PRODUCTS) {
      const p = prodByName.get(def.dbName.toLowerCase());
      if (!p) {
        throw new Error(`Product not found in DB: "${def.dbName}"`);
      }
      const needsMove = p.category.slug !== def.targetCategorySlug;
      const needsActivation = !p.isActive;
      const needsStockUpdate = p.inventory?.stockMode !== "TRACKED" || p.inventory?.quantity !== 0;

      plannedProducts.push({
        def,
        product: p,
        targetSlug: def.targetCategorySlug,
        needsMove,
        needsActivation,
        needsStockUpdate,
      });
    }

    console.log(`\n--- Product Analysis (${plannedProducts.length} items) ---`);
    const moveCount = plannedProducts.filter((p) => p.needsMove).length;
    const actCount = plannedProducts.filter((p) => p.needsActivation).length;
    const stockCount = plannedProducts.filter((p) => p.needsStockUpdate).length;

    console.log(`  Products needing category move: ${moveCount}`);
    console.log(`  Products needing activation: ${actCount}`);
    console.log(`  Products needing stock set to TRACKED (qty: 0): ${stockCount}`);

    const pricedItems = plannedProducts.filter((p) => p.product.basePrice > 0);
    const zeroPriceItems = plannedProducts.filter((p) => p.product.basePrice === 0);
    console.log(`  Products with price > £0: ${pricedItems.length}`);
    console.log(`  Products with price = £0.00: ${zeroPriceItems.length}`);

    if (!f.apply) {
      console.log(`\n[DRY RUN COMPLETE] To apply live writes to ${host}, re-run with:`);
      console.log(
        `  npx tsx scripts/reorganize-and-activate-fruit-veg.ts ${f.file} ${f.key} --apply --confirm-host ${host}\n`,
      );
      return;
    }

    // APPLY PHASE
    console.log(`\n================ APPLYING LIVE WRITES ================`);

    // 1. Ensure subcategories in DB
    const finalSubcatMap = new Map<string, string>(); // slug -> categoryId

    for (const sc of subcatPlan) {
      if (sc.action === "reuse" && sc.existingId) {
        const updated = await prisma.category.update({
          where: { id: sc.existingId },
          data: {
            name: sc.name,
            slug: sc.slug,
            sortOrder: sc.sortOrder,
            isActive: true,
            parentId: fruitVegDept.id,
          },
          select: { id: true, slug: true, name: true },
        });
        finalSubcatMap.set(sc.slug, updated.id);
        console.log(
          `Updated & reused category: "${updated.name}" [${updated.slug}] (${updated.id})`,
        );
      } else if (sc.action === "update" && sc.existingId) {
        const updated = await prisma.category.update({
          where: { id: sc.existingId },
          data: {
            name: sc.name,
            sortOrder: sc.sortOrder,
            isActive: true,
            parentId: fruitVegDept.id,
          },
          select: { id: true, slug: true, name: true },
        });
        finalSubcatMap.set(sc.slug, updated.id);
        console.log(`Updated category: "${updated.name}" [${updated.slug}] (${updated.id})`);
      } else if (sc.action === "create") {
        const created = await prisma.category.create({
          data: {
            vendorId,
            name: sc.name,
            slug: sc.slug,
            parentId: fruitVegDept.id,
            sortOrder: sc.sortOrder,
            isActive: true,
            allowsCustomNote: false,
          },
          select: { id: true, slug: true, name: true },
        });
        finalSubcatMap.set(sc.slug, created.id);
        console.log(`Created subcategory: "${created.name}" [${created.slug}] (${created.id})`);
      }
    }

    // 2. Update products & inventory
    let appliedMoves = 0;
    let appliedActivations = 0;
    let appliedStockUpdates = 0;

    for (const item of plannedProducts) {
      const p = item.product;
      const targetCatId = finalSubcatMap.get(item.targetSlug);
      if (!targetCatId) throw new Error(`Target category ID for slug ${item.targetSlug} not found`);

      const moveCat = p.categoryId !== targetCatId;
      const activate = !p.isActive;
      const updateStock = item.needsStockUpdate;

      await prisma.$transaction(async (tx) => {
        // Stock mode -> TRACKED, quantity -> 0
        if (updateStock) {
          const prevMode = p.inventory?.stockMode ?? "UNKNOWN";
          const prevQty = p.inventory?.quantity ?? 0;
          const inv = await tx.inventory.upsert({
            where: { productId: p.id },
            create: {
              vendorId,
              productId: p.id,
              quantity: 0,
              stockMode: "TRACKED",
            },
            update: {
              stockMode: "TRACKED",
              quantity: 0,
              version: { increment: 1 },
            },
          });
          await tx.inventoryAuditLog.create({
            data: {
              vendorId,
              productId: p.id,
              inventoryId: inv.id,
              previousQuantity: prevQty,
              newQuantity: 0,
              changeAmount: 0 - prevQty,
              previousStockMode: prevMode,
              newStockMode: "TRACKED",
              source: "EXCEL_IMPORT",
              reason: "Aheed Stock: activate at out of stock per owner request",
              actorType: "SYSTEM",
            },
          });
          appliedStockUpdates++;
        }

        // Product update (isActive, categoryId)
        await tx.product.update({
          where: { id: p.id },
          data: {
            isActive: true,
            categoryId: targetCatId,
          },
        });

        if (activate) appliedActivations++;
        if (moveCat) appliedMoves++;
      });
    }

    console.log(`\n================ WRITES APPLIED SUCCESSFULLY ================`);
    console.log(`Subcategories configured: ${finalSubcatMap.size}`);
    console.log(`Products moved: ${appliedMoves}`);
    console.log(`Products activated: ${appliedActivations}`);
    console.log(`Inventory set to TRACKED (0 qty): ${appliedStockUpdates}`);

    // Verification
    const activeTotal = await prisma.product.count({ where: { vendorId, isActive: true } });
    console.log(`Total active products for Aheed Food Centre: ${activeTotal}`);
    console.log(`============================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
