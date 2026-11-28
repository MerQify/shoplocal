/**
 * #1701 — Batch AI image generation for store products lacking real photos.
 *
 *   npx tsx scripts/generate-product-images-ai.ts --env-file <path> [--vendor <slug>] [--status <all|active|inactive>] [--limit <n>] [--apply]
 *
 * Defaults to dry-run mode unless --apply is passed.
 * Iterates through products that lack real photos (including inactive products so photos
 * are ready ahead of activation), generates studio commercial photography via Cloudflare Workers AI,
 * imports them into Merqify Image Hub as PENDING_REVIEW, and links them to the product with imageNeedsReview: true.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { AwsClient } from "aws4fetch";
import { parseEnvFile } from "./lib/env-file";
import { importAsset, type HubCaller } from "../lib/image-hub/client";
import { buildCategoryFallbackPrompt, buildProductStudioPrompt } from "../lib/ai-image-prompts";
import {
  MAX_IMAGE_ATTEMPT_FAILURES,
  PLACEHOLDER_IMAGE_SUFFIX,
  buildProductImageKey,
} from "../lib/product-image";
import { recordImageAttemptFailure, saveGeneratedProductImage } from "../lib/repositories/products";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function printHelp(): void {
  console.log(`
Usage: npx tsx scripts/generate-product-images-ai.ts [options]

Options:
  --env-file <path>              Path to env/vars file (e.g. secrets/merqify-staging.vars)
  --vendor <slug>                Only process products for a specific vendor slug
  --status <all|active|inactive> Filter products by active status (default: all)
  --limit <n>                    Maximum number of products to process (default: 10)
  --dry-run                      Run in dry-run mode without generating or writing (default)
  --apply                        Execute AI generation, metering, Hub import, and product linking
  --help                         Show this help message
`);
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
    async putObject(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
      const res = await client.fetch(objectUrl(key), {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      });
      if (!res.ok) {
        throw new Error(`S3 putObject failed: ${res.status} ${await res.text()}`);
      }
    },
  };
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const envFilePath = argValue("--env-file");
  const fileVars = envFilePath ? parseEnvFile(envFilePath) : {};
  const mergedVars: Record<string, string> = envFilePath
    ? ({ ...process.env, ...fileVars } as Record<string, string>)
    : ({ ...fileVars, ...process.env } as Record<string, string>);

  // Populate process.env so imported modules (e.g. config, workers-ai) see them
  for (const [k, v] of Object.entries(mergedVars)) {
    if (v) process.env[k] = v;
  }

  const isApply = hasFlag("--apply");
  const rawStatus = (argValue("--status") || "all").toLowerCase();
  if (!["all", "active", "inactive"].includes(rawStatus)) {
    console.error(`Invalid --status: "${rawStatus}". Must be "all", "active", or "inactive".`);
    process.exit(1);
  }
  const statusFilter = rawStatus as "all" | "active" | "inactive";

  const rawLimit = argValue("--limit");
  const limit = rawLimit ? parseInt(rawLimit, 10) : 10;
  if (isNaN(limit) || limit < 0) {
    console.error(`Invalid --limit: "${rawLimit}". Must be a non-negative integer.`);
    process.exit(1);
  }

  const vendorSlug = argValue("--vendor");

  const dbUrl = mergedVars.DIRECT_URL || mergedVars.AFC_DIRECT_URL || mergedVars.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DIRECT_URL or DATABASE_URL in environment or env-file.");
    process.exit(1);
  }

  const hubUrl = mergedVars.IMAGE_HUB_URL;
  const hubKey = mergedVars.IMAGE_HUB_API_KEY;
  if (isApply && (!hubUrl || !hubKey)) {
    console.error("Missing IMAGE_HUB_URL or IMAGE_HUB_API_KEY required for --apply mode.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: dbUrl }),
  });

  const { createAiMeter, describeAiBudgetRefusal } = await import("../lib/ai-meter");
  const { getImageGenerationService, IMAGE_GENERATION_MODEL } =
    await import("../lib/image-generation");
  const { getAiEnv } = await import("../lib/config");
  const plan = getAiEnv().WORKERS_AI_PLAN;

  console.log("=== Merqify Image Hub — Batch AI Image Generation ===");
  console.log(
    `Mode:           ${isApply ? "APPLY (Generating & Linking)" : "DRY-RUN (No writes)"}`,
  );
  console.log(`Status filter:  ${statusFilter.toUpperCase()}`);
  console.log(`Limit:          ${limit}`);
  if (vendorSlug) console.log(`Vendor:         ${vendorSlug}`);
  console.log("");

  try {
    const vendors = await prisma.vendor.findMany({
      where: vendorSlug ? { slug: vendorSlug } : undefined,
      select: { id: true, slug: true, name: true },
    });

    if (vendors.length === 0) {
      console.log("No matching vendors found.");
      return;
    }

    let remaining = limit;
    let generatedCount = 0;
    let failedCount = 0;

    const storage = isApply ? createStorageFromVars(mergedVars) : null;

    for (const vendor of vendors) {
      if (remaining <= 0) break;

      const whereClause: {
        vendorId: string;
        images: { every: { storageKey: { endsWith: string } } };
        imageAttemptFailures: { lt: number };
        isActive?: boolean;
      } = {
        vendorId: vendor.id,
        images: { every: { storageKey: { endsWith: PLACEHOLDER_IMAGE_SUFFIX } } },
        imageAttemptFailures: { lt: MAX_IMAGE_ATTEMPT_FAILURES },
      };

      if (statusFilter === "active") whereClause.isActive = true;
      if (statusFilter === "inactive") whereClause.isActive = false;

      const products = await prisma.product.findMany({
        where: whereClause,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: remaining,
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          category: { select: { name: true } },
          description: true,
        },
      });

      if (products.length === 0) {
        console.log(`Vendor ${vendor.slug}: No products needing images.`);
        continue;
      }

      console.log(
        `Vendor ${vendor.slug}: Found ${products.length} product(s) needing photos (status: ${statusFilter}):`,
      );

      const hubCaller: HubCaller | null =
        isApply && hubUrl && hubKey
          ? {
              config: { url: hubUrl, apiKey: hubKey },
              tenant: vendor.slug,
              actor: "cli:generate-product-images-ai",
            }
          : null;

      const aiMeter = createAiMeter(prisma, vendor.id, "PRODUCT_IMAGE", plan);

      for (const prod of products) {
        if (remaining <= 0) break;

        const prompt = buildProductStudioPrompt(prod.name, prod.category?.name, prod.description);
        const statusBadge = prod.isActive ? "[ACTIVE]" : "[INACTIVE]";

        console.log(`\n  • ${statusBadge} ${prod.name} (${prod.category?.name ?? "No category"})`);
        console.log(`    Prompt: "${prompt}"`);

        if (!isApply) {
          remaining--;
          continue;
        }

        // Apply mode: verify AI meter budget first
        const budget = await aiMeter.check();
        if (!budget.allowed) {
          console.warn(`    Budget refusal: ${describeAiBudgetRefusal(budget)}`);
          console.warn("    Stopping batch for this vendor as daily AI budget is exhausted.");
          break;
        }

        try {
          console.log(`    Calling Workers AI (${IMAGE_GENERATION_MODEL})...`);
          const aiSvc = getImageGenerationService();
          const imageBuffer = await aiSvc.generateImage(prompt, {
            fallbackPrompt: buildCategoryFallbackPrompt(
              prod.name,
              prod.category?.name,
              prod.description,
            ),
          });

          if (!imageBuffer) {
            console.error("    AI generation returned null. Recording failure attempt.");
            await recordImageAttemptFailure(prisma, vendor.id, prod.id);
            failedCount++;
            remaining--;
            continue;
          }

          // Spend recording
          await aiMeter.recordImage({ model: IMAGE_GENERATION_MODEL });

          // Import to Merqify Image Hub
          console.log("    Importing generated asset to Merqify Image Hub...");
          const fileName = `ai-${Date.now()}.png`;
          const imported = await importAsset(hubCaller!, {
            file: new Blob([imageBuffer], { type: "image/png" }),
            fileName,
            title: prod.name,
            source: "AI_GENERATED",
            licence: "AI_GENERATED",
            rightsConfirmed: true,
            status: "PENDING_REVIEW",
          });

          if (!imported.ok) {
            console.error(`    Hub import failed: [${imported.code}] ${imported.message}`);
            failedCount++;
            remaining--;
            continue;
          }

          console.log(`    Hub asset created: ${imported.value.asset.id} (PENDING_REVIEW)`);

          // Upload to store bucket & link ProductImage
          if (storage) {
            const key = buildProductImageKey(prod.id, "image/png");
            console.log(`    Uploading to store bucket: ${key}...`);
            await storage.putObject(key, imageBuffer, "image/png");

            await saveGeneratedProductImage(
              prisma,
              vendor.id,
              prod.id,
              key,
              prod.name,
              true,
              "AI_GENERATED",
            );

            // Record hubAssetId on the created ProductImage row
            await prisma.productImage.updateMany({
              where: { productId: prod.id, storageKey: key },
              data: { hubAssetId: imported.value.asset.id },
            });

            console.log(`    Linked to product with imageNeedsReview: true and hubAssetId.`);
          }

          generatedCount++;
          remaining--;
        } catch (err) {
          console.error(
            `    Error processing product ${prod.id}:`,
            err instanceof Error ? err.message : err,
          );
          failedCount++;
          remaining--;
        }
      }
    }

    console.log("\n=== Summary ===");
    if (!isApply) {
      console.log(
        `Dry-run complete. Identified candidates without invoking Workers AI or writing rows.`,
      );
    } else {
      console.log(`Generated and linked: ${generatedCount}`);
      console.log(`Failed:               ${failedCount}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
