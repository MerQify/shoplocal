/**
 * Pre-builds and refreshes Cloudflare-native metadata cache for all vendors.
 *
 * Usage:
 *   npx tsx scripts/refresh-metadata-cache.ts
 *
 * Can be run locally, in CI deployment workflows (post-release), or triggered manually.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  refreshVendorMetadata,
  getCategoriesCacheKey,
  getBrandsCacheKey,
  getNavigationCacheKey,
} from "../lib/cloudflare-metadata";

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) {
    throw new Error("DATABASE_URL or DIRECT_URL is required to run metadata refresh script");
  }
  return url;
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const cdnBaseUrl = process.env.CDN_BASE_URL ?? null;

  console.log("[refresh-metadata] Connecting to database...");
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter }) as any;

  try {
    const vendors = await prisma.vendor.findMany({
      select: { id: true, name: true, slug: true },
    });

    console.log(`[refresh-metadata] Found ${vendors.length} vendor(s) to process.`);

    for (const vendor of vendors) {
      console.log(`\n--- Vendor: ${vendor.name} (${vendor.id}) ---`);
      const result = await refreshVendorMetadata(prisma, vendor.id, cdnBaseUrl);
      console.log(
        `  Categories: ${result.categoriesCount} nodes cached at key "${getCategoriesCacheKey(vendor.id)}"`,
      );
      console.log(
        `  Visible Brands: ${result.brandsCount} brands cached at key "${getBrandsCacheKey(vendor.id)}"`,
      );
      console.log(
        `  Navigation: ${result.navigationCount} department entries cached at key "${getNavigationCacheKey(vendor.id)}"`,
      );
    }

    console.log(
      `\n[refresh-metadata] All ${vendors.length} vendor(s) metadata refreshed successfully!`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[refresh-metadata] Fatal error:", err);
  process.exit(1);
});
