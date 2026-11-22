"use server";

import { revalidatePath } from "next/cache";
import { requireVendorRole } from "@/lib/auth-rbac";
import {
  lookupAllergenDraft,
  productAllergenDeclarationSchema,
} from "@/lib/product-allergen-declaration";
import {
  getProductAllergenEditorData,
  hideProductAllergenDeclaration,
  saveProductAllergenDeclaration,
} from "@/lib/repositories/product-allergen-declarations";

export async function fetchProductAllergenDraft(productId: string) {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) return { ok: false as const, message: "Staff access is required." };
  const product = await getProductAllergenEditorData(auth.vendorId, productId);
  if (!product?.barcode)
    return {
      ok: false as const,
      message: "This product has no saved barcode. Enter the declaration manually.",
    };
  try {
    const draft = await lookupAllergenDraft(product.barcode);
    if (draft) return { ok: true as const, draft };
    return {
      ok: false as const,
      message:
        "No ingredient or allergen data was found for this barcode. Enter the declaration manually.",
    };
  } catch {
    return {
      ok: false as const,
      message: "Barcode lookup is unavailable. Enter the declaration manually or try again.",
    };
  }
}

export async function saveProductAllergenForm(productId: string, form: FormData) {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) return { ok: false as const, message: "Staff access is required." };
  const product = await getProductAllergenEditorData(auth.vendorId, productId);
  if (!product) return { ok: false as const, message: "Product could not be found." };

  const parsed = productAllergenDeclarationSchema.safeParse({
    ingredients: form.get("ingredients"),
    contains: form.get("contains"),
    mayContain: form.get("mayContain"),
    source: form.get("source"),
    confirmed: form.get("confirmed"),
  });
  if (!parsed.success)
    return {
      ok: false as const,
      message:
        "Enter a declaration and its source, then confirm it against the current label or supplier specification.",
    };
  const { ingredients, contains, mayContain, source } = parsed.data;
  await saveProductAllergenDeclaration(productId, { ingredients, contains, mayContain, source });
  revalidatePath(`/staff/products/${productId}`);
  revalidatePath(`/products/${product.slug}`);
  return { ok: true as const, message: "Verified declaration saved." };
}

export async function hideProductAllergenForm(productId: string) {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) return { ok: false as const, message: "Staff access is required." };
  const product = await getProductAllergenEditorData(auth.vendorId, productId);
  if (!product?.allergenDeclaration)
    return { ok: false as const, message: "Declaration could not be found." };
  await hideProductAllergenDeclaration(productId);
  revalidatePath(`/staff/products/${productId}`);
  revalidatePath(`/products/${product.slug}`);
  return { ok: true as const, message: "Declaration hidden. Saved text is available for review." };
}
