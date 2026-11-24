import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import type { getPrisma } from "@/lib/db";
import {
  listCategoryTreeForStorefront,
  listTopLevelCategories,
  type CategorySummary,
  type StorefrontCategoryNode,
} from "@/lib/repositories/categories";
import { listShopperVisibleBrands, type BrandSummary } from "@/lib/repositories/brands";
import { toSearchDepartments, type SearchDepartment } from "@/components/layout/search-departments";
import { JOB_SIGNALS_BINDING } from "@/lib/job-signal-keys";

/**
 * Cloudflare-Native Metadata Storage & Caching Architecture.
 *
 * Rather than repeatedly querying the main database for frequently accessed metadata
 * (categories/subcategories, visible brands, navigation structures), pre-build and store
 * these structures in Cloudflare KV / edge cache with seamless database fallback.
 *
 * Invariants:
 * 1. Safe Error Handling: If KV is unbound, throws, or holds corrupted data, the system
 *    silently and seamlessly falls back to querying the database directly. A cache failure
 *    NEVER disrupts the shopper experience.
 * 2. Versioned & Validated Publishing: Data written to and read from the cache is validated
 *    against strict Zod schemas with versioning. Partial or broken metadata is never served.
 * 3. Freshness & Invalidation: Immediate cache invalidation occurs on administrative changes
 *    (category edit, brand rename/delete), overnight via scheduler, and post-release.
 * 4. Purity & Multi-Tenancy: All keys are vendor-scoped (`metadata:v1:<type>:<vendorId>`).
 */

export const METADATA_VERSION = 1;

export interface MetadataStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** In-memory fallback for local execution / tests when KV is not available. */
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

function resolveStore(): MetadataStore | null {
  try {
    const { env } = getCloudflareContext();
    const envRecord = env as Record<string, unknown>;
    const store = (envRecord.METADATA_CACHE || envRecord[JOB_SIGNALS_BINDING]) as
      MetadataStore | undefined;
    return store ?? null;
  } catch {
    // Outside Worker context (Node scripts, unit tests, next dev)
    return null;
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const CachedCategorySummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  imageKey: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const CachedStorefrontCategoryNodeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  isActive: z.boolean(),
  imageKey: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const CachedCategoriesPayloadSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  vendorId: z.string(),
  topLevel: z.array(CachedCategorySummarySchema),
  tree: z.array(CachedStorefrontCategoryNodeSchema),
});

export type CachedCategoriesPayload = z.infer<typeof CachedCategoriesPayloadSchema>;

export const CachedBrandSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const CachedBrandsPayloadSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  vendorId: z.string(),
  brands: z.array(CachedBrandSummarySchema),
});

export type CachedBrandsPayload = z.infer<typeof CachedBrandsPayloadSchema>;

export const CachedSearchDepartmentSchema = z.object({
  slug: z.string(),
  name: z.string(),
  isSubcategory: z.boolean().optional(),
});

export const CachedNavigationPayloadSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  vendorId: z.string(),
  departments: z.array(CachedSearchDepartmentSchema),
});

export type CachedNavigationPayload = z.infer<typeof CachedNavigationPayloadSchema>;

export const CachedFacetSetSchema = z.object({
  categoryIds: z.array(z.string()),
  brandIds: z.array(z.string()),
  restrictions: z.array(z.string()),
  stockModes: z.array(z.string()),
  categoryToBrandIds: z.record(z.string(), z.array(z.string())),
  count: z.number().optional(),
});

export type CachedFacetSet = z.infer<typeof CachedFacetSetSchema>;

export const CachedCatalogueFacetsPayloadSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  vendorId: z.string(),
  active: CachedFacetSetSchema,
  archived: CachedFacetSetSchema,
  all: CachedFacetSetSchema,
});

export type CachedCatalogueFacetsPayload = z.infer<typeof CachedCatalogueFacetsPayloadSchema>;

// ---------------------------------------------------------------------------
// Cache Keys
// ---------------------------------------------------------------------------

export function getCategoriesCacheKey(vendorId: string): string {
  return `metadata:v${METADATA_VERSION}:categories:${vendorId}`;
}

export function getBrandsCacheKey(vendorId: string): string {
  return `metadata:v${METADATA_VERSION}:brands:${vendorId}`;
}

export function getNavigationCacheKey(vendorId: string): string {
  return `metadata:v${METADATA_VERSION}:navigation:${vendorId}`;
}

export function getFacetsCacheKey(vendorId: string): string {
  return `metadata:v${METADATA_VERSION}:facets:${vendorId}`;
}

// ---------------------------------------------------------------------------
// Reader Helpers
// ---------------------------------------------------------------------------

async function readStoreValue(key: string): Promise<string | null> {
  const store = resolveStore();
  if (store) {
    try {
      return await store.get(key);
    } catch (err) {
      console.warn(`[metadata-cache] Error reading KV key ${key}:`, err);
    }
  }

  // Memory fallback
  const mem = memoryStore.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.value;
  }
  return null;
}

async function writeStoreValue(key: string, value: string, ttlSeconds = 86400): Promise<void> {
  const store = resolveStore();
  if (store) {
    try {
      await store.put(key, value, { expirationTtl: ttlSeconds });
      return;
    } catch (err) {
      console.warn(`[metadata-cache] Error writing KV key ${key}:`, err);
    }
  }

  // Memory fallback (1 hour default in memory)
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function deleteStoreValue(key: string): Promise<void> {
  const store = resolveStore();
  if (store) {
    try {
      await store.delete(key);
    } catch (err) {
      console.warn(`[metadata-cache] Error deleting KV key ${key}:`, err);
    }
  }
  memoryStore.delete(key);
}

// ---------------------------------------------------------------------------
// Shopper Metadata Readers (with Automatic Fallback to DB)
// ---------------------------------------------------------------------------

/**
 * Returns shopper-visible categories (both topLevel departments and the full 2-tier tree),
 * reading from Cloudflare KV/cache by default with seamless fallback to Postgres.
 */
export async function getCachedShopperCategories(
  prisma: ReturnType<typeof getPrisma>,
  vendorId: string,
  cdnBaseUrl?: string | null,
): Promise<{ topLevel: CategorySummary[]; tree: StorefrontCategoryNode[]; fromCache: boolean }> {
  const key = getCategoriesCacheKey(vendorId);

  // 1. Try reading from cache
  const cachedRaw = await readStoreValue(key);
  if (cachedRaw) {
    try {
      const parsedJson = JSON.parse(cachedRaw);
      const validation = CachedCategoriesPayloadSchema.safeParse(parsedJson);
      if (validation.success) {
        return {
          topLevel: validation.data.topLevel,
          tree: validation.data.tree,
          fromCache: true,
        };
      }
      console.warn(`[metadata-cache] Invalid categories payload structure for ${vendorId}`);
    } catch (err) {
      console.warn(`[metadata-cache] Failed to parse cached categories JSON for ${vendorId}:`, err);
    }
  }

  // 2. Fallback: Query database
  const [topLevel, tree] = await Promise.all([
    listTopLevelCategories(prisma, vendorId, cdnBaseUrl),
    listCategoryTreeForStorefront(prisma, vendorId, cdnBaseUrl),
  ]);

  // 3. Asynchronously populate cache
  const payload: CachedCategoriesPayload = {
    version: METADATA_VERSION,
    updatedAt: new Date().toISOString(),
    vendorId,
    topLevel,
    tree,
  };

  void writeStoreValue(key, JSON.stringify(payload)).catch(() => {});

  return { topLevel, tree, fromCache: false };
}

/**
 * Returns shopper-visible brands (only brands with active products in visible categories),
 * reading from Cloudflare KV/cache by default with seamless fallback to Postgres.
 */
export async function getCachedShopperBrands(
  prisma: ReturnType<typeof getPrisma>,
  vendorId: string,
): Promise<{ brands: BrandSummary[]; fromCache: boolean }> {
  const key = getBrandsCacheKey(vendorId);

  const cachedRaw = await readStoreValue(key);
  if (cachedRaw) {
    try {
      const parsedJson = JSON.parse(cachedRaw);
      const validation = CachedBrandsPayloadSchema.safeParse(parsedJson);
      if (validation.success) {
        return { brands: validation.data.brands, fromCache: true };
      }
    } catch (err) {
      console.warn(`[metadata-cache] Failed to parse cached brands JSON for ${vendorId}:`, err);
    }
  }

  // Fallback: Query database
  const brands = await listShopperVisibleBrands(prisma, vendorId);

  const payload: CachedBrandsPayload = {
    version: METADATA_VERSION,
    updatedAt: new Date().toISOString(),
    vendorId,
    brands,
  };

  void writeStoreValue(key, JSON.stringify(payload)).catch(() => {});

  return { brands, fromCache: false };
}

/**
 * Returns shopper search navigation departments,
 * reading from Cloudflare KV/cache by default with seamless fallback to Postgres.
 */
export async function getCachedShopperNavigation(
  prisma: ReturnType<typeof getPrisma>,
  vendorId: string,
  cdnBaseUrl?: string | null,
): Promise<{ departments: SearchDepartment[]; fromCache: boolean }> {
  const key = getNavigationCacheKey(vendorId);

  const cachedRaw = await readStoreValue(key);
  if (cachedRaw) {
    try {
      const parsedJson = JSON.parse(cachedRaw);
      const validation = CachedNavigationPayloadSchema.safeParse(parsedJson);
      if (validation.success) {
        return { departments: validation.data.departments, fromCache: true };
      }
    } catch (err) {
      console.warn(`[metadata-cache] Failed to parse cached navigation JSON for ${vendorId}:`, err);
    }
  }

  // Fallback: Build from category tree
  const tree = await listCategoryTreeForStorefront(prisma, vendorId, cdnBaseUrl);
  const departments = toSearchDepartments(tree);

  const payload: CachedNavigationPayload = {
    version: METADATA_VERSION,
    updatedAt: new Date().toISOString(),
    vendorId,
    departments,
  };

  void writeStoreValue(key, JSON.stringify(payload)).catch(() => {});

  return { departments, fromCache: false };
}

// ---------------------------------------------------------------------------
// Catalogue Facets Reader & Builder
// ---------------------------------------------------------------------------

/**
 * Builds faceted catalogue metadata mapping active and archived products
 * to their categories, brands, restrictions, and stock modes.
 */
export async function buildCatalogueFacets(
  prisma: ReturnType<typeof getPrisma>,
  vendorId: string,
): Promise<CachedCatalogueFacetsPayload> {
  const products = await prisma.product.findMany({
    where: { vendorId },
    select: {
      categoryId: true,
      brandId: true,
      isActive: true,
      restriction: true,
      inventory: {
        select: {
          stockMode: true,
        },
      },
    },
  });

  const activeCategories = new Set<string>();
  const activeBrands = new Set<string>();
  const activeRestrictions = new Set<string>();
  const activeStockModes = new Set<string>();
  const activeCatToBrands: Record<string, Set<string>> = {};

  const archivedCategories = new Set<string>();
  const archivedBrands = new Set<string>();
  const archivedRestrictions = new Set<string>();
  const archivedStockModes = new Set<string>();
  const archivedCatToBrands: Record<string, Set<string>> = {};

  const allCategories = new Set<string>();
  const allBrands = new Set<string>();
  const allRestrictions = new Set<string>();
  const allStockModes = new Set<string>();
  const allCatToBrands: Record<string, Set<string>> = {};

  let activeCount = 0;
  let archivedCount = 0;

  for (const p of products) {
    if (p.isActive) {
      activeCount++;
    } else {
      archivedCount++;
    }

    const targetCats = p.isActive ? activeCategories : archivedCategories;
    const targetBrands = p.isActive ? activeBrands : archivedBrands;
    const targetRestrictions = p.isActive ? activeRestrictions : archivedRestrictions;
    const targetStockModes = p.isActive ? activeStockModes : archivedStockModes;
    const targetCatToBrands = p.isActive ? activeCatToBrands : archivedCatToBrands;

    if (p.categoryId) {
      targetCats.add(p.categoryId);
      allCategories.add(p.categoryId);

      if (!targetCatToBrands[p.categoryId]) {
        targetCatToBrands[p.categoryId] = new Set();
      }
      if (!allCatToBrands[p.categoryId]) {
        allCatToBrands[p.categoryId] = new Set();
      }

      if (p.brandId) {
        targetCatToBrands[p.categoryId].add(p.brandId);
        allCatToBrands[p.categoryId].add(p.brandId);
      }
    }

    if (p.brandId) {
      targetBrands.add(p.brandId);
      allBrands.add(p.brandId);
    }

    if (p.restriction) {
      targetRestrictions.add(p.restriction);
      allRestrictions.add(p.restriction);
    }

    const stockMode = p.inventory?.stockMode ?? "UNKNOWN";
    targetStockModes.add(stockMode);
    allStockModes.add(stockMode);
  }

  const toMap = (record: Record<string, Set<string>>) => {
    const res: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(record)) {
      res[k] = Array.from(v);
    }
    return res;
  };

  return {
    version: METADATA_VERSION,
    updatedAt: new Date().toISOString(),
    vendorId,
    active: {
      count: activeCount,
      categoryIds: Array.from(activeCategories),
      brandIds: Array.from(activeBrands),
      restrictions: Array.from(activeRestrictions),
      stockModes: Array.from(activeStockModes),
      categoryToBrandIds: toMap(activeCatToBrands),
    },
    archived: {
      count: archivedCount,
      categoryIds: Array.from(archivedCategories),
      brandIds: Array.from(archivedBrands),
      restrictions: Array.from(archivedRestrictions),
      stockModes: Array.from(archivedStockModes),
      categoryToBrandIds: toMap(archivedCatToBrands),
    },
    all: {
      count: products.length,
      categoryIds: Array.from(allCategories),
      brandIds: Array.from(allBrands),
      restrictions: Array.from(allRestrictions),
      stockModes: Array.from(allStockModes),
      categoryToBrandIds: toMap(allCatToBrands),
    },
  };
}

/**
 * Returns pre-built catalogue facet metadata from Cloudflare KV / edge cache
 * with zero-fail fallback to Postgres.
 */
export async function getCachedCatalogueFacets(
  vendorId: string,
  prismaClient?: ReturnType<typeof getPrisma>,
): Promise<CachedCatalogueFacetsPayload> {
  const key = getFacetsCacheKey(vendorId);

  const cachedRaw = await readStoreValue(key);
  if (cachedRaw) {
    try {
      const parsedJson = JSON.parse(cachedRaw);
      const validation = CachedCatalogueFacetsPayloadSchema.safeParse(parsedJson);
      if (validation.success) {
        return validation.data;
      }
    } catch (err) {
      console.warn(`[metadata-cache] Failed to parse cached facets JSON for ${vendorId}:`, err);
    }
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = prismaClient ?? getPrisma();

  const payload = await buildCatalogueFacets(prisma, vendorId);
  void writeStoreValue(key, JSON.stringify(payload)).catch(() => {});
  return payload;
}

// ---------------------------------------------------------------------------
// Invalidation & Refresh Operations
// ---------------------------------------------------------------------------

/**
 * Invalidates cached metadata for a vendor.
 */
export async function invalidateVendorMetadata(
  vendorId: string,
  type: "categories" | "brands" | "navigation" | "facets" | "all" = "all",
): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (type === "categories" || type === "all") {
    tasks.push(deleteStoreValue(getCategoriesCacheKey(vendorId)));
  }
  if (type === "brands" || type === "all") {
    tasks.push(deleteStoreValue(getBrandsCacheKey(vendorId)));
  }
  if (type === "navigation" || type === "all" || type === "categories") {
    tasks.push(deleteStoreValue(getNavigationCacheKey(vendorId)));
  }
  if (type === "facets" || type === "all" || type === "categories" || type === "brands") {
    tasks.push(deleteStoreValue(getFacetsCacheKey(vendorId)));
  }
  await Promise.all(tasks);
}

/**
 * Authoritatively builds, validates, and publishes fresh metadata into Cloudflare KV.
 */
export async function refreshVendorMetadata(
  prisma: ReturnType<typeof getPrisma>,
  vendorId: string,
  cdnBaseUrl?: string | null,
): Promise<{
  ok: true;
  vendorId: string;
  categoriesCount: number;
  brandsCount: number;
  navigationCount: number;
  facetsCount: number;
}> {
  const [topLevel, tree, brands, facetsPayload] = await Promise.all([
    listTopLevelCategories(prisma, vendorId, cdnBaseUrl),
    listCategoryTreeForStorefront(prisma, vendorId, cdnBaseUrl),
    listShopperVisibleBrands(prisma, vendorId),
    buildCatalogueFacets(prisma, vendorId),
  ]);

  const departments = toSearchDepartments(tree);
  const now = new Date().toISOString();

  const categoriesPayload: CachedCategoriesPayload = {
    version: METADATA_VERSION,
    updatedAt: now,
    vendorId,
    topLevel,
    tree,
  };

  const brandsPayload: CachedBrandsPayload = {
    version: METADATA_VERSION,
    updatedAt: now,
    vendorId,
    brands,
  };

  const navigationPayload: CachedNavigationPayload = {
    version: METADATA_VERSION,
    updatedAt: now,
    vendorId,
    departments,
  };

  // Safe validation check before publishing
  CachedCategoriesPayloadSchema.parse(categoriesPayload);
  CachedBrandsPayloadSchema.parse(brandsPayload);
  CachedNavigationPayloadSchema.parse(navigationPayload);
  CachedCatalogueFacetsPayloadSchema.parse(facetsPayload);

  await Promise.all([
    writeStoreValue(getCategoriesCacheKey(vendorId), JSON.stringify(categoriesPayload)),
    writeStoreValue(getBrandsCacheKey(vendorId), JSON.stringify(brandsPayload)),
    writeStoreValue(getNavigationCacheKey(vendorId), JSON.stringify(navigationPayload)),
    writeStoreValue(getFacetsCacheKey(vendorId), JSON.stringify(facetsPayload)),
  ]);

  return {
    ok: true,
    vendorId,
    categoriesCount: tree.length,
    brandsCount: brands.length,
    navigationCount: departments.length,
    facetsCount: facetsPayload.all.categoryIds.length,
  };
}

/**
 * Refreshes metadata across all active vendors in the database.
 * Used by scheduled jobs and release scripts.
 */
export async function refreshAllVendorsMetadata(
  prismaClient?: ReturnType<typeof getPrisma>,
): Promise<{
  ok: true;
  refreshedCount: number;
  timestamp: string;
}> {
  // Dynamic import to prevent circular dependencies in script mode
  const { getPrisma } = await import("@/lib/db");
  const { getEnv } = await import("@/lib/config");

  const prisma = prismaClient ?? getPrisma();
  const env = getEnv();

  const vendors = await prisma.vendor.findMany({
    select: { id: true },
  });

  for (const v of vendors) {
    try {
      await refreshVendorMetadata(prisma, v.id, env.CDN_BASE_URL);
    } catch (err) {
      console.error(`[metadata-cache] Error refreshing metadata for vendor ${v.id}:`, err);
    }
  }

  return {
    ok: true,
    refreshedCount: vendors.length,
    timestamp: new Date().toISOString(),
  };
}
