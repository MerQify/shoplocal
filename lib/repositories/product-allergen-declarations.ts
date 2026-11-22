import type { getPrisma } from "@/lib/db";

type Client = ReturnType<typeof getPrisma>;

export function getProductAllergenEditorData(prisma: Client, vendorId: string, productId: string) {
  return prisma.product.findFirst({
    where: { vendorId, id: productId },
    select: {
      barcode: true,
      slug: true,
      allergenDeclaration: true,
    },
  });
}

export function getShopperAllergenDeclaration(prisma: Client, vendorId: string, productId: string) {
  return prisma.productAllergenDeclaration.findFirst({
    where: { productId, verifiedAt: { not: null }, product: { vendorId } },
    select: { ingredients: true, contains: true, mayContain: true },
  });
}

export function saveProductAllergenDeclaration(
  prisma: Client,
  productId: string,
  declaration: { ingredients: string; contains: string; mayContain: string; source: string },
) {
  const values = { ...declaration, verifiedAt: new Date() };
  return prisma.productAllergenDeclaration.upsert({
    where: { productId },
    update: values,
    create: { ...values, productId },
  });
}

export function hideProductAllergenDeclaration(prisma: Client, productId: string) {
  return prisma.productAllergenDeclaration.update({
    where: { productId },
    data: { verifiedAt: null },
  });
}
