import { describe, expect, it } from "vitest";
import { listBrandsForAdmin, listShopperVisibleBrands } from "@/lib/repositories/brands";
import { visibleCategoryWhere } from "@/lib/category-visibility";

describe("Shopper Brand Visibility (#1131, ADR-004)", () => {
  it("enforces visibleCategoryWhere and isActive: true on products for shopper-visible brands", async () => {
    let capturedQuery: any = null;

    const mockPrisma = {
      brand: {
        findMany: async (args: any) => {
          capturedQuery = args;
          return [
            { id: "b-2", name: "Tilda", slug: "tilda" },
            { id: "b-1", name: "Daawat", slug: "daawat" },
          ];
        },
      },
    } as any;

    const vendorId = "vendor-1";
    const result = await listShopperVisibleBrands(mockPrisma, vendorId);

    // Verify query structure
    expect(capturedQuery.where.vendorId).toBe(vendorId);
    expect(capturedQuery.where.products.some.isActive).toBe(true);
    expect(capturedQuery.where.products.some.category).toEqual(visibleCategoryWhere);

    // Verify natural alphabetical sorting A-Z
    expect(result.map((b) => b.name)).toEqual(["Daawat", "Tilda"]);
  });

  it("retains all brands in admin queries without hiding empty or inactive ones", async () => {
    let capturedQuery: any = null;

    const mockPrisma = {
      brand: {
        findMany: async (args: any) => {
          capturedQuery = args;
          return [
            {
              id: "b-2",
              name: "Brand 2",
              slug: "brand-2",
              imageKey: null,
              _count: { products: 0 },
            },
            {
              id: "b-1",
              name: "Brand 1",
              slug: "brand-1",
              imageKey: null,
              _count: { products: 5 },
            },
          ];
        },
      },
    } as any;

    const result = await listBrandsForAdmin(mockPrisma, "vendor-1");

    // Admin query does not filter on products
    expect(capturedQuery.where.products).toBeUndefined();

    // Results are naturally sorted A-Z
    expect(result.map((b) => b.name)).toEqual(["Brand 1", "Brand 2"]);
  });
});
