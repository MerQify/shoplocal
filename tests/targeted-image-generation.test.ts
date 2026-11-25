import { beforeEach, describe, expect, it, vi } from "vitest";

const REFUSED = {
  allowed: false,
  scope: "vendor" as const,
  usedNeurons: 3000,
  budgetNeurons: 3000,
};

const check = vi.fn(async () => ({
  allowed: true,
  scope: "vendor" as const,
  usedNeurons: 0,
  budgetNeurons: 3000,
}));

const recordImage = vi.fn(async () => {});
const createAiMeter = vi.fn((_prisma: unknown, _vendorId: string, _feature: string) => ({
  check,
  record: vi.fn(),
  recordImage,
}));

const runProductImagePipeline = vi.fn();
const recordImageAttemptFailure = vi.fn(async () => {});
const saveGeneratedProductImage = vi.fn(async () => {});
const findTargetProductsForImage = vi.fn();

vi.mock("@/lib/auth-rbac", () => ({
  requireVendorRole: vi.fn(async () => ({ ok: true, vendorId: "v1", via: "VENDOR" })),
}));

vi.mock("@/lib/ai-meter-service", () => ({
  getVendorAiMeter: (vendorId: string, feature: string) => createAiMeter({}, vendorId, feature),
}));

vi.mock("@/lib/product-image-pipeline", () => ({ runProductImagePipeline }));

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({}),
  getPrismaWs: () => ({}),
}));

vi.mock("@/lib/repositories/products", () => ({
  findTargetProductsForImage,
  recordImageAttemptFailure,
  saveGeneratedProductImage,
  getProductsWithoutImages: vi.fn(),
}));

const { generateProductImages } = await import("@/lib/products-service");
const generateRoute = await import("@/app/api/admin/product-images/generate/route");

const post = (body: unknown) =>
  new Request("http://localhost/api/admin/product-images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  check.mockResolvedValue({
    allowed: true,
    scope: "vendor" as const,
    usedNeurons: 0,
    budgetNeurons: 3000,
  });
});

describe("generateProductImages (generic targeted image generation)", () => {
  it("handles empty selection immediately without querying the database", async () => {
    const result = await generateProductImages("v1", {
      target: { mode: "selected", productIds: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("No products selected");
    expect(findTargetProductsForImage).not.toHaveBeenCalled();
    expect(runProductImagePipeline).not.toHaveBeenCalled();
  });

  it("de-duplicates product IDs in selected mode", async () => {
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Halal Beef",
        plu: "123",
        barcode: null,
        imageAttemptFailures: 0,
        images: [{ id: "i1", storageKey: "products/p1/main.svg", isPrimary: true }],
      },
    ]);

    runProductImagePipeline.mockResolvedValueOnce({
      imageKey: "products/p1/uuid.webp",
      needsReview: true,
      source: "OPEN_FOOD_FACTS",
    });

    const result = await generateProductImages("v1", {
      target: { mode: "selected", productIds: ["p1", "p1", "p1"] },
    });

    expect(result.ok).toBe(true);
    expect(findTargetProductsForImage).toHaveBeenCalledTimes(1);
    const callArgs = findTargetProductsForImage.mock.calls[0][2];
    expect(callArgs.productIds).toEqual(["p1"]);
    expect(result.succeeded).toBe(1);
  });

  it("skips products that already have real images unless overwriteExisting is true", async () => {
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Paneer (has image)",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [{ id: "img-real", storageKey: "products/p1/photo.webp", isPrimary: true }],
      },
      {
        id: "p2",
        name: "Atta (placeholder only)",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [{ id: "img-ph", storageKey: "products/p2/main.svg", isPrimary: true }],
      },
    ]);

    runProductImagePipeline.mockResolvedValueOnce({
      imageKey: "products/p2/uuid.webp",
      needsReview: true,
      source: "AI_GENERATED",
    });

    const result = await generateProductImages("v1", {
      target: { mode: "selected", productIds: ["p1", "p2"] },
      options: { overwriteExisting: false },
    });

    expect(result.totalTargeted).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.details.skipped[0]).toEqual({
      id: "p1",
      name: "Paneer (has image)",
      reason: "Already has an image",
    });
    expect(result.succeeded).toBe(1);
    expect(runProductImagePipeline).toHaveBeenCalledTimes(1);
    expect(runProductImagePipeline).toHaveBeenCalledWith("p2", "Atta (placeholder only)", null, expect.any(Object));
  });

  it("overwrites existing images when overwriteExisting is true", async () => {
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Paneer (has image)",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [{ id: "img-real", storageKey: "products/p1/photo.webp", isPrimary: true }],
      },
    ]);

    runProductImagePipeline.mockResolvedValueOnce({
      imageKey: "products/p1/new-uuid.webp",
      needsReview: true,
      source: "AI_GENERATED",
    });

    const result = await generateProductImages("v1", {
      target: { mode: "single", productId: "p1" },
      options: { overwriteExisting: true },
    });

    expect(result.succeeded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(saveGeneratedProductImage).toHaveBeenCalledWith(
      expect.anything(),
      "v1",
      "p1",
      "products/p1/new-uuid.webp",
      "Paneer (has image)",
      true,
      "AI_GENERATED",
    );
  });

  it("handles partial failure without aborting the batch", async () => {
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Doomed Product",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [],
      },
      {
        id: "p2",
        name: "Good Product",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [],
      },
    ]);

    runProductImagePipeline
      .mockRejectedValueOnce(new Error("AI service timed out"))
      .mockResolvedValueOnce({
        imageKey: "products/p2/ok.webp",
        needsReview: true,
        source: "AI_GENERATED",
      });

    const result = await generateProductImages("v1", {
      target: { mode: "selected", productIds: ["p1", "p2"] },
    });

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.details.failed[0]).toEqual({
      id: "p1",
      name: "Doomed Product",
      error: "AI service timed out",
    });
    expect(recordImageAttemptFailure).toHaveBeenCalledWith(expect.anything(), "v1", "p1");
    expect(saveGeneratedProductImage).toHaveBeenCalledWith(
      expect.anything(),
      "v1",
      "p2",
      "products/p2/ok.webp",
      "Good Product",
      true,
      "AI_GENERATED",
    );
  });

  it("stops immediately when AI budget check refuses without penalizing remaining products", async () => {
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Product 1",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [],
      },
      {
        id: "p2",
        name: "Product 2",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [],
      },
    ]);

    runProductImagePipeline.mockResolvedValueOnce({ budgetRefused: REFUSED });

    const result = await generateProductImages("v1", {
      target: { mode: "selected", productIds: ["p1", "p2"] },
    });

    expect(result.budgetRefused).toBe(true);
    expect(result.succeeded).toBe(0);
    // Should NOT record failure for products stopped due to budget
    expect(recordImageAttemptFailure).not.toHaveBeenCalled();
    expect(runProductImagePipeline).toHaveBeenCalledTimes(1);
  });

  it("allows retrying failed generations when retryFailed is true", async () => {
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Exhausted Product",
        plu: null,
        barcode: null,
        imageAttemptFailures: 3, // At limit
        images: [],
      },
    ]);

    runProductImagePipeline.mockResolvedValueOnce({
      imageKey: "products/p1/retry-success.webp",
      needsReview: true,
      source: "OPEN_FOOD_FACTS",
    });

    // Without retryFailed: should be skipped
    const skippedResult = await generateProductImages("v1", {
      target: { mode: "selected", productIds: ["p1"] },
      options: { retryFailed: false },
    });
    expect(skippedResult.skipped).toBe(1);
    expect(skippedResult.succeeded).toBe(0);

    // With retryFailed: should be processed
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Exhausted Product",
        plu: null,
        barcode: null,
        imageAttemptFailures: 3,
        images: [],
      },
    ]);
    const retriedResult = await generateProductImages("v1", {
      target: { mode: "retry_failed", productIds: ["p1"] },
      options: { retryFailed: true },
    });
    expect(retriedResult.succeeded).toBe(1);
    expect(retriedResult.skipped).toBe(0);
  });
});

describe("POST /api/admin/product-images/generate (API route)", () => {
  it("processes generic batch request and returns detailed breakdown", async () => {
    findTargetProductsForImage.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Selected Product",
        plu: null,
        barcode: null,
        imageAttemptFailures: 0,
        images: [],
      },
    ]);

    runProductImagePipeline.mockResolvedValueOnce({
      imageKey: "products/p1/ok.webp",
      needsReview: true,
      source: "OPEN_FOOD_FACTS",
    });

    const response = await generateRoute.POST(
      post({
        mode: "selected",
        productIds: ["p1"],
        useOpenFoodFacts: true,
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.succeeded).toBe(1);
    expect(body.details.succeeded[0].id).toBe("p1");
  });

  it("answers with error message when selection is empty", async () => {
    const response = await generateRoute.POST(
      post({
        mode: "selected",
        productIds: [],
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.ok).toBe(false);
    expect(body.message).toContain("No products selected");
  });
});
