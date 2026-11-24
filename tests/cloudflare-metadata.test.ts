import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getCachedShopperCategories,
  getCachedShopperBrands,
  getCachedShopperNavigation,
  invalidateVendorMetadata,
  refreshVendorMetadata,
  getCategoriesCacheKey,
  getBrandsCacheKey,
  getNavigationCacheKey,
  CachedCategoriesPayloadSchema,
  CachedBrandsPayloadSchema,
  CachedNavigationPayloadSchema,
} from "@/lib/cloudflare-metadata";

describe("Cloudflare Metadata Architecture", () => {
  const vendorId = "vendor-test-123";

  beforeEach(async () => {
    // Invalidate any leftover memory cache before each test
    await invalidateVendorMetadata(vendorId, "all");
  });

  it("generates correctly formatted, versioned vendor cache keys", () => {
    expect(getCategoriesCacheKey(vendorId)).toBe(`metadata:v1:categories:${vendorId}`);
    expect(getBrandsCacheKey(vendorId)).toBe(`metadata:v1:brands:${vendorId}`);
    expect(getNavigationCacheKey(vendorId)).toBe(`metadata:v1:navigation:${vendorId}`);
  });

  it("validates valid payload schemas and rejects malformed data", () => {
    const validCategoryPayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      vendorId,
      topLevel: [{ id: "c1", slug: "fruit", name: "Fruit" }],
      tree: [{ id: "c1", slug: "fruit", name: "Fruit", parentId: null, isActive: true }],
    };

    expect(CachedCategoriesPayloadSchema.safeParse(validCategoryPayload).success).toBe(true);

    const invalidCategoryPayload = {
      version: 1,
      // Missing topLevel and tree
      vendorId,
    };
    expect(CachedCategoriesPayloadSchema.safeParse(invalidCategoryPayload).success).toBe(false);
  });

  it("falls back to database on cache miss, caches data, and serves from cache on subsequent reads", async () => {
    let dbCategoryQueryCount = 0;

    const mockPrisma = {
      category: {
        findMany: vi.fn(async (args: any) => {
          dbCategoryQueryCount++;
          if (args.where.parentId === null) {
            // listTopLevel
            return [{ id: "cat-1", slug: "beverages", name: "Beverages", imageKey: null }];
          }
          // listCategoryTree
          return [
            {
              id: "cat-1",
              slug: "beverages",
              name: "Beverages",
              parentId: null,
              isActive: true,
              imageKey: null,
            },
            {
              id: "cat-2",
              slug: "tea",
              name: "Tea",
              parentId: "cat-1",
              isActive: true,
              imageKey: null,
            },
          ];
        }),
      },
    } as any;

    // 1. First read (Cache miss) -> Queries DB
    const firstRead = await getCachedShopperCategories(mockPrisma, vendorId);
    expect(firstRead.fromCache).toBe(false);
    expect(firstRead.topLevel).toHaveLength(1);
    expect(firstRead.tree).toHaveLength(2);
    expect(dbCategoryQueryCount).toBe(2); // Top-level + tree queries

    // Wait a tick for async write to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 2. Second read (Cache hit) -> Serves from cache, 0 additional DB queries!
    const secondRead = await getCachedShopperCategories(mockPrisma, vendorId);
    expect(secondRead.fromCache).toBe(true);
    expect(secondRead.topLevel[0].name).toBe("Beverages");
    expect(secondRead.tree[1].name).toBe("Tea");
    expect(dbCategoryQueryCount).toBe(2); // Query count unchanged!
  });

  it("invalidates cache immediately when requested", async () => {
    let dbBrandQueryCount = 0;

    const mockPrisma = {
      brand: {
        findMany: vi.fn(async () => {
          dbBrandQueryCount++;
          return [{ id: "b1", name: "Tilda", slug: "tilda" }];
        }),
      },
    } as any;

    // 1. Initial read (Miss)
    const read1 = await getCachedShopperBrands(mockPrisma, vendorId);
    expect(read1.fromCache).toBe(false);
    expect(dbBrandQueryCount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // 2. Subsequent read (Hit)
    const read2 = await getCachedShopperBrands(mockPrisma, vendorId);
    expect(read2.fromCache).toBe(true);
    expect(dbBrandQueryCount).toBe(1);

    // 3. Admin invalidation
    await invalidateVendorMetadata(vendorId, "brands");

    // 4. Next read after invalidation (Miss) -> Fetches fresh data
    const read3 = await getCachedShopperBrands(mockPrisma, vendorId);
    expect(read3.fromCache).toBe(false);
    expect(dbBrandQueryCount).toBe(2);
  });

  it("refreshVendorMetadata builds and publishes all 3 metadata structures authoritatively", async () => {
    const mockPrisma = {
      category: {
        findMany: vi.fn(async () => [
          {
            id: "c1",
            slug: "fruit",
            name: "Fruit",
            parentId: null,
            isActive: true,
            imageKey: null,
          },
        ]),
      },
      brand: {
        findMany: vi.fn(async () => [{ id: "b1", name: "Tilda", slug: "tilda" }]),
      },
      product: {
        findMany: vi.fn(async () => []),
      },
    } as any;

    const result = await refreshVendorMetadata(mockPrisma, vendorId);
    expect(result.ok).toBe(true);
    expect(result.categoriesCount).toBe(1);
    expect(result.brandsCount).toBe(1);
    expect(result.navigationCount).toBe(1);

    // After refresh, navigation reads immediately from cache
    const navRead = await getCachedShopperNavigation(mockPrisma, vendorId);
    expect(navRead.fromCache).toBe(true);
    expect(navRead.departments[0].name).toBe("Fruit");
  });
});
