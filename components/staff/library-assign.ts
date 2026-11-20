import {
  assignToCategoryAction,
  assignToProductAction,
  finalizeCategoryAssignAction,
  finalizeProductAssignAction,
  requestCategoryImageUpload,
} from "@/features/admin/image-library";
import { requestImageUpload } from "@/features/admin/product-image";
import type { ProductAssignMode } from "@/lib/image-hub-service";
import { IMAGE_CONTENT_TYPE, STORAGE_CACHE_CONTROL_IMMUTABLE } from "@/lib/product-image";
import { convertToWebp } from "@/lib/webp-convert";

/**
 * #1671 / #1678 — the browser half of assigning a library image, shared by `/staff/image-library`'s
 * Assign panel and the product page's library picker so the two can never drift.
 *
 * The sequence: the assign action; if the server answers `needs_conversion` (not a WebP, or over
 * the store's cap), fetch the bytes from the same-origin content route, convert them in this
 * browser, PUT them with a store ticket, then finalize. Hub usage recording happens server side in
 * both the assign and finalize actions.
 *
 * Imports only server actions, types and pure constants — never `lib/storage`, `lib/config` or the
 * hub client's request path.
 */

export type AssignTarget =
  { kind: "product"; id: string; name: string } | { kind: "category"; id: string; name: string };

export type AssignResult = { ok: true; warning: string | null } | { ok: false; error: string };

export function libraryContentUrl(assetId: string): string {
  return `/api/admin/image-library/${encodeURIComponent(assetId)}/content`;
}

async function convertAndUpload(
  assetId: string,
  target: AssignTarget,
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const response = await fetch(libraryContentUrl(assetId));
  if (!response.ok) return { ok: false, error: "The image couldn't be loaded from the library." };
  let blob: Blob;
  try {
    blob = await convertToWebp(await response.blob());
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "That image couldn't be read.",
    };
  }

  const ticket =
    target.kind === "product"
      ? await requestImageUpload(target.id, blob.size)
      : await requestCategoryImageUpload(target.id, blob.size);
  if (!ticket.ok) return { ok: false, error: "error" in ticket ? ticket.error : ticket.message };

  const put = await fetch(ticket.value.url, {
    method: "PUT",
    body: blob,
    headers: {
      "content-type": IMAGE_CONTENT_TYPE,
      "cache-control": STORAGE_CACHE_CONTROL_IMMUTABLE,
    },
  });
  if (!put.ok) return { ok: false, error: `The upload was rejected by storage (${put.status}).` };
  return { ok: true, key: ticket.value.key };
}

/** `mode` applies to products only; a category has a single image slot per asset. */
export async function assignLibraryAsset(
  assetId: string,
  target: AssignTarget,
  mode: ProductAssignMode,
  onProgress: (text: string) => void = () => {},
): Promise<AssignResult> {
  const first =
    target.kind === "product"
      ? await assignToProductAction({ assetId, productId: target.id, mode })
      : await assignToCategoryAction({ assetId, categoryId: target.id });
  if (!first.ok) return { ok: false, error: first.message };

  let outcome = first.value;
  if (outcome.status === "needs_conversion") {
    onProgress("Converting the image to WebP in your browser…");
    const uploaded = await convertAndUpload(assetId, target);
    if (!uploaded.ok) return uploaded;
    const finalized =
      target.kind === "product"
        ? await finalizeProductAssignAction({
            assetId,
            productId: target.id,
            mode,
            storageKey: uploaded.key,
          })
        : await finalizeCategoryAssignAction({
            assetId,
            categoryId: target.id,
            storageKey: uploaded.key,
          });
    if (!finalized.ok) return { ok: false, error: finalized.message };
    outcome = finalized.value;
  }
  if (outcome.status !== "assigned") {
    return { ok: false, error: "The image could not be assigned." };
  }
  return { ok: true, warning: outcome.warning };
}
