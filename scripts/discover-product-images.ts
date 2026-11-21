/**
 * #1697 — Batch image discovery for store products missing photos.
 *
 *   npx tsx scripts/discover-product-images.ts [--env-file <path>] [--vendor <slug>] [--provider <name>] [--limit <n>] [--apply]
 *
 * Defaults to dry-run mode unless --apply is passed.
 * Iterates through products that lack photos, queries open-licensed repositories
 * (Openverse, Wikimedia Commons, Open Food Facts), and imports top candidates into the Image Hub as PENDING_REVIEW.
 */
import { PrismaClient, ProductImageSource } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { parseEnvFile } from "./lib/env-file";
import { downloadDiscoveredImage } from "../lib/image-discovery/download";
import { searchDiscoveredImages } from "../lib/image-discovery/service";
import type { DiscoveredImage, DiscoveryProvider } from "../lib/image-discovery/types";
import { importAsset, type HubCaller } from "../lib/image-hub/client";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function printHelp(): void {
  console.log(`
Usage: npx tsx scripts/discover-product-images.ts [options]

Options:
  --env-file <path>   Path to env/vars file (e.g. secrets/merqify-staging.vars, .env)
  --vendor <slug>     Only process products for a specific vendor slug
  --provider <name>   Filter by provider: ALL, OPENVERSE, WIKIMEDIA, OPEN_FOOD_FACTS (default: ALL)
  --limit <n>         Maximum number of products to process (default: 20)
  --apply             Execute the import (default is dry-run)
  --help              Show this help message
`);
}

async function main() {
  if (hasFlag("--help")) {
    printHelp();
    return;
  }

  const envFilePath = argValue("--env-file");
  const fileVars = envFilePath ? parseEnvFile(envFilePath) : {};
  const mergedVars = envFilePath
    ? { ...process.env, ...fileVars }
    : { ...fileVars, ...process.env };

  const dbUrl = mergedVars.DIRECT_URL || mergedVars.AFC_DIRECT_URL || mergedVars.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DIRECT_URL or DATABASE_URL in environment or env-file.");
    process.exit(1);
  }

  const hubUrl = mergedVars.IMAGE_HUB_URL;
  const hubKey = mergedVars.IMAGE_HUB_API_KEY;
  if (!hubUrl || !hubKey) {
    console.error("Missing IMAGE_HUB_URL or IMAGE_HUB_API_KEY.");
    process.exit(1);
  }

  const apply = hasFlag("--apply");
  const vendorSlug = argValue("--vendor");
  const provider = (argValue("--provider")?.toUpperCase() as DiscoveryProvider | "ALL") || "ALL";
  const limit = parseInt(argValue("--limit") || "20", 10);

  console.log(`--- Merqify Image Hub: Licensed Discovery CLI ---`);
  console.log(`Mode:     ${apply ? "LIVE (--apply)" : "DRY RUN (no writes)"}`);
  console.log(`Hub:      ${hubUrl}`);
  console.log(`Provider: ${provider}`);
  console.log(`Limit:    ${limit} products`);
  if (vendorSlug) console.log(`Vendor:   ${vendorSlug}`);
  console.log(`-------------------------------------------------\n`);

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: dbUrl }),
  });

  const caller: HubCaller = {
    config: { url: hubUrl, apiKey: hubKey },
    tenant: vendorSlug || "cli-discovery",
    actor: "system:cli-discovery",
  };

  try {
    const products = await prisma.product.findMany({
      where: {
        ...(vendorSlug ? { vendor: { slug: vendorSlug } } : {}),
        isActive: true,
        images: {
          none: {
            source: {
              not: ProductImageSource.PLACEHOLDER,
            },
          },
        },
      },
      take: limit,
      include: {
        vendor: { select: { slug: true } },
      },
    });

    console.log(`Found ${products.length} active products lacking real photography.\n`);

    let candidateCount = 0;
    let importedCount = 0;

    for (const product of products) {
      console.log(`[Product] ${product.name} (ID: ${product.id}, Vendor: ${product.vendor.slug})`);

      const searchRes = await searchDiscoveredImages({
        query: product.name,
        provider,
        limit: 3,
      });

      if (!searchRes.items.length) {
        console.log(`  -> No open-licensed matches found.`);
        continue;
      }

      candidateCount++;
      const topMatch: DiscoveredImage = searchRes.items[0]!;
      console.log(`  -> Match: "${topMatch.title}"`);
      console.log(`     Source:      ${topMatch.provider} (${topMatch.sourceSite})`);
      console.log(`     Licence:     ${topMatch.licence}`);
      console.log(`     Attribution: ${topMatch.attribution}`);
      console.log(`     URL:         ${topMatch.originalUrl}`);

      if (apply) {
        try {
          const { file, extension } = await downloadDiscoveredImage(topMatch);

          const importRes = await importAsset(caller, {
            file,
            fileName: `${topMatch.provider.toLowerCase()}-${product.id.slice(0, 8)}.${extension}`,
            title: `${product.name} — ${topMatch.title}`,
            source: topMatch.provider,
            licence: topMatch.licence,
            attribution: topMatch.attribution,
            originalUrl: topMatch.originalUrl,
            sourceSite: topMatch.sourceSite,
            rightsConfirmed: true,
            status: "PENDING_REVIEW",
          });

          if (!importRes.ok) {
            console.error(`     Failed to import to hub: ${importRes.message}`);
            continue;
          }

          importedCount++;
          console.log(
            `     Imported to Hub -> Asset ID: ${importRes.value.asset.id} (Status: ${importRes.value.asset.status})`,
          );
        } catch (err) {
          console.error(`     Error importing:`, err);
        }
      } else {
        console.log(`     [Dry run] Would import to Hub as PENDING_REVIEW.`);
      }

      console.log("");
    }

    console.log(`\nSummary:`);
    console.log(`  Products checked:     ${products.length}`);
    console.log(`  Products with match:  ${candidateCount}`);
    if (apply) {
      console.log(`  Images imported:      ${importedCount}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("discover-product-images.ts")) {
  main().catch((err) => {
    console.error("Discovery run failed:", err);
    process.exit(1);
  });
}
