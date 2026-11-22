import { getPrisma } from "@/lib/db";

export function getProductAllergenEditorData(vendorId: string, productId: string) {
  return getPrisma().product.findFirst({
    where: { vendorId, id: productId },
    select: {
      barcode: true,
      slug: true,
      allergenDeclaration: true,
    },
  });
}

export function getShopperAllergenDeclaration(vendorId: string, productId: string) {
  return getPrisma().productAllergenDeclaration.findFirst({
    where: { productId, verifiedAt: { not: null }, product: { vendorId } },
    select: { ingredients: true, contains: true, mayContain: true },
  });
}

export function saveProductAllergenDeclaration(
  productId: string,
  declaration: { ingredients: string; contains: string; mayContain: string; source: string },
) {
  const values = { ...declaration, verifiedAt: new Date() };
  return getPrisma().productAllergenDeclaration.upsert({
    where: { productId },
    update: values,
    create: { ...values, productId },
  });
}

export function hideProductAllergenDeclaration(productId: string) {
  return getPrisma().productAllergenDeclaration.update({
    where: { productId },
    data: { verifiedAt: null },
  });
}
