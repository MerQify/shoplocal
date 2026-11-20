"use server";

import { revalidatePath } from "next/cache";
import { requireVendorRole } from "@/lib/auth-rbac";
import { getProductForAdmin, listProductsForAdmin } from "@/lib/products-service";
import { listCategoriesForAdmin } from "@/lib/categories-service";
import {
  approveImageLibraryAsset,
  assignLibraryAssetToCategory,
  assignLibraryAssetToProduct,
  finalizeCategoryAssign,
  finalizeProductAssign,
  rejectImageLibraryAsset,
  requestCategoryImageUploadTicket,
  searchImageLibrary,
  type AssignOutcome,
  type LibraryResult,
  type ProductAssignMode,
} from "@/lib/image-hub-service";
import type { HubAsset, HubPage, HubSearchSort, HubStatus } from "@/lib/image-hub/client";
import type { UploadTicket } from "@/lib/product-image";

/**
 * #1671 — server actions for `/staff/image-library`. Thin: every rule (who may, what qualifies, the
 * copy-then-row order) lives in `lib/image-hub-service.ts`; these add only cache revalidation.
 *
 * A `"use server"` module may export ONLY async functions — not even a type-free constant — or
 * every action here 500s at runtime while build/typecheck/test stay green (CLAUDE.md). Shared
 * constants live in `lib/image-hub-service.ts` and `lib/image-hub/client.ts`.
 */

export async function searchLibraryAction(params: {
  q?: string;
  status?: HubStatus;
  sort?: HubSearchSort;
  cursor?: string;
}): Promise<LibraryResult<HubPage>> {
  return searchImageLibrary(params);
}

export async function approveLibraryAction(assetId: string): Promise<LibraryResult<HubAsset>> {
  const result = await approveImageLibraryAsset(assetId);
  if (result.ok) revalidatePath("/staff/image-library");
  return result;
}

export async function rejectLibraryAction(
  assetId: string,
  reason: string,
): Promise<LibraryResult<HubAsset>> {
  const result = await rejectImageLibraryAsset(assetId, reason);
  if (result.ok) revalidatePath("/staff/image-library");
  return result;
}

async function revalidateProduct(productId: string): Promise<void> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) return;
  const product = await getProductForAdmin(auth.vendorId, productId);
  if (!product) return;
  revalidatePath(`/staff/products/${product.id}`);
  revalidatePath("/staff/products");
  revalidatePath(`/products/${product.slug}`);
  revalidatePath("/categories", "layout");
}

function revalidateCategory(categoryId: string): void {
  revalidatePath("/staff/categories");
  revalidatePath(`/staff/categories/${categoryId}`);
  revalidatePath("/staff/icons");
  revalidatePath("/categories", "layout");
  revalidatePath("/");
}

export async function assignToProductAction(input: {
  assetId: string;
  productId: string;
  mode: ProductAssignMode;
  alt?: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const result = await assignLibraryAssetToProduct(input);
  if (result.ok && result.value.status === "assigned") await revalidateProduct(input.productId);
  return result;
}

export async function finalizeProductAssignAction(input: {
  assetId: string;
  productId: string;
  mode: ProductAssignMode;
  storageKey: string;
  alt?: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const result = await finalizeProductAssign(input);
  if (result.ok) await revalidateProduct(input.productId);
  return result;
}

export async function assignToCategoryAction(input: {
  assetId: string;
  categoryId: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const result = await assignLibraryAssetToCategory(input);
  if (result.ok && result.value.status === "assigned") revalidateCategory(input.categoryId);
  return result;
}

export async function finalizeCategoryAssignAction(input: {
  assetId: string;
  categoryId: string;
  storageKey: string;
}): Promise<LibraryResult<AssignOutcome>> {
  const result = await finalizeCategoryAssign(input);
  if (result.ok) revalidateCategory(input.categoryId);
  return result;
}

/** #1671 R15 — presign a category image upload for the browser-conversion path (admins only). */
export async function requestCategoryImageUpload(
  categoryId: string,
  byteLength: number,
): Promise<LibraryResult<UploadTicket>> {
  return requestCategoryImageUploadTicket(categoryId, byteLength);
}

/** The product picker: up to 10 of this vendor's products matching `q`. */
export async function searchProductsForAssign(
  q: string,
): Promise<Array<{ id: string; name: string }>> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  const page = await listProductsForAdmin(auth.vendorId, { take: 10, search: term });
  return page.items.map((p) => ({ id: p.id, name: p.name }));
}

/** The category picker: this vendor's categories (admins only, like category assignment). */
export async function listCategoriesForAssign(): Promise<Array<{ id: string; name: string }>> {
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) return [];
  const rows = await listCategoriesForAdmin(auth.vendorId);
  return rows.map((c) => ({ id: c.id, name: c.name }));
}
