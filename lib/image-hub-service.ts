import { requireVendorRole, type VendorRbacResult, type VendorRole } from "@/lib/auth-rbac";
import { getImageHubEnv } from "@/lib/config";
import { getStorage } from "@/lib/storage";
import { fetchVendorProfile } from "@/lib/vendor-service";
import {
  addProductImage,
  getProductForAdmin,
  listProductsForAdmin,
  setPrimaryProductImage,
  setProductImageHubUsage,
} from "@/lib/products-service";
import { getVendorAiMeter } from "@/lib/ai-meter-service";
import { describeAiBudgetRefusal } from "@/lib/ai-meter";
import { getImageGenerationService, IMAGE_GENERATION_MODEL } from "@/lib/image-generation";
import { getCategoryForAdmin } from "@/lib/categories-service";
import {
  createCategoryAssetForVendor,
  setCategoryAssetHubUsageForVendor,
} from "@/lib/category-assets-service";
import {
  IMAGE_CONTENT_TYPE,
  MAX_IMAGE_BYTES,
  buildProductImageKey,
  isProductImageKey,
  type UploadTicket,
} from "@/lib/product-image";
import { buildCategoryImageKey } from "@/lib/category-image";
import {
  approveAsset,
  deleteUsage,
  getAsset,
  getAssetContent,
  importAsset,
  recordUsage,
  rejectAsset,
  searchAssets,
  uploadAsset,
  HUB_UPLOAD_LICENCES,
  type HubAsset,
  type HubCaller,
  type HubPage,
  type HubResult,
  type HubSearchSort,
  type HubStatus,
  type HubUploadLicence,
  type HubUsageKind,
} from "@/lib/image-hub/client";
import { storeSourceForHubSource } from "@/lib/image-hub/source";
import { searchDiscoveredImages } from "@/lib/image-discovery/service";
import type {
  DiscoveredImage,
  DiscoverySearchParams,
  DiscoverySearchResult,
} from "@/lib/image-discovery/types";

/**
 * #1671 — request-scoped facade over the Merqify Image Hub client (`lib/image-hub/`).
 *
 * THE ONLY module that calls `lib/image-hub/` with request context (R5). It supplies the three
 * things every hub call needs: the config (`getImageHubEnv`), the tenant (the current vendor's
 * `Vendor.slug`) and the actor (the signed-in user's id). Everything else in the app reaches the
 * hub through these functions.
 *
 * ORDER OF CHECKS, on every function: the role first, then the config. Each exported function calls
 * `requireVendorRole` itself (not inside a helper), so `tests/rbac-gate-matrix.test.ts` can see the
 * gate from every route and action that reaches it. A refused caller never
 * learns whether the hub is configured, and an unconfigured hub is never called (`not_configured`
 * with no `fetch`).
 *
 * WHO MAY DO WHAT (owner decision on #1671, 2026-11-20):
 *  - search, preview, upload, assign to a product: staff and store admins;
 *  - approve, reject, assign to a category: store admins only. Category assignment matches the
 *    existing category image routes, which are all `requireVendorRole("ADMIN")`.
 */

/** Hub results plus this facade's own refusals (`unauthenticated`, `forbidden`, `not_configured`). */
export type LibraryResult<T> = HubResult<T>;

const STAFF_AND_ADMIN: VendorRole[] = ["STAFF", "ADMIN"];
const ADMIN_ONLY: VendorRole[] = ["ADMIN"];

/** Page size for the library grid (R8). */
export const LIBRARY_PAGE_SIZE = 24;

const NOT_CONFIGURED = {
  ok: false as const,
  code: "not_configured",
  message: "The image library isn't set up for this store.",
};

interface ResolvedCaller {
  caller: HubCaller;
  vendorId: string;
  userId: string;
}

async function resolveCaller(
  auth: VendorRbacResult,
  roles: VendorRole[],
): Promise<
  | { ok: true; value: ResolvedCaller }
  | { ok: false; code: string; message: string; status?: number }
> {
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.reason,
      status: auth.status,
      message:
        auth.status === 401
          ? "Please sign in to use the image library."
          : roles.length === 1
            ? "Only a store admin can do that."
            : "You don't have access to this store's image library.",
    };
  }
  const env = getImageHubEnv();
  if (!env.configured) return NOT_CONFIGURED;
  const profile = await fetchVendorProfile(auth.vendorId);
  return {
    ok: true,
    value: {
      caller: {
        config: { url: env.url, apiKey: env.apiKey },
        tenant: profile.slug,
        actor: auth.user.id,
      },
      vendorId: auth.vendorId,
      userId: auth.user.id,
    },
  };
}

/** Whether this environment has a hub at all — the page's "not set up" switch (R7). */
export async function isImageLibraryConfigured(): Promise<boolean> {
  return getImageHubEnv().configured;
}

export async function searchImageLibrary(params: {
  q?: string;
  status?: HubStatus;
  sort?: HubSearchSort;
  cursor?: string;
}): Promise<LibraryResult<HubPage>> {
  const resolved = await resolveCaller(
    await requireVendorRole(...STAFF_AND_ADMIN),
    STAFF_AND_ADMIN,
  );
  if (!resolved.ok) return resolved;
  return searchAssets(resolved.value.caller, { ...params, limit: LIBRARY_PAGE_SIZE });
}

/** The asset's bytes as the hub's Response, for the same-origin content route (R9). */
export async function getImageLibraryContent(assetId: string): Promise<LibraryResult<Response>> {
  const resolved = await resolveCaller(
    await requireVendorRole(...STAFF_AND_ADMIN),
    STAFF_AND_ADMIN,
  );
  if (!resolved.ok) return resolved;
  return getAssetContent(resolved.value.caller, assetId);
}

export interface LibraryUploadInput {
  file: Blob;
  fileName: string;
  title: string;
  alt?: string;
  licence: string;
  rightsConfirmed: boolean;
}

/**
 * Validates and forwards a library upload (R11). The browser already converted the file to WebP;
 * this re-checks everything, because nothing guarantees the request came from that browser code.
 */
export async function uploadToImageLibrary(
  input: LibraryUploadInput,
): Promise<LibraryResult<HubAsset>> {
  const resolved = await resolveCaller(
    await requireVendorRole(...STAFF_AND_ADMIN),
    STAFF_AND_ADMIN,
  );
  if (!resolved.ok) return resolved;

  const invalid = (message: string) => ({
    ok: false as const,
    code: "validation",
    message,
    status: 400,
  });
  if (input.file.type !== IMAGE_CONTENT_TYPE) return invalid("Images must be WebP.");
  if (input.file.size <= 0 || input.file.size > MAX_IMAGE_BYTES) {
    return invalid(`Images must be under ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`);
  }
  if (!HUB_UPLOAD_LICENCES.includes(input.licence as HubUploadLicence)) {
    return invalid("Choose who owns the rights to this image.");
  }
  if (!input.rightsConfirmed) return invalid("Confirm you have the right to use this image.");
  const title = input.title.trim();
  if (!title) return invalid("Give the image a title.");

  const result = await uploadAsset(resolved.value.caller, {
    file: input.file,
    fileName: input.fileName || "image.webp",
    title,
    alt: input.alt?.trim() || undefined,
    licence: input.licence as HubUploadLicence,
  });
  if (!result.ok && result.status === 409) {
    return { ...result, message: "This image is already in the library." };
  }
  return result;
}

export async function approveImageLibraryAsset(assetId: string): Promise<LibraryResult<HubAsset>> {
  const resolved = await resolveCaller(await requireVendorRole(...ADMIN_ONLY), ADMIN_ONLY);
  if (!resolved.ok) return resolved;
  return approveAsset(resolved.value.caller, assetId);
}

export async function rejectImageLibraryAsset(
  assetId: string,
  reason: string,
): Promise<LibraryResult<HubAsset>> {
  const resolved = await resolveCaller(await requireVendorRole(...ADMIN_ONLY), ADMIN_ONLY);
  if (!resolved.ok) return resolved;
  const trimmed = reason.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "validation",
      message: "Give a reason for rejecting it.",
      status: 400,
    };
  }
  return rejectAsset(resolved.value.caller, assetId, trimmed);
}

/* ------------------------------------------------------------------------------------------------
 * Assign (R13–R17)
 * --------------------------------------------------------------------------------------------- */

export type ProductAssignMode = "primary" | "additional";

/** What an assign call produced. `needs_conversion` means: convert in the browser, then finalize. */
export type AssignOutcome =
  { status: "assigned"; url: string; warning: string | null } | { status: "needs_conversion" };

const USAGE_WARNING =
  "The image was assigned, but the library could not record where it is used. It will not show as in use there.";

/** Re-reads the asset and refuses anything not approved (R13). */
async function approvedAsset(caller: HubCaller, assetId: string): Promise<LibraryResult<HubAsset>> {
  const asset = await getAsset(caller, assetId);
  if (!asset.ok) return asset;
  if (asset.value.status !== "APPROVED") {
    return {
      ok: false,
      code: "not_approved",
      message: "Only approved images can be assigned.",
      status: 409,
    };
  }
  return asset;
}

/** True when the hub's bytes can be copied as-is: already WebP and within the store cap (R14). */
function copiesAsIs(asset: HubAsset): boolean {
  return asset.contentType === IMAGE_CONTENT_TYPE && asset.byteSize <= MAX_IMAGE_BYTES;
}

/**
 * Fetches the hub bytes and writes them under a store key. Re-checks the bytes themselves, not just
 * the hub's metadata, before anything reaches storage. Returns false when they do not qualify, in
 * which case the caller falls back to browser conversion.
 */
async function copyBytes(
  caller: HubCaller,
  assetId: string,
  key: string,
): Promise<LibraryResult<boolean>> {
  const content = await getAssetContent(caller, assetId);
  if (!content.ok) return content;
  const type = content.value.headers.get("content-type")?.split(";")[0]?.trim();
  const bytes = await content.value.arrayBuffer();
  if (type !== IMAGE_CONTENT_TYPE || bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: true, value: false };
  }
  await getStorage().putObject(key, bytes, IMAGE_CONTENT_TYPE);
  return { ok: true, value: true };
}

/**
 * Records the usage and stores its id (R16). Returns a warning instead of failing: the image is
 * already assigned, and a missing usage record is recoverable where a broken product page is not.
 */
async function recordAndStoreUsage(
  caller: HubCaller,
  assetId: string,
  usage: { kind: HubUsageKind; externalId: string },
  store: (hubUsageId: string) => Promise<boolean>,
): Promise<string | null> {
  const recorded = await recordUsage(caller, assetId, usage);
  if (!recorded.ok) {
    console.error("[image-hub] usage not recorded", { assetId, ...usage, code: recorded.code });
    return USAGE_WARNING;
  }
  await store(recorded.value.id);
  return null;
}

/** Best-effort removal of a usage (R18). Never throws; logs a failure with both ids. */
async function releaseWithCaller(
  caller: HubCaller,
  ref: { hubAssetId: string; hubUsageId: string | null },
): Promise<void> {
  if (!ref.hubUsageId) return;
  const result = await deleteUsage(caller, ref.hubAssetId, ref.hubUsageId);
  if (!result.ok && result.code !== "not_found") {
    console.error("[image-hub] usage not removed", {
      assetId: ref.hubAssetId,
      usageId: ref.hubUsageId,
      code: result.code,
    });
  }
}

/**
 * #1671 R18 — remove a hub usage after the store removed or replaced the image that carried it.
 * Best effort: an unconfigured hub, a refused caller or a hub failure is logged and ignored, and the
 * store-side change it follows is never undone.
 */
export async function releaseHubUsage(
  ref: {
    hubAssetId: string;
    hubUsageId: string | null;
  } | null,
): Promise<void> {
  if (!ref?.hubUsageId) return;
  try {
    const resolved = await resolveCaller(
      await requireVendorRole(...STAFF_AND_ADMIN),
      STAFF_AND_ADMIN,
    );
    if (!resolved.ok) {
      console.error("[image-hub] usage not removed", {
        assetId: ref.hubAssetId,
        usageId: ref.hubUsageId,
        code: resolved.code,
      });
      return;
    }
    await releaseWithCaller(resolved.value.caller, ref);
  } catch (error) {
    console.error("[image-hub] usage not removed", {
      assetId: ref.hubAssetId,
      usageId: ref.hubUsageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function writeProductRow(
  resolved: ResolvedCaller,
  asset: HubAsset,
  productId: string,
  mode: ProductAssignMode,
  storageKey: string,
  alt: string,
): Promise<LibraryResult<AssignOutcome>> {
  const origin = { source: storeSourceForHubSource(asset.source), hubAssetId: asset.id };
  const altText = alt.trim() || asset.alt || "";
  const write =
    mode === "primary"
      ? await setPrimaryProductImage(resolved.vendorId, productId, storageKey, altText, origin)
      : await addProductImage(resolved.vendorId, productId, storageKey, altText, origin);
  if (!write.ok) return { ok: false, code: "not_found", message: write.error, status: 404 };

  // A repointed primary that came from the hub gives up its old usage (R18).
  if (write.replacedHubRef) await releaseWithCaller(resolved.caller, write.replacedHubRef);

  const warning = await recordAndStoreUsage(
    resolved.caller,
    asset.id,
    { kind: "PRODUCT", externalId: productId },
    (usageId) => setProductImageHubUsage(resolved.vendorId, write.imageId, usageId),
  );
  return {
    ok: true,
    value: { status: "assigned", url: getStorage().publicUrl(storageKey), warning },
  };
}

/**
 * Assign an approved library image to a product (R13, R14, R16, R17). Copies on the server when the
 * asset is a WebP within the cap; otherwise answers `needs_conversion` without writing anything.
 */
export async function assignLibraryAssetToProduct(input: {
  assetId: string;
  productId: string;
  mode: ProductAssignMode;
  alt?: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const resolved = await resolveCaller(
    await requireVendorRole(...STAFF_AND_ADMIN),
    STAFF_AND_ADMIN,
  );
  if (!resolved.ok) return resolved;
  const { caller, vendorId } = resolved.value;

  const product = await getProductForAdmin(vendorId, input.productId);
  if (!product) {
    return { ok: false, code: "not_found", message: "That product no longer exists.", status: 404 };
  }
  const asset = await approvedAsset(caller, input.assetId);
  if (!asset.ok) return asset;
  if (!copiesAsIs(asset.value)) return { ok: true, value: { status: "needs_conversion" } };

  const key = buildProductImageKey(product.id);
  const copied = await copyBytes(caller, asset.value.id, key);
  if (!copied.ok) return copied;
  if (!copied.value) return { ok: true, value: { status: "needs_conversion" } };

  return writeProductRow(resolved.value, asset.value, product.id, input.mode, key, input.alt ?? "");
}

/**
 * Finalize a browser-converted product assignment (R15): the browser uploaded the converted WebP
 * with a ticket from `requestImageUpload`; storage is asked what actually landed before any row.
 */
export async function finalizeProductAssign(input: {
  assetId: string;
  productId: string;
  mode: ProductAssignMode;
  storageKey: string;
  alt?: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const resolved = await resolveCaller(
    await requireVendorRole(...STAFF_AND_ADMIN),
    STAFF_AND_ADMIN,
  );
  if (!resolved.ok) return resolved;
  const { caller, vendorId } = resolved.value;

  const product = await getProductForAdmin(vendorId, input.productId);
  if (!product) {
    return { ok: false, code: "not_found", message: "That product no longer exists.", status: 404 };
  }
  if (!isProductImageKey(input.storageKey, product.id)) {
    return {
      ok: false,
      code: "validation",
      message: "That upload doesn't belong to this product.",
      status: 400,
    };
  }
  const landed = await checkLanded(input.storageKey);
  if (!landed.ok) return landed;

  const asset = await approvedAsset(caller, input.assetId);
  if (!asset.ok) return asset;
  return writeProductRow(
    resolved.value,
    asset.value,
    product.id,
    input.mode,
    input.storageKey,
    input.alt ?? "",
  );
}

/** The `headObject` checks `attachProductImage` makes, shared by both finalize paths (R15). */
async function checkLanded(key: string): Promise<LibraryResult<true>> {
  const head = await getStorage().headObject(key);
  const refuse = (message: string) => ({
    ok: false as const,
    code: "validation",
    message,
    status: 400,
  });
  if (!head) return refuse("That upload didn't arrive — please try again.");
  if (head.contentType !== IMAGE_CONTENT_TYPE) return refuse("That upload isn't a WebP image.");
  if (head.contentLength !== null && head.contentLength > MAX_IMAGE_BYTES) {
    return refuse(`Images must be under ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`);
  }
  return { ok: true, value: true };
}

async function writeCategoryRow(
  resolved: ResolvedCaller,
  asset: HubAsset,
  categoryId: string,
  storageKey: string,
): Promise<LibraryResult<AssignOutcome>> {
  const created = await createCategoryAssetForVendor(resolved.vendorId, {
    categoryId,
    storageKey,
    style: "photo",
    isSelected: true,
    hubAssetId: asset.id,
  });
  const warning = await recordAndStoreUsage(
    resolved.caller,
    asset.id,
    { kind: "CATEGORY", externalId: categoryId },
    (usageId) => setCategoryAssetHubUsageForVendor(resolved.vendorId, created.id, usageId),
  );
  return {
    ok: true,
    value: { status: "assigned", url: getStorage().publicUrl(storageKey), warning },
  };
}

/** True for a key `buildCategoryImageKey` could have produced for this vendor's category slug. */
function isCategoryImageKeyFor(key: string, vendorId: string, slug: string): boolean {
  const safeSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const prefix = `categories/${vendorId}/${safeSlug}-`;
  if (!key.startsWith(prefix) || !key.endsWith(".webp")) return false;
  return /^[0-9a-f]{8}$/.test(key.slice(prefix.length, -".webp".length));
}

/** Assign an approved library image to a category (R13, R14, R16). Store admins only. */
export async function assignLibraryAssetToCategory(input: {
  assetId: string;
  categoryId: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const resolved = await resolveCaller(await requireVendorRole(...ADMIN_ONLY), ADMIN_ONLY);
  if (!resolved.ok) return resolved;
  const { caller, vendorId } = resolved.value;

  const category = await getCategoryForAdmin(vendorId, input.categoryId);
  if (!category) {
    return {
      ok: false,
      code: "not_found",
      message: "That category no longer exists.",
      status: 404,
    };
  }
  const asset = await approvedAsset(caller, input.assetId);
  if (!asset.ok) return asset;
  if (!copiesAsIs(asset.value)) return { ok: true, value: { status: "needs_conversion" } };

  const key = buildCategoryImageKey(vendorId, category.slug);
  const copied = await copyBytes(caller, asset.value.id, key);
  if (!copied.ok) return copied;
  if (!copied.value) return { ok: true, value: { status: "needs_conversion" } };

  return writeCategoryRow(resolved.value, asset.value, category.id, key);
}

/** Finalize a browser-converted category assignment (R15). Store admins only. */
export async function finalizeCategoryAssign(input: {
  assetId: string;
  categoryId: string;
  storageKey: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const resolved = await resolveCaller(await requireVendorRole(...ADMIN_ONLY), ADMIN_ONLY);
  if (!resolved.ok) return resolved;
  const { caller, vendorId } = resolved.value;

  const category = await getCategoryForAdmin(vendorId, input.categoryId);
  if (!category) {
    return {
      ok: false,
      code: "not_found",
      message: "That category no longer exists.",
      status: 404,
    };
  }
  if (!isCategoryImageKeyFor(input.storageKey, vendorId, category.slug)) {
    return {
      ok: false,
      code: "validation",
      message: "That upload doesn't belong to this category.",
      status: 400,
    };
  }
  const landed = await checkLanded(input.storageKey);
  if (!landed.ok) return landed;

  const asset = await approvedAsset(caller, input.assetId);
  if (!asset.ok) return asset;
  return writeCategoryRow(resolved.value, asset.value, category.id, input.storageKey);
}

/**
 * #1671 R15 — presign one category image upload, for the browser-conversion path. Mirrors
 * `requestImageUpload`: the key is built here from a category this vendor was proven to own, never
 * named by the caller. Store admins only, like every other category image write.
 */
export async function requestCategoryImageUploadTicket(
  categoryId: string,
  byteLength: number,
): Promise<LibraryResult<UploadTicket>> {
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.reason,
      status: auth.status,
      message:
        auth.status === 401
          ? "Please sign in to use the image library."
          : "Only a store admin can do that.",
    };
  }
  if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      code: "validation",
      status: 400,
      message: `Images must be under ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`,
    };
  }
  const category = await getCategoryForAdmin(auth.vendorId, categoryId);
  if (!category) {
    return {
      ok: false,
      code: "not_found",
      message: "That category no longer exists.",
      status: 404,
    };
  }
  const key = buildCategoryImageKey(auth.vendorId, category.slug);
  const url = await getStorage().presignPut(key, IMAGE_CONTENT_TYPE, 300);
  return { ok: true, value: { url, key } };
}

/**
 * #1697 — search open licensed image repositories (Openverse, Wikimedia Commons, Open Food Facts).
 * Staff and store admins may search.
 */
export async function searchDiscoveredImagesForStaff(
  params: DiscoverySearchParams,
): Promise<LibraryResult<DiscoverySearchResult>> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.reason,
      status: auth.status,
      message:
        auth.status === 401
          ? "Please sign in to use the image library."
          : "Only store staff and admins can search image discovery.",
    };
  }
  const result = await searchDiscoveredImages(params);
  return { ok: true, value: result };
}

/**
 * #1697 — import an open-licensed discovered image into the Merqify Image Hub.
 * Fetches the image bytes server-side, validates content-type and size, and preserves full provenance.
 * The image lands in the hub as PENDING_REVIEW.
 */
export async function importDiscoveredImageToHub(
  image: DiscoveredImage,
): Promise<LibraryResult<HubAsset>> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.reason,
      status: auth.status,
      message:
        auth.status === 401
          ? "Please sign in to use the image library."
          : "Only store staff and admins can import images.",
    };
  }

  const resolved = await resolveCaller(auth, STAFF_AND_ADMIN);
  if (!resolved.ok) return resolved;

  const downloadUrl = image.originalUrl || image.thumbnailUrl;
  let res: Response;
  try {
    res = await fetch(downloadUrl, {
      headers: {
        "User-Agent":
          "AheedFoodCentre/1.0 (https://aheedfoodcentre.co.uk; info@aheedfoodcentre.co.uk)",
        Accept: "image/*",
      },
    });
  } catch (err) {
    return {
      ok: false,
      code: "fetch_failed",
      status: 502,
      message: `Failed to download image from source: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      code: "download_failed",
      status: 502,
      message: `Source server returned HTTP ${res.status}`,
    };
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return {
      ok: false,
      code: "invalid_content_type",
      status: 400,
      message: `Expected image content-type, received '${contentType || "none"}'`,
    };
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      code: "image_too_large",
      status: 400,
      message: `Image is too large (${Math.round(arrayBuffer.byteLength / 1024)} KB, max ${Math.round(
        MAX_IMAGE_BYTES / (1024 * 1024),
      )} MB)`,
    };
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const fileName = `${image.provider.toLowerCase()}-${Date.now()}.${ext}`;
  const file = new Blob([arrayBuffer], { type: contentType });

  const imported = await importAsset(resolved.value.caller, {
    file,
    fileName,
    title: image.title,
    source: image.provider,
    licence: image.licence,
    attribution: image.attribution,
    originalUrl: image.originalUrl,
    sourceSite: image.sourceSite,
    rightsConfirmed: true,
    status: "PENDING_REVIEW",
  });

  if (!imported.ok) return imported;
  return { ok: true, value: imported.value.asset };
}

export interface AiPromptProductCandidate {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  categoryName?: string | null;
}

/**
 * #1701 — List up to 15 products for prompt crafting, including both active and inactive products.
 */
export async function listProductsForAiPrompt(
  vendorId: string,
  q: string,
): Promise<AiPromptProductCandidate[]> {
  const term = q.trim();
  const page = await listProductsForAdmin(vendorId, {
    take: 15,
    ...(term ? { search: term } : {}),
  });
  return page.items.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    isActive: p.isActive,
    categoryName: p.categoryName ?? null,
  }));
}

export interface GenerateAiImageInput {
  prompt: string;
  productId?: string;
  title?: string;
}

/**
 * #1701 — Generate commercial product photography via Workers AI and import into the Image Hub as PENDING_REVIEW.
 * Requires STAFF or ADMIN role, verifies and debits daily AI meter, and preserves full AI provenance.
 */
export async function generateAiImageForLibrary(
  input: GenerateAiImageInput,
): Promise<LibraryResult<HubAsset>> {
  const auth = await requireVendorRole(...STAFF_AND_ADMIN);
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.reason,
      status: auth.status,
      message:
        auth.status === 401
          ? "Please sign in to use the image library."
          : "Only store staff and admins can generate images.",
    };
  }

  const resolved = await resolveCaller(auth, STAFF_AND_ADMIN);
  if (!resolved.ok) return resolved;

  const trimmedPrompt = input.prompt.trim();
  if (!trimmedPrompt) {
    return {
      ok: false,
      code: "validation",
      status: 400,
      message: "A prompt is required to generate an image.",
    };
  }

  const meter = getVendorAiMeter(auth.vendorId, "PRODUCT_IMAGE");
  const budget = await meter.check();
  if (!budget.allowed) {
    return {
      ok: false,
      code: "budget_exceeded",
      status: 429,
      message: describeAiBudgetRefusal(budget),
    };
  }

  const ai = getImageGenerationService();
  let imageBuffer: ArrayBuffer | null;
  try {
    imageBuffer = await ai.generateImage(trimmedPrompt);
  } catch (err) {
    return {
      ok: false,
      code: "generation_failed",
      status: 502,
      message: err instanceof Error ? err.message : "AI image generation failed.",
    };
  }

  if (!imageBuffer) {
    return {
      ok: false,
      code: "not_configured",
      status: 503,
      message: "Workers AI is not configured for image generation.",
    };
  }

  await meter.recordImage({ model: IMAGE_GENERATION_MODEL });

  const fileName = `ai-${Date.now()}.png`;
  const file = new Blob([imageBuffer], { type: "image/png" });
  const title =
    input.title?.trim() ||
    (trimmedPrompt.length > 80 ? trimmedPrompt.slice(0, 77) + "..." : trimmedPrompt);

  const imported = await importAsset(resolved.value.caller, {
    file,
    fileName,
    title,
    source: "AI_GENERATED",
    licence: "AI_GENERATED",
    rightsConfirmed: true,
    status: "PENDING_REVIEW",
  });

  if (!imported.ok) return imported;
  return { ok: true, value: imported.value.asset };
}
