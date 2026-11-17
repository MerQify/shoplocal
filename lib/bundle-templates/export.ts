import { getPrisma } from "@/lib/db";
import { formatCsvTable } from "@/lib/product-templates/csv";

export const BUNDLE_EXPORT_COLUMNS = [
  "Bundle ID [DO NOT EDIT]",
  "Bundle Name*",
  "Slug*",
  "Tagline",
  "Is Active",
  "Sort Order",
  "Total Items",
  "Items Summary",
  "Items Specification [productId:quantity]",
] as const;

export type BundleExportColumn = (typeof BUNDLE_EXPORT_COLUMNS)[number];

export interface BundleItemForExport {
  productId: string;
  quantity: number;
  product?: {
    name: string;
    unitLabel?: string | null;
  } | null;
}

export interface BundleForExport {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  isActive: boolean;
  sortOrder: number;
  items: BundleItemForExport[];
}

export function bundleToExportRow(b: BundleForExport): Record<BundleExportColumn, string> {
  const itemsSummary = (b.items || [])
    .map((item) => {
      const pName = item.product?.name || `Product (${item.productId})`;
      const uLabel = item.product?.unitLabel ? ` ${item.product.unitLabel}` : "";
      return `${item.quantity}x ${pName}${uLabel}`;
    })
    .join("; ");

  const itemsSpec = (b.items || []).map((item) => `${item.productId}:${item.quantity}`).join(";");

  return {
    "Bundle ID [DO NOT EDIT]": b.id,
    "Bundle Name*": b.name,
    "Slug*": b.slug,
    Tagline: b.tagline || "",
    "Is Active": b.isActive ? "TRUE" : "FALSE",
    "Sort Order": String(b.sortOrder),
    "Total Items": String(b.items?.length || 0),
    "Items Summary": itemsSummary,
    "Items Specification [productId:quantity]": itemsSpec,
  };
}

export function exportBundlesToCsv(bundles: BundleForExport[]): string {
  const rows = bundles.map((b) => {
    const rowObj = bundleToExportRow(b);
    return BUNDLE_EXPORT_COLUMNS.map((col) => rowObj[col]);
  });
  return formatCsvTable(BUNDLE_EXPORT_COLUMNS, rows);
}

export async function fetchBundlesForExport(vendorId: string): Promise<BundleForExport[]> {
  const prisma = getPrisma();
  const bundles = await prisma.bundle.findMany({
    where: { vendorId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { name: true, unitLabel: true },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return bundles as unknown as BundleForExport[];
}
