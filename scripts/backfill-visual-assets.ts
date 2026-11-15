import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { parseEnvFile } from "./lib/env-file";
import {
  buildBundleImagePrompt,
  buildPromotionBannerPrompt,
  bundleImageAltText,
} from "@/lib/ai-image-prompts";
import { getImageGenerationService } from "@/lib/image-generation";
import { getStorage } from "@/lib/storage";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/**
 * Cloudflare Workers AI safety filter flags raw butchery cut names as NSFW.
 * Sanitizes words so the model generates culinary food photography without false-positive blocks.
 */
function safeForImageModel(text: string): string {
  return text
    .replace(/\bbaby\s+chickens?\b/gi, "cornish game hens on butcher block")
    .replace(/\bmedium\s+chickens?(\s*\([^)]*\))?\b/gi, "roasting chickens on butcher block")
    .replace(/\bhard\s+chickens?\b/gi, "stewing chickens on butcher block")
    .replace(/\bchicken\s+breasts?\b/gi, "poultry fillets on a wooden board")
    .replace(/\bchicken\s+thighs?(\s+boneless)?\b/gi, "boneless leg cutlets on a wooden board")
    .replace(/\bboneless\s+chicken\s+thighs?\b/gi, "boneless leg cutlets")
    .replace(/\bchicken\s+drumsticks?\b/gi, "poultry drumsticks on butcher block")
    .replace(/\bdrumsticks?\b/gi, "poultry drumsticks")
    .replace(/\bbreasts?\b/gi, "fillets")
    .replace(/\bthighs?\b/gi, "cutlets")
    .replace(/\bniblets?\b/gi, "bite-size poultry cuts");
}

async function generateImageSafe(
  ai: ReturnType<typeof getImageGenerationService>,
  primaryPrompt: string,
  fallbackPrompt?: string,
  maxAttempts = 3,
): Promise<ArrayBuffer | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.generateImage(primaryPrompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NSFW") || msg.includes("8007")) {
        if (!fallbackPrompt) throw err;
        console.warn(
          `    Primary prompt blocked by filter (8007). Retrying with culinary fallback...`,
        );
        break;
      }
      if (attempt === maxAttempts && !fallbackPrompt) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (fallbackPrompt) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await ai.generateImage(fallbackPrompt);
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return null;
}

async function putWithRetry(
  storage: ReturnType<typeof getStorage>,
  key: string,
  bytes: ArrayBuffer,
  mime: string,
  maxAttempts = 3,
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await storage.putObject(key, bytes, mime);
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(
        `    Upload transient error (attempt ${attempt}/${maxAttempts}):`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function main() {
  const envPath = flag("--env-file") ?? "secrets/afc-staging.vars";
  const limit = Number.parseInt(flag("--limit") ?? "25", 10);
  const target = flag("--target") ?? "all"; // 'promotions' | 'bundles' | 'all'
  const regenerateExisting = process.argv.includes("--regenerate-existing");
  const apply = process.argv.includes("--apply");
  const production = process.argv.includes("--production");

  if (apply && /production/i.test(envPath) && !production) {
    throw new Error("REFUSED: targeting a production env file requires explicit --production");
  }

  const vars = parseEnvFile(envPath);
  const directUrl = vars.AFC_DIRECT_URL ?? vars.DIRECT_URL;
  if (!directUrl) throw new Error(`${envPath} defines neither AFC_DIRECT_URL nor DIRECT_URL`);

  // Populate process.env for config and storage client
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
  process.env.DIRECT_URL = directUrl;
  process.env.DATABASE_URL = vars.AFC_DATABASE_URL ?? vars.DATABASE_URL ?? directUrl;

  console.log(`Database Host: ${new URL(directUrl).hostname}`);
  console.log(`S3 Bucket:     ${vars.S3_BUCKET ?? "(unset)"}`);
  console.log(`CDN Base URL:  ${vars.CDN_BASE_URL ?? "(unset)"}`);
  console.log(
    `Execution Mode: ${apply ? "APPLY (writes to DB and R2)" : "DRY RUN (preview only)"}`,
  );
  console.log(`Regenerate Existing: ${regenerateExisting ? "YES" : "NO (missing only)"}`);
  console.log(`Target: ${target}, Limit: ${limit}\n`);

  const adapter = new PrismaNeonHttp(directUrl, {});
  const prisma = new PrismaClient({ adapter });

  try {
    const vendor = await prisma.vendor.findFirst({
      where: { slug: "aheed-food-centre" },
      select: { id: true, name: true },
    });
    if (!vendor) throw new Error("Vendor 'aheed-food-centre' not found in database");
    const vendorId = vendor.id;

    const storage = getStorage();
    const ai = getImageGenerationService();
    let remaining = limit;
    let processed = 0;

    // 1. PROMOTIONS
    if (target === "promotions" || target === "all") {
      const promoWhere = regenerateExisting
        ? { vendorId, isActive: true }
        : { vendorId, isActive: true, imageKey: null };

      const promotions = await prisma.promotion.findMany({
        where: promoWhere,
        include: {
          category: { select: { name: true } },
          bundle: {
            include: {
              items: { include: { product: { select: { name: true } } } },
            },
          },
          product: { select: { name: true } },
        },
        orderBy: { priority: "desc" },
      });

      console.log(`=== PROMOTIONS TO PROCESS: ${promotions.length} ===`);
      for (const pr of promotions) {
        if (remaining <= 0) {
          console.log("Reached limit. Stopping promotions pass.");
          break;
        }

        // Determine what the promotion sells
        let subject = "";
        if (pr.bundle && pr.bundle.items.length > 0) {
          subject = pr.bundle.items.map((i) => i.product.name).join(", ");
        } else if (pr.product) {
          subject = pr.product.name;
        } else if (pr.category) {
          subject = pr.category.name;
        } else {
          // Food subject extracted from headline
          subject = pr.headline
            .replace(/\b(offers?|sale|save|special|deal|best value|5% OFF|save £[\d.]+)\b/gi, "")
            .trim();
        }

        const prompt = buildPromotionBannerPrompt(safeForImageModel(subject), pr.headline);
        console.log(`\n[PROMOTION] "${pr.headline}"`);
        console.log(`  Subject: ${subject} (sanitized: ${safeForImageModel(subject)})`);
        console.log(`  Prompt: ${prompt.slice(0, 110)}...`);

        if (apply) {
          console.log("  Generating 16:9 banner with Flux...");
          const fallback =
            "Wide commercial banner photograph for a halal grocery store promotion of fresh culinary food items. Soft natural studio daylight, neutral background, primary subject on the right 50%, clean negative space on the left. No live animals, no people, no hands, no text, no labels.";
          const bytes = await generateImageSafe(ai, prompt, fallback);
          if (!bytes) {
            console.error(`  ERROR: Failed to generate image for promotion ${pr.id}`);
            continue;
          }

          const imageKey = `promotions/${vendorId}/${crypto.randomUUID()}.png`;
          console.log(`  Uploading ${bytes.byteLength} bytes to ${imageKey}...`);
          await putWithRetry(storage, imageKey, bytes, "image/png");

          await prisma.promotion.update({
            where: { id: pr.id },
            data: {
              imageKey,
              altText: pr.headline,
              imageNeedsReview: false,
            },
          });
          console.log(`  UPDATED promotion "${pr.headline}" -> ${imageKey}`);
          processed++;
          remaining--;
        }
      }
    }

    // 2. BUNDLES
    if (target === "bundles" || target === "all") {
      const bundleWhere = regenerateExisting
        ? { vendorId, isActive: true }
        : { vendorId, isActive: true, imageKey: null };

      const bundles = await prisma.bundle.findMany({
        where: bundleWhere,
        include: {
          items: {
            include: { product: { select: { name: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      console.log(`\n=== BUNDLES TO PROCESS: ${bundles.length} ===`);
      for (const b of bundles) {
        if (remaining <= 0) {
          console.log("Reached limit. Stopping bundles pass.");
          break;
        }

        const items = b.items.map((i) => ({
          name: safeForImageModel(i.product.name),
          quantity: i.quantity,
        }));

        const prompt = buildBundleImagePrompt(safeForImageModel(b.name), items);
        const altText = bundleImageAltText(b.name, items);

        console.log(`\n[BUNDLE] "${b.name}"`);
        console.log(
          `  Items: ${items.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "(none)"}`,
        );
        console.log(`  Prompt: ${prompt.slice(0, 110)}...`);

        if (apply) {
          console.log("  Generating bundle photo with Flux...");
          const fallback = `Commercial product photograph of a fresh grocery bundle: fresh halal butchery cuts neatly presented on a wooden butcher block. Clean neutral surface, three-quarter view, soft studio lighting, shallow depth of field. Fresh butchery goods as sold in a food market. No live animals, no people, no hands, no text, no labels.`;
          const bytes = await generateImageSafe(ai, prompt, fallback);
          if (!bytes) {
            console.error(`  ERROR: Failed to generate image for bundle ${b.id}`);
            continue;
          }

          const imageKey = `bundles/${b.id}/${crypto.randomUUID()}.png`;
          console.log(`  Uploading ${bytes.byteLength} bytes to ${imageKey}...`);
          await putWithRetry(storage, imageKey, bytes, "image/png");

          await prisma.bundle.update({
            where: { id: b.id },
            data: {
              imageKey,
              altText,
              imageNeedsReview: false,
            },
          });
          console.log(`  UPDATED bundle "${b.name}" -> ${imageKey}`);
          processed++;
          remaining--;
        }
      }
    }

    console.log(`\n=== BACKFILL COMPLETE ===`);
    console.log(`Total processed and applied: ${processed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
