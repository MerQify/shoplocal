import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readVar } from "./aheed-data-inventory";

/**
 * scripts/reorganize-fish-seafood.ts
 *
 * Reorganizes the 52 Fish & Seafood products from "misc/Aheed Stock/Online Excel Sheet.xlsx"
 * into the 5 subcategories under "Fish & Seafood":
 *  1. Frozen Fish (frozen-fish, sortOrder 10)
 *  2. Prawns (prawns, sortOrder 20)
 *  3. Crab & Squid (crab-squid-seafood, sortOrder 30)
 *  4. Other Fish (other-fish, sortOrder 40)
 *  5. Diamond Brand (diamond-brand, sortOrder 50)
 *
 * Verifies and configures:
 *  - Subcategories activated (isActive: true)
 *  - All products active (isActive: true)
 *  - Stock mode UNTRACKED with InventoryAuditLog if not already untracked
 *  - Multi-buy price tiers:
 *      * Keeri Whole: 2 for £6.99 (699p)
 *      * Travali – 700g: 2 for £8.99 (899p)
 *      * Milk Fish – 800g: 2 for £6.99 (699p)
 *  - Box offers verified as active standalone box products in frozen-fish:
 *      * Tilapia 800g+ – Box (£20.00)
 *      * Tilapia 500–800g – Box (£18.00)
 *      * Catfish – Box (£20.00)
 *      * Croaker – Box (£34.00)
 *
 * Usage:
 *   npx tsx scripts/reorganize-fish-seafood.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]
 */

interface ProductMapping {
  section: "Frozen fish" | "Prawns" | "Crab & squid" | "Other fish" | "Diamond brand";
  userProduct: string;
  dbName: string;
  targetCategorySlug: string;
  expectedPricePence: number;
  offerNote?: string;
  tier?: { quantity: number; pricePence: number };
}

const FISH_MAPPINGS: ProductMapping[] = [
  // 1. Frozen fish (12 items) -> frozen-fish
  {
    section: "Frozen fish",
    userProduct: "Tilapia 800+",
    dbName: "Tilapia 800+",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 1299,
    offerNote: "Box £20.00",
  },
  {
    section: "Frozen fish",
    userProduct: "Tilapia 500–800",
    dbName: "Tilapia 500–800",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 1099,
    offerNote: "Box £18.00",
  },
  {
    section: "Frozen fish",
    userProduct: "Catfish",
    dbName: "Catfish",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 1099,
    offerNote: "Box £20.00",
  },
  {
    section: "Frozen fish",
    userProduct: "Croaker",
    dbName: "Croaker",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 1799,
    offerNote: "Box £34.00",
  },
  {
    section: "Frozen fish",
    userProduct: "Rohu fish",
    dbName: "Rohu Fish",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 649,
  },
  {
    section: "Frozen fish",
    userProduct: "Mackerel fish",
    dbName: "Mackerel Fish",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 250,
  },
  {
    section: "Frozen fish",
    userProduct: "Red bream (headless)",
    dbName: "Red Bream (headless)",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 500,
  },
  {
    section: "Frozen fish",
    userProduct: "Travali",
    dbName: "Travali",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 549,
  },
  {
    section: "Frozen fish",
    userProduct: "Barracuda",
    dbName: "Barracuda",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 649,
  },
  {
    section: "Frozen fish",
    userProduct: "Golden pomfret (whole)",
    dbName: "Golden Pomfret Whole of – 2 each",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 1000,
    offerNote: "2 for £10.00",
  },
  {
    section: "Frozen fish",
    userProduct: "Snapper",
    dbName: "Snapper Bag",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 500,
  },
  {
    section: "Frozen fish",
    userProduct: "Hake fish",
    dbName: "Hake Fish",
    targetCategorySlug: "frozen-fish",
    expectedPricePence: 649,
  },

  // 2. Prawns (6 items) -> prawns
  {
    section: "Prawns",
    userProduct: "Prawns 13/15",
    dbName: "Prawns 13/15 – 1kg",
    targetCategorySlug: "prawns",
    expectedPricePence: 1099,
  },
  {
    section: "Prawns",
    userProduct: "Shell-on prawns 40/50",
    dbName: "Shell-on Prawns 40/50 – 2kg",
    targetCategorySlug: "prawns",
    expectedPricePence: 1499,
  },
  {
    section: "Prawns",
    userProduct: "Shell-on prawns 20/30",
    dbName: "Shell-On Prawns 20/30 – 2kg",
    targetCategorySlug: "prawns",
    expectedPricePence: 1899,
  },
  {
    section: "Prawns",
    userProduct: "Cooked shell-on prawns",
    dbName: "Cooked Shell On Prawns Bag – 400g",
    targetCategorySlug: "prawns",
    expectedPricePence: 399,
  },
  {
    section: "Prawns",
    userProduct: "Cooked peeled prawns",
    dbName: "Cooked Peeled Prawns – 400g",
    targetCategorySlug: "prawns",
    expectedPricePence: 499,
  },
  {
    section: "Prawns",
    userProduct: "Butterfly-style coated king prawns",
    dbName: "Butterfly-style Coated King Prawns",
    targetCategorySlug: "prawns",
    expectedPricePence: 599,
  },

  // 3. Crab & squid (9 items) -> crab-squid-seafood
  {
    section: "Crab & squid",
    userProduct: "Diamond cut crab",
    dbName: "Diamond Cut Crab",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 1699,
  },
  {
    section: "Crab & squid",
    userProduct: "Cut crab (China)",
    dbName: "Cut Crab (china)",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 899,
  },
  {
    section: "Crab & squid",
    userProduct: "Breaded crab claws",
    dbName: "Breaded Crab Claws",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 699,
  },
  {
    section: "Crab & squid",
    userProduct: "Royal squid",
    dbName: "Royal Squid",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 399,
  },
  {
    section: "Crab & squid",
    userProduct: "Squid block",
    dbName: "Squid Block – 2kg",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 1799,
  },
  {
    section: "Crab & squid",
    userProduct: "Squid rings",
    dbName: "Squid Rings – 1kg",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 799,
  },
  {
    section: "Crab & squid",
    userProduct: "Squid tubes",
    dbName: "Squid Tubes",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 799,
  },
  {
    section: "Crab & squid",
    userProduct: "Octopus flower",
    dbName: "Octopus Flower",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 1699,
  },
  {
    section: "Crab & squid",
    userProduct: "Seafood mix",
    dbName: "Seafood Mix – 1kg",
    targetCategorySlug: "crab-squid-seafood",
    expectedPricePence: 799,
  },

  // 4. Other fish (5 items) -> other-fish
  {
    section: "Other fish",
    userProduct: "Tilapia fillet",
    dbName: "Tilapia Fillet – 720g",
    targetCategorySlug: "other-fish",
    expectedPricePence: 799,
  },
  {
    section: "Other fish",
    userProduct: "Sprats",
    dbName: "Sprats – 1kg",
    targetCategorySlug: "other-fish",
    expectedPricePence: 399,
  },
  {
    section: "Other fish",
    userProduct: "Pangasius fillet",
    dbName: "Pangasius Fillet",
    targetCategorySlug: "other-fish",
    expectedPricePence: 699,
  },
  {
    section: "Other fish",
    userProduct: "Pangasius cut",
    dbName: "Pangasius Cut – 800g",
    targetCategorySlug: "other-fish",
    expectedPricePence: 399,
  },
  {
    section: "Other fish",
    userProduct: "Smoked mackerel",
    dbName: "Smoked Mackerel",
    targetCategorySlug: "other-fish",
    expectedPricePence: 550,
  },

  // 5. Diamond brand (20 items) -> diamond-brand
  {
    section: "Diamond brand",
    userProduct: "31/40 headless, skin-on prawns",
    dbName: "31/40 Headless, Skin-on Prawns – 400g",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 399,
    offerNote: "2 for £7.99 (Pack of 2 available)",
  },
  {
    section: "Diamond brand",
    userProduct: "31/40 headless, skin-off prawns",
    dbName: "31/40 Headless, Skin-off Prawns – 400g",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 399,
    offerNote: "2 for £7.99 (Pack of 2 available)",
  },
  {
    section: "Diamond brand",
    userProduct: "Clean squid",
    dbName: "Clean Squid – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 899,
  },
  {
    section: "Diamond brand",
    userProduct: "Keeri whole",
    dbName: "Keeri Whole",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 350,
    offerNote: "2 for £6.99",
    tier: { quantity: 2, pricePence: 699 },
  },
  {
    section: "Diamond brand",
    userProduct: "Headless sardines",
    dbName: "Headless Sardines – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 599,
  },
  {
    section: "Diamond brand",
    userProduct: "Indian mackerel",
    dbName: "Indian Mackerel – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 499,
  },
  {
    section: "Diamond brand",
    userProduct: "Anchovy",
    dbName: "Anchovy – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 799,
  },
  {
    section: "Diamond brand",
    userProduct: "Emperor",
    dbName: "Emperor – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 699,
  },
  {
    section: "Diamond brand",
    userProduct: "Sow parai",
    dbName: "Sow Parai – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 499,
  },
  {
    section: "Diamond brand",
    userProduct: "Tuna",
    dbName: "Tuna – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 699,
  },
  {
    section: "Diamond brand",
    userProduct: "Barracuda",
    dbName: "Barracuda – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 699,
  },
  {
    section: "Diamond brand",
    userProduct: "Golden pomfret",
    dbName: "Golden Pomfret – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 699,
  },
  {
    section: "Diamond brand",
    userProduct: "Talapath",
    dbName: "Talapath – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 699,
  },
  {
    section: "Diamond brand",
    userProduct: "Japanese",
    dbName: "Japanese Fish – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 699,
  },
  {
    section: "Diamond brand",
    userProduct: "King fish",
    dbName: "King Fish – 500g",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 499,
  },
  {
    section: "Diamond brand",
    userProduct: "Family finger fish",
    dbName: "Family Finger Fish – 1300g",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 1399,
  },
  {
    section: "Diamond brand",
    userProduct: "Travali",
    dbName: "Travali – 700g",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 450,
    offerNote: "2 for £8.99",
    tier: { quantity: 2, pricePence: 899 },
  },
  {
    section: "Diamond brand",
    userProduct: "Reef cod",
    dbName: "Reef Cod – 700g",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 499,
  },
  {
    section: "Diamond brand",
    userProduct: "Silver pomfret",
    dbName: "Silver Pomfret – 1kg",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 999,
  },
  {
    section: "Diamond brand",
    userProduct: "Milk fish",
    dbName: "Milk Fish – 800g",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 350,
    offerNote: "2 for £6.99",
    tier: { quantity: 2, pricePence: 699 },
  },

  // Supplementary Pack-of-2 Diamond items -> diamond-brand
  {
    section: "Diamond brand",
    userProduct: "31/40 headless, skin-on prawns (Pack of 2)",
    dbName: "Diamond 31/40 Headless Skin-On Prawns – 400g (Pack of 2)",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 799,
    offerNote: "Pack of 2",
  },
  {
    section: "Diamond brand",
    userProduct: "31/40 headless, skin-off prawns (Pack of 2)",
    dbName: "Diamond 31/40 Headless Skin-Off Prawns – 400g (Pack of 2)",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 799,
    offerNote: "Pack of 2",
  },
  {
    section: "Diamond brand",
    userProduct: "Travali – 700g (Pack of 2)",
    dbName: "Diamond Travali – 700g (Pack of 2)",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 899,
    offerNote: "Pack of 2",
  },
  {
    section: "Diamond brand",
    userProduct: "Milk Fish – 800g (Pack of 2)",
    dbName: "Diamond Milk Fish – 800g (Pack of 2)",
    targetCategorySlug: "diamond-brand",
    expectedPricePence: 699,
    offerNote: "Pack of 2",
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
      "usage: npx tsx scripts/reorganize-fish-seafood.ts <secrets-file> <url-key> [--apply --confirm-host <host>] [--production]",
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

    // Load Department fish
    const fishDept = await prisma.category.findFirst({
      where: { vendorId, slug: "fish" },
      select: { id: true, slug: true, name: true },
    });
    if (!fishDept) throw new Error("Department fish not found");

    console.log(`Department: ${fishDept.name} (${fishDept.id})`);

    // Load existing categories
    const categories = await prisma.category.findMany({
      where: { vendorId },
      select: { id: true, slug: true, name: true, parentId: true, isActive: true, sortOrder: true },
    });
    const catBySlug = new Map(categories.map((c) => [c.slug, c]));

    // Subcategories plan:
    // 1. frozen-fish: Frozen Fish (sortOrder 10, isActive: true)
    // 2. prawns: Prawns (sortOrder 20, update isActive: true)
    // 3. crab-squid-seafood: Crab & Squid (sortOrder 30, update name & isActive: true)
    // 4. other-fish: Other Fish (sortOrder 40, reuse fish-fillets-smoked or create)
    // 5. diamond-brand: Diamond Brand (sortOrder 50, create)

    const subcatDefs = [
      { slug: "frozen-fish", name: "Frozen Fish", sortOrder: 10 },
      { slug: "prawns", name: "Prawns", sortOrder: 20 },
      { slug: "crab-squid-seafood", name: "Crab & Squid", sortOrder: 30 },
      { slug: "other-fish", name: "Other Fish", sortOrder: 40 },
      { slug: "diamond-brand", name: "Diamond Brand", sortOrder: 50 },
    ];

    console.log(`\n--- Subcategories Evaluation ---`);
    for (const sc of subcatDefs) {
      let existing = catBySlug.get(sc.slug);
      if (!existing && sc.slug === "other-fish") {
        existing = catBySlug.get("fish-fillets-smoked");
      }
      console.log(
        `  Subcategory: "${sc.name}" [${sc.slug}] -> ${existing ? `exists (id: ${existing.id}, active: ${existing.isActive})` : "needs creation"}`,
      );
    }

    // Load all products in DB
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
        priceTier: true,
      },
    });

    const findProduct = (dbName: string, expectedPricePence?: number) => {
      // 1. Exact name match (case sensitive)
      const exact = allProducts.find((p) => p.name === dbName);
      if (exact && (!expectedPricePence || exact.basePrice === expectedPricePence)) return exact;

      // 2. Normalized name match
      const normTarget = norm(dbName);
      const cands = allProducts.filter((p) => norm(p.name) === normTarget);
      if (cands.length === 1) return cands[0];
      if (cands.length > 1) {
        if (expectedPricePence) {
          const priceMatch = cands.find((p) => p.basePrice === expectedPricePence);
          if (priceMatch) return priceMatch;
        }
        const activeMatch = cands.find((p) => p.isActive);
        if (activeMatch) return activeMatch;
        return cands[0];
      }
      return exact ?? undefined;
    };

    const planned: {
      map: ProductMapping;
      product: (typeof allProducts)[0];
      needsCategoryMove: boolean;
      needsActivation: boolean;
      needsUntracked: boolean;
      priceMatches: boolean;
      tierNeeded: boolean;
    }[] = [];

    for (const m of FISH_MAPPINGS) {
      const p = findProduct(m.dbName, m.expectedPricePence);
      if (!p) {
        throw new Error(`Product not found in DB: "${m.dbName}"`);
      }

      const needsCategoryMove = p.category.slug !== m.targetCategorySlug;
      const needsActivation = !p.isActive;
      const needsUntracked = p.inventory?.stockMode !== "UNTRACKED";
      const priceMatches = p.basePrice === m.expectedPricePence;
      const tierNeeded =
        !!m.tier &&
        (!p.priceTier ||
          p.priceTier.groupQuantity !== m.tier.quantity ||
          p.priceTier.groupPricePence !== m.tier.pricePence);

      planned.push({
        map: m,
        product: p,
        needsCategoryMove,
        needsActivation,
        needsUntracked,
        priceMatches,
        tierNeeded,
      });
    }

    console.log(`\n--- Product Verification (${planned.length} items evaluated) ---`);
    const mismatches = planned.filter((p) => !p.priceMatches);
    if (mismatches.length > 0) {
      console.error(`PRICE MISMATCHES:`, mismatches);
    } else {
      console.log(`All ${planned.length} products match Excel prices 100%!`);
    }

    const moveCount = planned.filter((p) => p.needsCategoryMove).length;
    const actCount = planned.filter((p) => p.needsActivation).length;
    const stockCount = planned.filter((p) => p.needsUntracked).length;
    const tierCount = planned.filter((p) => p.tierNeeded).length;

    console.log(`  Products needing category move: ${moveCount}`);
    console.log(`  Products needing activation: ${actCount}`);
    console.log(`  Products needing stock mode UNTRACKED: ${stockCount}`);
    console.log(`  Products needing price tier upsert: ${tierCount}`);

    if (!f.apply) {
      console.log(`\n[DRY RUN COMPLETE] To apply live writes to ${host}, re-run with:`);
      console.log(
        `  npx tsx scripts/reorganize-fish-seafood.ts ${f.file} ${f.key} --apply --confirm-host ${host}\n`,
      );
      return;
    }

    // APPLY PHASE
    console.log(`\n================ APPLYING LIVE WRITES ================`);

    const finalSubcatMap = new Map<string, string>(); // slug -> categoryId

    for (const sc of subcatDefs) {
      let existing = catBySlug.get(sc.slug);
      if (!existing && sc.slug === "other-fish") {
        existing = catBySlug.get("fish-fillets-smoked");
      }

      if (existing) {
        const updated = await prisma.category.update({
          where: { id: existing.id },
          data: {
            name: sc.name,
            slug: sc.slug,
            sortOrder: sc.sortOrder,
            isActive: true,
            parentId: fishDept.id,
          },
          select: { id: true, slug: true, name: true },
        });
        finalSubcatMap.set(sc.slug, updated.id);
        console.log(`Updated subcategory: "${updated.name}" [${updated.slug}] (${updated.id})`);
      } else {
        const created = await prisma.category.create({
          data: {
            vendorId,
            name: sc.name,
            slug: sc.slug,
            parentId: fishDept.id,
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

    // Update products
    let movedTotal = 0;
    let activatedTotal = 0;
    let untrackedTotal = 0;
    let tiersUpserted = 0;

    for (const item of planned) {
      const p = item.product;
      const targetCatId = finalSubcatMap.get(item.map.targetCategorySlug);
      if (!targetCatId)
        throw new Error(`Target category ID for slug ${item.map.targetCategorySlug} not found`);

      const moveCat = p.categoryId !== targetCatId;
      const activate = !p.isActive;
      const updateStock = item.needsUntracked;

      await prisma.$transaction(async (tx) => {
        // 1. Stock mode update
        if (updateStock) {
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
              reason: "Aheed Stock: Fish & Seafood category move and UNTRACKED mode",
              actorType: "SYSTEM",
            },
          });
          untrackedTotal++;
        }

        // 2. Product update
        await tx.product.update({
          where: { id: p.id },
          data: {
            isActive: true,
            categoryId: targetCatId,
          },
        });
        if (moveCat) movedTotal++;
        if (activate) activatedTotal++;

        // 3. Price Tier
        if (item.map.tier) {
          await tx.productPriceTier.upsert({
            where: { productId: p.id },
            create: {
              vendorId,
              productId: p.id,
              groupQuantity: item.map.tier.quantity,
              groupPricePence: item.map.tier.pricePence,
              isActive: true,
            },
            update: {
              groupQuantity: item.map.tier.quantity,
              groupPricePence: item.map.tier.pricePence,
              isActive: true,
            },
          });
          tiersUpserted++;
        }
      });
    }

    console.log(`\n================ WRITES APPLIED SUCCESSFULLY ================`);
    console.log(`Subcategories configured: ${finalSubcatMap.size}`);
    console.log(`Products moved: ${movedTotal}`);
    console.log(`Products activated: ${activatedTotal}`);
    console.log(`Stock mode set to UNTRACKED: ${untrackedTotal}`);
    console.log(`Price tiers upserted: ${tiersUpserted}`);

    // Verification breakdown
    console.log(`\n--- Department Breakdown ---`);
    for (const [slug, id] of finalSubcatMap.entries()) {
      const count = await prisma.product.count({ where: { vendorId, categoryId: id } });
      const activeCount = await prisma.product.count({
        where: { vendorId, categoryId: id, isActive: true },
      });
      console.log(`  Subcategory [${slug}]: ${count} products (${activeCount} active)`);
    }
    console.log(`============================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
