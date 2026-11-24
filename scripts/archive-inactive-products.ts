import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readVar } from "./aheed-data-inventory";

/**
 * scripts/archive-inactive-products.ts
 *
 * Moves all inactive products (isActive = false) for Aheed Food Centre to the
 * "Archived" category (slug: "archived", id: "e4bd4a16-3e57-44ed-a0d3-b8ea8f77f048").
 *
 * Safety & Invariants:
 *  - Active products (444) are completely untouched.
 *  - Category breakdown for active products remains 100% identical.
 *  - "Archived" category remains isActive = false (hidden from storefront).
 *  - Requires explicit --apply and --confirm-host flags when targeting production.
 *
 * Usage:
 *  Dry-run:
 *    npx tsx scripts/archive-inactive-products.ts secrets/afc-staging.vars AFC_DIRECT_URL
 *  Apply Staging:
 *    npx tsx scripts/archive-inactive-products.ts secrets/afc-staging.vars AFC_DIRECT_URL --apply
 *  Apply Production:
 *    npx tsx scripts/archive-inactive-products.ts secrets/afc-production.vars AFC_DIRECT_URL --apply --confirm-host ep-weathered-leaf-zaowczwa.c-2.eu-west-2.aws.neon.tech --production
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

const VENDOR_ID = "a4ed0000-0000-4000-a000-000000000001";
const ARCHIVED_CATEGORY_SLUG = "archived";

async function main() {
  const f = flags(process.argv.slice(2));
  if (!f.file || !f.key) {
    console.error(
      "Usage: npx tsx scripts/archive-inactive-products.ts <secrets-file> <url-key> [--apply] [--confirm-host <host>] [--production]",
    );
    process.exit(1);
  }

  const url = readVar(f.file, f.key);
  if (!url) {
    console.error(`Error: Key "${f.key}" not found in "${f.file}"`);
    process.exit(1);
  }

  const actualHost = url.match(/@([^:/?]+)/)?.[1];
  console.log(`\n============================================================`);
  console.log(`Database Host: ${actualHost}`);
  console.log(`MODE: ${f.apply ? "APPLY (live database writes)" : "DRY RUN (no database writes)"}`);
  console.log(`============================================================\n`);

  if (f.apply && f.production) {
    if (!f.confirmHost || f.confirmHost !== actualHost) {
      console.error(
        `Refusing production write: --confirm-host "${f.confirmHost}" does not match actual host "${actualHost}"`,
      );
      process.exit(1);
    }
  }

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: VENDOR_ID },
      select: { id: true, name: true, slug: true },
    });
    if (!vendor) {
      throw new Error(`Vendor not found with id ${VENDOR_ID}`);
    }

    // 1. Locate or verify Archived category
    let archivedCat = await prisma.category.findFirst({
      where: { vendorId: vendor.id, slug: ARCHIVED_CATEGORY_SLUG },
    });

    if (!archivedCat) {
      throw new Error(`Archived category with slug "${ARCHIVED_CATEGORY_SLUG}" not found!`);
    }

    console.log(
      `Archived Category: "${archivedCat.name}" (id: ${archivedCat.id}, slug: ${archivedCat.slug}, isActive: ${archivedCat.isActive})`,
    );

    // 2. Pre-flight checks
    const initialActive = await prisma.product.count({
      where: { vendorId: vendor.id, isActive: true },
    });
    const totalInactive = await prisma.product.count({
      where: { vendorId: vendor.id, isActive: false },
    });
    const inactiveAlreadyArchived = await prisma.product.count({
      where: { vendorId: vendor.id, isActive: false, categoryId: archivedCat.id },
    });
    const inactiveToMove = await prisma.product.count({
      where: { vendorId: vendor.id, isActive: false, categoryId: { not: archivedCat.id } },
    });

    console.log(`\nCurrent Product Counts:`);
    console.log(`  Active products:             ${initialActive}`);
    console.log(`  Total inactive products:     ${totalInactive}`);
    console.log(`  Already in "Archived":       ${inactiveAlreadyArchived}`);
    console.log(`  To be moved to "Archived":   ${inactiveToMove}\n`);

    // Breakdown of categories where inactive products currently reside
    const inactiveByCategory = await prisma.category.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: {
          select: {
            products: { where: { isActive: false } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    console.log("Inactive Products by Current Category (Top):");
    const categoriesWithInactive = inactiveByCategory.filter(
      (c) => c._count.products > 0 && c.id !== archivedCat.id,
    );
    for (const c of categoriesWithInactive) {
      console.log(
        `  - [${c.slug.padEnd(25)}] "${c.name.padEnd(25)}" : ${c._count.products} inactive products`,
      );
    }
    console.log(
      `Total categories with inactive products to move: ${categoriesWithInactive.length}\n`,
    );

    if (!f.apply) {
      console.log(
        `[DRY RUN] Would move ${inactiveToMove} inactive products to "Archived" (${archivedCat.id}).`,
      );
      console.log(`[DRY RUN] Active products (${initialActive}) would remain untouched.`);
      console.log(`\nTo apply changes, run with --apply.`);
      return;
    }

    // 3. Execution
    console.log(
      `Applying batch update: moving ${inactiveToMove} inactive products to "Archived"...`,
    );
    const updateResult = await prisma.product.updateMany({
      where: {
        vendorId: vendor.id,
        isActive: false,
        categoryId: { not: archivedCat.id },
      },
      data: {
        categoryId: archivedCat.id,
      },
    });

    console.log(`Updated rows count: ${updateResult.count}`);

    // 4. Post-execution Verification
    const postActive = await prisma.product.count({
      where: { vendorId: vendor.id, isActive: true },
    });
    const postArchivedInactive = await prisma.product.count({
      where: { vendorId: vendor.id, isActive: false, categoryId: archivedCat.id },
    });
    const postRemainingOutside = await prisma.product.count({
      where: { vendorId: vendor.id, isActive: false, categoryId: { not: archivedCat.id } },
    });

    console.log(`\n================== VERIFICATION ==================`);
    console.log(
      `Active Products (must be ${initialActive}): ${postActive} -> ${postActive === initialActive ? "PASS" : "FAIL"}`,
    );
    console.log(
      `Archived Inactive Products: ${postArchivedInactive} -> ${postArchivedInactive === totalInactive ? "PASS" : "FAIL"}`,
    );
    console.log(
      `Inactive Products Outside "Archived": ${postRemainingOutside} -> ${postRemainingOutside === 0 ? "PASS" : "FAIL"}`,
    );
    console.log(`==================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
