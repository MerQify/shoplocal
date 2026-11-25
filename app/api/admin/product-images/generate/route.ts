import { requireVendorRole } from "@/lib/auth-rbac";
import { runProductImagePipeline } from "@/lib/product-image-pipeline";
import {
  generateProductImages,
  saveGeneratedProductImage,
  type GenerateProductImagesParams,
} from "@/lib/products-service";
import { NextResponse } from "next/server";
import { describeAiBudgetRefusal } from "@/lib/ai-meter";
import { getVendorAiMeter } from "@/lib/ai-meter-service";

export async function POST(request: Request) {
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as any;

    // 1. Backward-compatible single-product flow (e.g. ProductImageManager & unit test expectations)
    if (body.productId && body.productName && !body.mode) {
      const result = await runProductImagePipeline(body.productId, body.productName, null, {
        useOpenFoodFacts: body.useOpenFoodFacts ?? true,
        aiMeter: getVendorAiMeter(auth.vendorId, "PRODUCT_IMAGE"),
      });
      if (result && "budgetRefused" in result) {
        return NextResponse.json(
          { error: describeAiBudgetRefusal(result.budgetRefused) },
          { status: 429 },
        );
      }
      if (!result) {
        return NextResponse.json({ error: "Failed to fetch or generate image" }, { status: 500 });
      }

      await saveGeneratedProductImage(
        auth.vendorId,
        body.productId,
        result.imageKey,
        body.productName,
        result.needsReview,
        result.source,
      );

      return NextResponse.json(result);
    }

    // 2. Generic targeted image generation (selected, single, filtered, all_missing, retry_failed)
    const mode =
      body.mode ??
      (body.productIds?.length ? "selected" : body.productId ? "single" : "all_missing");

    const params: GenerateProductImagesParams = {
      target: {
        mode,
        productIds: body.productIds,
        productId: body.productId,
        filters: body.filters,
        limit: body.limit,
      },
      options: {
        useOpenFoodFacts: body.useOpenFoodFacts !== false,
        overwriteExisting: body.overwriteExisting === true,
        retryFailed: body.retryFailed === true || mode === "retry_failed",
      },
    };

    const result = await generateProductImages(auth.vendorId, params);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
