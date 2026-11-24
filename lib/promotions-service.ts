import { cache } from "react";
import { getPrisma } from "@/lib/db";
import { openLandingPromotionCache } from "@/lib/landing-promotion-cache";
import { timeStorefrontRender } from "@/lib/storefront-render-timing";
import { getCurrentVendorIdOrNull } from "@/lib/tenant";
import {
  listPromotionsForAdmin as listAdminRepo,
  getPromotionById as getByIdRepo,
  listLivePromotions as listLiveRepo,
  findNextPromotionStart,
  createPromotion as createRepo,
  updatePromotion as updateRepo,
  deletePromotion as deleteRepo,
  listEligiblePromotionalProducts as listEligibleProductsRepo,
  type PromotionRow,
  type PromotionWriteInput,
  type PromotionWriteResult,
  type EligiblePromotionalProduct,
  type AudienceSegment,
  type PromotionChannel,
} from "@/lib/repositories/promotions";

/**
 * Request-scoped wrapper around `lib/repositories/promotions.ts` pure functions.
 * Resolves live Prisma client and tenant context.
 */

/**
 * How many live promotions the landing-page hero rotates through. It was 3, which hid every live
 * promotion past the third (an owner saw 3 of 7, 2026-11-12). The hero is a slideshow with dots,
 * so more only adds slides; this bound keeps the query and the dot row small.
 */
export const HERO_PROMOTION_LIMIT = 12;

/**
 * Storefront live promotions read (R11). Memoized per request with React `cache()`.
 */
export const getLivePromotionsForStorefront = cache(
  async (now?: Date, limit = HERO_PROMOTION_LIMIT): Promise<PromotionRow[]> => {
    const asOf = now ?? new Date();
    const vendorId = await getCurrentVendorIdOrNull();
    if (!vendorId) return [];

    const cache =
      now === undefined && limit === HERO_PROMOTION_LIMIT
        ? await openLandingPromotionCache(vendorId)
        : null;
    if (!cache) return listLiveRepo(getPrisma(), vendorId, asOf, limit);
    const cached = await timeStorefrontRender("hero.promotions.cache-read", cache.read);
    if (cached) return cached;

    const prisma = getPrisma();
    const [rows, schedule] = await Promise.all([
      timeStorefrontRender("hero.promotions.db", () => listLiveRepo(prisma, vendorId, asOf, limit)),
      findNextPromotionStart(prisma, vendorId, asOf).then(
        (nextStart) => ({ nextStart }),
        () => null,
      ),
    ]);
    if (schedule) cache.write(rows, asOf, schedule.nextStart);
    return rows;
  },
);

/**
 * Staff admin promotion list (R7).
 */
export async function listPromotionsForAdmin(vendorId: string): Promise<PromotionRow[]> {
  return listAdminRepo(getPrisma(), vendorId);
}

/**
 * Fetch a single promotion by ID for staff editing.
 */
export async function getPromotionForAdmin(
  vendorId: string,
  id: string,
): Promise<PromotionRow | null> {
  return getByIdRepo(getPrisma(), vendorId, id);
}

/**
 * Create a promotion for staff back-office.
 */
export async function createPromotionForVendor(
  vendorId: string,
  input: PromotionWriteInput,
): Promise<PromotionWriteResult> {
  return createRepo(getPrisma(), vendorId, input);
}

/**
 * Update an existing promotion for staff back-office.
 */
export async function updatePromotionForVendor(
  vendorId: string,
  id: string,
  input: PromotionWriteInput,
): Promise<PromotionWriteResult> {
  return updateRepo(getPrisma(), vendorId, id, input);
}

/**
 * Delete a promotion for staff back-office.
 */
export async function deletePromotionForVendor(
  vendorId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return deleteRepo(getPrisma(), vendorId, id);
}

// Re-export types
export type {
  PromotionRow,
  PromotionWriteInput,
  PromotionWriteResult,
  EligiblePromotionalProduct,
  AudienceSegment,
  PromotionChannel,
};

/**
 * List eligible promotional products for staff campaign creation.
 */
export async function listEligiblePromotionalProductsForAdmin(
  vendorId: string,
  includeIds: readonly string[] = [],
): Promise<EligiblePromotionalProduct[]> {
  return listEligibleProductsRepo(getPrisma(), vendorId, includeIds);
}
