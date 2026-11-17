import { getPrisma } from "@/lib/db";
import { formatCsvTable } from "@/lib/product-templates/csv";

export const PROMOTION_EXPORT_COLUMNS = [
  "Promotion ID [DO NOT EDIT]",
  "Headline*",
  "Subtitle",
  "Badge Text",
  "Call To Action Text",
  "Link URL",
  "Priority",
  "Is Active",
  "Starts At",
  "Ends At",
  "Channel",
  "Target Type",
  "Target Name",
  "Target ID",
] as const;

export type PromotionExportColumn = (typeof PROMOTION_EXPORT_COLUMNS)[number];

export interface PromotionForExport {
  id: string;
  headline: string;
  subtitle: string | null;
  badgeText: string | null;
  callToActionText: string | null;
  linkUrl: string | null;
  priority: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  channel: string;
  categoryId: string | null;
  bundleId: string | null;
  discountCodeId: string | null;
  productId: string | null;
  category?: { name: string } | null;
  bundle?: { name: string } | null;
  product?: { name: string } | null;
  discountCode?: { code: string } | null;
}

export function promotionToExportRow(p: PromotionForExport): Record<PromotionExportColumn, string> {
  let targetType = "STORE_WIDE";
  let targetName = "Store-wide";
  let targetId = "";

  if (p.productId) {
    targetType = "PRODUCT";
    targetName = p.product?.name ? `Product: ${p.product.name}` : `Product (${p.productId})`;
    targetId = p.productId;
  } else if (p.bundleId) {
    targetType = "BUNDLE";
    targetName = p.bundle?.name ? `Bundle: ${p.bundle.name}` : `Bundle (${p.bundleId})`;
    targetId = p.bundleId;
  } else if (p.categoryId) {
    targetType = "CATEGORY";
    targetName = p.category?.name ? `Category: ${p.category.name}` : `Category (${p.categoryId})`;
    targetId = p.categoryId;
  } else if (p.discountCodeId) {
    targetType = "DISCOUNT_CODE";
    targetName = p.discountCode?.code
      ? `Discount: ${p.discountCode.code}`
      : `Discount (${p.discountCodeId})`;
    targetId = p.discountCodeId;
  }

  const startsAtStr = p.startsAt
    ? typeof p.startsAt === "string"
      ? p.startsAt
      : p.startsAt.toISOString().replace("T", " ").slice(0, 16)
    : "";

  const endsAtStr = p.endsAt
    ? typeof p.endsAt === "string"
      ? p.endsAt
      : p.endsAt.toISOString().replace("T", " ").slice(0, 16)
    : "";

  return {
    "Promotion ID [DO NOT EDIT]": p.id,
    "Headline*": p.headline,
    Subtitle: p.subtitle || "",
    "Badge Text": p.badgeText || "",
    "Call To Action Text": p.callToActionText || "",
    "Link URL": p.linkUrl || "",
    Priority: String(p.priority),
    "Is Active": p.isActive ? "TRUE" : "FALSE",
    "Starts At": startsAtStr,
    "Ends At": endsAtStr,
    Channel: p.channel || "WEBSITE",
    "Target Type": targetType,
    "Target Name": targetName,
    "Target ID": targetId,
  };
}

export function exportPromotionsToCsv(promotions: PromotionForExport[]): string {
  const rows = promotions.map((p) => {
    const rowObj = promotionToExportRow(p);
    return PROMOTION_EXPORT_COLUMNS.map((col) => rowObj[col]);
  });
  return formatCsvTable(PROMOTION_EXPORT_COLUMNS, rows);
}

export async function fetchPromotionsForExport(vendorId: string): Promise<PromotionForExport[]> {
  const prisma = getPrisma();
  const promotions = await prisma.promotion.findMany({
    where: { vendorId },
    include: {
      category: { select: { name: true } },
      bundle: { select: { name: true } },
      product: { select: { name: true } },
      discountCode: { select: { code: true } },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
  return promotions as unknown as PromotionForExport[];
}
