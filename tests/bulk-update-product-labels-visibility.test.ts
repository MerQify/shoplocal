import { describe, expect, it, vi, beforeEach } from "vitest";
import { bulkUpdateProductLabelsAndVisibility } from "@/lib/repositories/products";
import { bulkUpdateLabelsAndVisibilityAction } from "@/features/admin/catalogue";
import * as authRbac from "@/lib/auth-rbac";
import * as productsService from "@/lib/products-service";
import * as cloudflareMetadata from "@/lib/cloudflare-metadata";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
}));

describe("bulkUpdateProductLabelsAndVisibility repository", () => {
  it("returns zero counts and does not open transaction when productIds is empty", async () => {
    const $transaction = vi.fn();
    const dummyPrismaWs = { $transaction } as never;

    const result = await bulkUpdateProductLabelsAndVisibility(dummyPrismaWs, "v-1", [], {
      isHalal: true,
      isFresh: false,
      isOrganic: false,
      isVegetarian: false,
      isGlutenFree: false,
      isFeatured: false,
      isActive: true,
      allowsCustomNote: false,
    });

    expect(result).toEqual({ updated: 0, skippedRestricted: 0 });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("updates products with isActive: false directly", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const tx = {
      product: { updateMany },
    };
    const $transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    const prismaWs = { $transaction } as never;

    const result = await bulkUpdateProductLabelsAndVisibility(
      prismaWs,
      "v-1",
      ["p-1", "p-2", "p-3"],
      {
        isHalal: true,
        isFresh: true,
        isOrganic: false,
        isVegetarian: false,
        isGlutenFree: true,
        isFeatured: false,
        isActive: false,
        allowsCustomNote: true,
      },
    );

    expect(result).toEqual({ updated: 3, skippedRestricted: 0 });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { vendorId: "v-1", id: { in: ["p-1", "p-2", "p-3"] } },
      data: {
        isHalal: true,
        isFresh: true,
        isOrganic: false,
        isVegetarian: false,
        isGlutenFree: true,
        isFeatured: false,
        isActive: false,
        allowsCustomNote: true,
      },
    });
  });

  it("when isActive: true, separates restricted products and keeps them inactive", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "p-restricted" }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 2 }); // 2 unrestricted updated
    const tx = {
      product: { findMany, updateMany },
    };
    const $transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    const prismaWs = { $transaction } as never;

    const result = await bulkUpdateProductLabelsAndVisibility(
      prismaWs,
      "v-1",
      ["p-1", "p-2", "p-restricted"],
      {
        isHalal: true,
        isFresh: false,
        isOrganic: true,
        isVegetarian: true,
        isGlutenFree: false,
        isFeatured: true,
        isActive: true,
        allowsCustomNote: false,
      },
    );

    expect(result).toEqual({ updated: 3, skippedRestricted: 1 });
    // First update: restricted products without isActive: true
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { vendorId: "v-1", id: { in: ["p-restricted"] } },
      data: {
        isHalal: true,
        isFresh: false,
        isOrganic: true,
        isVegetarian: true,
        isGlutenFree: false,
        isFeatured: true,
        allowsCustomNote: false,
      },
    });
    // Second update: unrestricted products with isActive: true
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { vendorId: "v-1", id: { in: ["p-1", "p-2"] } },
      data: {
        isHalal: true,
        isFresh: false,
        isOrganic: true,
        isVegetarian: true,
        isGlutenFree: false,
        isFeatured: true,
        isActive: true,
        allowsCustomNote: false,
      },
    });
  });

  it("deduplicates product IDs before executing query", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      product: { updateMany },
    };
    const $transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    const prismaWs = { $transaction } as never;

    const result = await bulkUpdateProductLabelsAndVisibility(
      prismaWs,
      "v-1",
      ["p-1", "p-1", "p-1"],
      {
        isHalal: false,
        isFresh: false,
        isOrganic: false,
        isVegetarian: false,
        isGlutenFree: false,
        isFeatured: false,
        isActive: false,
        allowsCustomNote: false,
      },
    );

    expect(result).toEqual({ updated: 1, skippedRestricted: 0 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { vendorId: "v-1", id: { in: ["p-1"] } },
      data: expect.any(Object),
    });
  });
});

describe("bulkUpdateLabelsAndVisibilityAction server action", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRevalidatePath.mockClear();
  });

  it("refuses when user lacks required staff/admin vendor role", async () => {
    vi.spyOn(authRbac, "requireVendorRole").mockResolvedValue({
      ok: false,
      status: 403,
      reason: "insufficient_role",
    } as never);

    const formData = new FormData();
    formData.append("productId", "p-1");

    const result = await bulkUpdateLabelsAndVisibilityAction(
      { status: "idle", message: null },
      formData,
    );
    expect(result.status).toBe("error");
    expect(result.message).toContain("permission");
  });

  it("returns error when no product IDs are submitted", async () => {
    vi.spyOn(authRbac, "requireVendorRole").mockResolvedValue({
      ok: true,
      vendorId: "v-1",
      role: "STAFF",
    } as never);

    const formData = new FormData();

    const result = await bulkUpdateLabelsAndVisibilityAction(
      { status: "idle", message: null },
      formData,
    );
    expect(result.status).toBe("error");
    expect(result.message).toBe("No products selected.");
  });

  it("processes bulk update successfully, invalidates cache and revalidates paths", async () => {
    vi.spyOn(authRbac, "requireVendorRole").mockResolvedValue({
      ok: true,
      vendorId: "v-1",
      role: "STAFF",
    } as never);

    const bulkUpdateSpy = vi
      .spyOn(productsService, "bulkUpdateProductLabelsAndVisibility")
      .mockResolvedValue({ updated: 2, skippedRestricted: 0 });

    const invalidateSpy = vi
      .spyOn(cloudflareMetadata, "invalidateVendorMetadata")
      .mockResolvedValue(undefined as never);

    const formData = new FormData();
    formData.append("productId", "p-1");
    formData.append("productId", "p-2");
    formData.append("isHalal", "true");
    formData.append("isFresh", "on");
    formData.append("isActive", "true");
    formData.append("allowsCustomNote", "true");

    const result = await bulkUpdateLabelsAndVisibilityAction(
      { status: "idle", message: null },
      formData,
    );

    expect(result.status).toBe("ok");
    expect(result.message).toContain("Updated labels and visibility for 2 products.");

    expect(bulkUpdateSpy).toHaveBeenCalledWith("v-1", ["p-1", "p-2"], {
      isHalal: true,
      isFresh: true,
      isOrganic: false,
      isVegetarian: false,
      isGlutenFree: false,
      isFeatured: false,
      isActive: true,
      allowsCustomNote: true,
    });

    expect(invalidateSpy).toHaveBeenCalledWith("v-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/staff/products");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/staff/inventory");
  });

  it("includes restricted warning note in success message if restricted products were skipped", async () => {
    vi.spyOn(authRbac, "requireVendorRole").mockResolvedValue({
      ok: true,
      vendorId: "v-1",
      role: "STAFF",
    } as never);

    vi.spyOn(productsService, "bulkUpdateProductLabelsAndVisibility").mockResolvedValue({
      updated: 3,
      skippedRestricted: 1,
    });
    vi.spyOn(cloudflareMetadata, "invalidateVendorMetadata").mockResolvedValue(undefined as never);

    const formData = new FormData();
    formData.append("productId", "p-1");
    formData.append("isActive", "true");

    const result = await bulkUpdateLabelsAndVisibilityAction(
      { status: "idle", message: null },
      formData,
    );

    expect(result.status).toBe("ok");
    expect(result.message).toContain("1 restricted product kept hidden");
  });
});
