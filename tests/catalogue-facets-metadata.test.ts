import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildCatalogueFacets,
  getCachedCatalogueFacets,
  invalidateVendorMetadata,
  getFacetsCacheKey,
  CachedCatalogueFacetsPayloadSchema,
} from "@/lib/cloudflare-metadata";

describe("Catalogue Facets & Cascading Metadata Cache", () => {
  const vendorId = "v-test-facets";

  const mockProducts = [
    {
      categoryId: "cat-meat",
      brandId: "brand-a",
      isActive: true,
      restriction: null,
      inventory: { stockMode: "TRACKED" },
    },
    {
      categoryId: "cat-fish",
      brandId: "brand-b",
      isActive: false, // archived
      restriction: "AGE_RESTRICTED",
      inventory: { stockMode: "UNKNOWN" },
    },
    {
      categoryId: "cat-veg",
      brandId: "brand-a",
      isActive: true,
      restriction: "PROHIBITED",
      inventory: { stockMode: "UNTRACKED" },
    },
    {
      categoryId: "cat-prawns", // subcategory
      brandId: "brand-c",
      isActive: false, // archived
      restriction: null,
      inventory: { stockMode: "TRACKED" },
    },
  ];

  const mockPrisma = {
    product: {
      findMany: vi.fn().mockResolvedValue(mockProducts),
    },
  } as unknown as Parameters<typeof buildCatalogueFacets>[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildCatalogueFacets segments active vs archived products correctly", async () => {
    const facets = await buildCatalogueFacets(mockPrisma, vendorId);

    // Active products
    expect(facets.active.categoryIds).toEqual(expect.arrayContaining(["cat-meat", "cat-veg"]));
    expect(facets.active.categoryIds).not.toContain("cat-fish");
    expect(facets.active.categoryIds).not.toContain("cat-prawns");

    expect(facets.active.brandIds).toEqual(["brand-a"]);
    expect(facets.active.restrictions).toEqual(["PROHIBITED"]);
    expect(facets.active.stockModes).toEqual(expect.arrayContaining(["TRACKED", "UNTRACKED"]));

    // Archived products
    expect(facets.archived.categoryIds).toEqual(expect.arrayContaining(["cat-fish", "cat-prawns"]));
    expect(facets.archived.categoryIds).not.toContain("cat-meat");
    expect(facets.archived.categoryIds).not.toContain("cat-veg");

    expect(facets.archived.brandIds).toEqual(expect.arrayContaining(["brand-b", "brand-c"]));
    expect(facets.archived.restrictions).toEqual(["AGE_RESTRICTED"]);
    expect(facets.archived.stockModes).toEqual(expect.arrayContaining(["TRACKED", "UNKNOWN"]));

    // All products
    expect(facets.all.categoryIds).toHaveLength(4);
    expect(facets.all.brandIds).toEqual(expect.arrayContaining(["brand-a", "brand-b", "brand-c"]));
  });

  it("maps categoryToBrandIds for cascading brand selectors", async () => {
    const facets = await buildCatalogueFacets(mockPrisma, vendorId);

    expect(facets.active.categoryToBrandIds["cat-meat"]).toEqual(["brand-a"]);
    expect(facets.active.categoryToBrandIds["cat-veg"]).toEqual(["brand-a"]);
    expect(facets.active.categoryToBrandIds["cat-fish"]).toBeUndefined();

    expect(facets.archived.categoryToBrandIds["cat-fish"]).toEqual(["brand-b"]);
    expect(facets.archived.categoryToBrandIds["cat-prawns"]).toEqual(["brand-c"]);
  });

  it("validates facets payload against Zod schema", async () => {
    const facets = await buildCatalogueFacets(mockPrisma, vendorId);
    expect(() => CachedCatalogueFacetsPayloadSchema.parse(facets)).not.toThrow();
  });

  it("getCachedCatalogueFacets falls back to building when cache is empty", async () => {
    await invalidateVendorMetadata(vendorId, "all");
    const facets = await getCachedCatalogueFacets(vendorId, mockPrisma);

    expect(facets.vendorId).toBe(vendorId);
    expect(facets.active.categoryIds).toContain("cat-meat");
  });

  it("cascades filtering in staff product categories and brands", async () => {
    const facets = await buildCatalogueFacets(mockPrisma, vendorId);

    // Mock category tree
    const categories = [
      { id: "cat-meat", name: "Meat", parentId: null, isActive: true },
      { id: "cat-fish", name: "Fish", parentId: null, isActive: true },
      { id: "cat-prawns", name: "Prawns", parentId: "cat-fish", isActive: true },
    ];

    // Status = Archived: only cat-fish (parent of cat-prawns) and cat-prawns should match
    const archivedMatching = new Set(facets.archived.categoryIds);
    const parentIdsWithArchived = new Set<string>();
    for (const c of categories) {
      if (c.parentId && archivedMatching.has(c.id)) {
        parentIdsWithArchived.add(c.parentId);
      }
    }
    const filteredForArchived = categories.filter(
      (c) => archivedMatching.has(c.id) || parentIdsWithArchived.has(c.id),
    );

    expect(filteredForArchived.map((c) => c.id)).toEqual(["cat-fish", "cat-prawns"]);
    expect(filteredForArchived.map((c) => c.id)).not.toContain("cat-meat");

    // Status = Active: only cat-meat has active products
    const activeMatching = new Set(facets.active.categoryIds);
    const parentIdsWithActive = new Set<string>();
    for (const c of categories) {
      if (c.parentId && activeMatching.has(c.id)) {
        parentIdsWithActive.add(c.parentId);
      }
    }
    const filteredForActive = categories.filter(
      (c) => activeMatching.has(c.id) || parentIdsWithActive.has(c.id),
    );

    expect(filteredForActive.map((c) => c.id)).toEqual(["cat-meat"]);
    expect(filteredForActive.map((c) => c.id)).not.toContain("cat-fish");
  });
});
