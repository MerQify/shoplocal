import { getPrisma } from "@/lib/db";
import {
  getProductAllergenEditorData as readEditorData,
  getShopperAllergenDeclaration as readVerified,
  saveProductAllergenDeclaration as saveVerified,
  hideProductAllergenDeclaration as hideVerified,
} from "@/lib/repositories/product-allergen-declarations";

export function getProductAllergenEditorData(vendorId: string, productId: string) {
  return readEditorData(getPrisma(), vendorId, productId);
}

export function getShopperAllergenDeclaration(vendorId: string, productId: string) {
  return readVerified(getPrisma(), vendorId, productId);
}

export function saveProductAllergenDeclaration(
  productId: string,
  declaration: Parameters<typeof saveVerified>[2],
) {
  return saveVerified(getPrisma(), productId, declaration);
}

export function hideProductAllergenDeclaration(productId: string) {
  return hideVerified(getPrisma(), productId);
}
