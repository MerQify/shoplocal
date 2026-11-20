/**
 * #1674 — Import existing store catalogue images into Merqify Image Hub.
 *
 *   npx tsx scripts/import-images-to-hub.ts --env-file <path> [--vendor <slug>] [--limit <n>] [--apply]
 *
 * Defaults to dry-run mode unless --apply is passed.
 * Iterates through ProductImage and CategoryAsset records with null hubAssetId,
 * fetches their bytes from store S3/R2 storage, maps their provenance, imports them into the Image Hub,
 * and updates hubAssetId (and hubUsageId for approved usages).
 */
import { PrismaClient, ProductImageSource } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { AwsClient } from "aws4fetch";
import { parseEnvFile } from "./lib/env-file";
import {
  importAsset,
  recordUsage,
  type HubCaller,
  type HubLicence,
  type HubSource,
  type HubStatus,
} from "../lib/image-hub/client";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function createStorageFromVars(vars: Record<string, string>) {
  const client = new AwsClient({
    accessKeyId: vars.S3_ACCESS_KEY ?? "",
    secretAccessKey: vars.S3_SECRET_KEY ?? "",
    region: vars.S3_REGION ?? "auto",
    service: "s3",
  });
  const endpoint = vars.S3_ENDPOINT?.replace(/\/+$/, "");
  const bucket = vars.S3_BUCKET;
  const base = `${endpoint}/${bucket}`;
  const objectUrl = (key: string) => `${base}/${key.replace(/^\/+/, "")}`;

  return {
    async getObject(key: string): Promise<ArrayBuffer | null> {
      try {
        const res = await client.fetch(objectUrl(key), { method: "GET" });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`storage getObject failed: ${res.status}`);
        return await res.arrayBuffer();
      } catch (err) {
        console.error(`Failed to fetch storage key: ${key}`, err);
        return null;
      }
    },
  };
}

export function mapProductImageProvenance(source: ProductImageSource): {
  source: HubSource;
  licence: HubLicence;
  attribution: string | null;
  sourceSite: string | null;
  rightsConfirmed: boolean;
} {
  switch (source) {
    case ProductImageSource.AI_GENERATED:
      return {
        source: "AI_GENERATED",
        licence: "AI_GENERATED",
        attribution: null,
        sourceSite: null,
        rightsConfirmed: true,
      };
    case ProductImageSource.OPEN_FOOD_FACTS:
      return {
        source: "OPEN_FOOD_FACTS",
        licence: "CC_BY_SA",
        attribution: "Open Food Facts contributors",
        sourceSite: "Open Food Facts",
        rightsConfirmed: true,
      };
    case ProductImageSource.STAFF_UPLOAD:
    case ProductImageSource.STAFF_CONFIRMED_PHOTO:
    case ProductImageSource.UNKNOWN:
    default:
      return {
        source: "UPLOAD",
        licence: "OWNER_SUPPLIED",
        attribution: null,
        sourceSite: null,
        rightsConfirmed: true,
      };
  }
}

async function main(): Promise<number> {
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(
      "Usage: npx tsx scripts/import-images-to-hub.ts --env-file <path> [--vendor <slug>] [--limit <n>] [--apply]",
    );
    return 0;
  }

  const envPath = argValue("--env-file");
  if (!envPath) {
    console.error("Usage: npx tsx scripts/import-images-to-hub.ts --env-file <path> [...]");
    return 2;
  }

  const vars = parseEnvFile(envPath);
  const directUrl = vars.DIRECT_URL ?? vars.AFC_DIRECT_URL;
  if (!directUrl) {
    console.error(`${envPath} defines neither DIRECT_URL nor AFC_DIRECT_URL`);
    return 2;
  }

  const hubUrl = vars.IMAGE_HUB_URL?.replace(/\/+$/, "");
  const hubApiKey = vars.IMAGE_HUB_API_KEY;
  if (!hubUrl || !hubApiKey) {
    console.error(`${envPath} defines neither IMAGE_HUB_URL nor IMAGE_HUB_API_KEY`);
    return 2;
  }

  const vendorSlugFilter = argValue("--vendor");
  const limitArg = argValue("--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  const apply = hasFlag("--apply");

  console.log(`Database: ${new URL(directUrl).hostname}`);
  console.log(`Hub URL:  ${hubUrl}`);
  console.log(`Mode:     ${apply ? "APPLY (live writes)" : "DRY RUN (no mutations)"}`);
  if (vendorSlugFilter) console.log(`Vendor:   ${vendorSlugFilter}`);
  if (limit) console.log(`Limit:    ${limit}`);

  const storage = createStorageFromVars(vars);
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: directUrl }) });

  try {
    const vendors = await prisma.vendor.findMany({
      where: vendorSlugFilter ? { slug: vendorSlugFilter } : undefined,
      select: { id: true, slug: true, name: true },
    });

    if (!vendors.length) {
      console.log("No matching vendors found.");
      return 0;
    }

    let processedCount = 0;
    let importedCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;

    for (const vendor of vendors) {
      console.log(`\n=== Vendor: ${vendor.name} (${vendor.slug}) ===`);
      const caller: HubCaller = {
        config: { url: hubUrl, apiKey: hubApiKey },
        tenant: vendor.slug,
        actor: "import-script",
      };

      // 1. Process Product Images
      const productImages = await prisma.productImage.findMany({
        where: {
          product: { vendorId: vendor.id },
          hubAssetId: null,
          source: { not: ProductImageSource.PLACEHOLDER },
        },
        include: {
          product: {
            select: { id: true, name: true, imageNeedsReview: true },
          },
        },
        orderBy: { sortOrder: "asc" },
        take: limit ? Math.max(0, limit - processedCount) : undefined,
      });

      console.log(`Found ${productImages.length} product image(s) to import.`);

      for (const img of productImages) {
        if (limit && processedCount >= limit) break;
        processedCount++;

        if (img.storageKey.endsWith("placeholder.svg")) {
          skippedCount++;
          continue;
        }

        const provenance = mapProductImageProvenance(img.source);
        const status: HubStatus = img.product.imageNeedsReview ? "PENDING_REVIEW" : "APPROVED";
        const title = img.product.name;
        const alt = img.alt || img.product.name;
        const fileName = img.storageKey.split("/").pop() ?? "image.webp";

        if (!apply) {
          console.log(
            `  [DRY-RUN] Product: "${title}" | Key: ${img.storageKey} | Source: ${provenance.source} | Status: ${status}`,
          );
          continue;
        }

        const bytes = await storage.getObject(img.storageKey);
        if (!bytes || bytes.byteLength === 0) {
          console.warn(`  [WARN] Storage object missing or empty: ${img.storageKey}`);
          skippedCount++;
          continue;
        }

        const blob = new Blob([bytes]);
        const importRes = await importAsset(caller, {
          file: blob,
          fileName,
          title,
          source: provenance.source,
          licence: provenance.licence,
          attribution: provenance.attribution,
          sourceSite: provenance.sourceSite,
          alt,
          status,
          rightsConfirmed: provenance.rightsConfirmed,
        });

        if (!importRes.ok) {
          console.error(
            `  [FAILED] ${title} (${img.storageKey}): ${importRes.code} - ${importRes.message}`,
          );
          continue;
        }

        const { asset, duplicate } = importRes.value;
        if (duplicate) {
          duplicateCount++;
          console.log(`  [DUPLICATE] ${title} matched existing asset: ${asset.id}`);
        } else {
          importedCount++;
          console.log(`  [IMPORTED] ${title} -> asset ${asset.id} (${status})`);
        }

        // Update database with hubAssetId
        await prisma.productImage.update({
          where: { id: img.id },
          data: { hubAssetId: asset.id },
        });

        // If approved, record usage
        if (asset.status === "APPROVED") {
          const usageRes = await recordUsage(caller, asset.id, {
            kind: "PRODUCT",
            externalId: img.product.id,
          });
          if (usageRes.ok) {
            await prisma.productImage.update({
              where: { id: img.id },
              data: { hubUsageId: usageRes.value.id },
            });
          }
        }
      }

      // 2. Process Category Assets
      if (!limit || processedCount < limit) {
        const categoryAssets = await prisma.categoryAsset.findMany({
          where: {
            vendorId: vendor.id,
            hubAssetId: null,
          },
          include: {
            category: { select: { id: true, name: true } },
          },
          take: limit ? Math.max(0, limit - processedCount) : undefined,
        });

        console.log(`Found ${categoryAssets.length} category asset(s) to import.`);

        for (const cat of categoryAssets) {
          if (limit && processedCount >= limit) break;
          processedCount++;

          const isAi = cat.style === "3d-icon";
          const provenance = {
            source: (isAi ? "AI_GENERATED" : "UPLOAD") as HubSource,
            licence: (isAi ? "AI_GENERATED" : "OWNER_SUPPLIED") as HubLicence,
            rightsConfirmed: true,
          };
          const status: HubStatus = cat.isSelected ? "APPROVED" : "PENDING_REVIEW";
          const title = cat.category?.name ?? cat.slot ?? "Category Image";
          const fileName = cat.storageKey.split("/").pop() ?? "category.webp";

          if (!apply) {
            console.log(
              `  [DRY-RUN] Category: "${title}" | Key: ${cat.storageKey} | Source: ${provenance.source} | Status: ${status}`,
            );
            continue;
          }

          const bytes = await storage.getObject(cat.storageKey);
          if (!bytes || bytes.byteLength === 0) {
            console.warn(`  [WARN] Storage object missing: ${cat.storageKey}`);
            skippedCount++;
            continue;
          }

          const blob = new Blob([bytes]);
          const importRes = await importAsset(caller, {
            file: blob,
            fileName,
            title,
            source: provenance.source,
            licence: provenance.licence,
            status,
            rightsConfirmed: true,
          });

          if (!importRes.ok) {
            console.error(
              `  [FAILED] ${title} (${cat.storageKey}): ${importRes.code} - ${importRes.message}`,
            );
            continue;
          }

          const { asset, duplicate } = importRes.value;
          if (duplicate) duplicateCount++;
          else importedCount++;

          console.log(`  [CATEGORY] ${title} -> asset ${asset.id} (${status})`);

          await prisma.categoryAsset.update({
            where: { id: cat.id },
            data: { hubAssetId: asset.id },
          });

          if (asset.status === "APPROVED" && cat.categoryId) {
            const usageRes = await recordUsage(caller, asset.id, {
              kind: "CATEGORY",
              externalId: cat.categoryId,
            });
            if (usageRes.ok) {
              await prisma.categoryAsset.update({
                where: { id: cat.id },
                data: { hubUsageId: usageRes.value.id },
              });
            }
          }
        }
      }
    }

    console.log("\n================ SUMMARY ================");
    console.log(`Total items evaluated: ${processedCount}`);
    if (apply) {
      console.log(`Newly imported:        ${importedCount}`);
      console.log(`Duplicate matches:     ${duplicateCount}`);
      console.log(`Skipped / missing:     ${skippedCount}`);
    } else {
      console.log("Run with --apply to perform the live migration.");
    }

    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("import-images-to-hub.ts")) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
