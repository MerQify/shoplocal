import { getPrisma } from "@/lib/db";
import { formatCsvTable } from "@/lib/product-templates/csv";

export const FILTER_EXPORT_COLUMNS = [
  "Attribute ID [DO NOT EDIT]",
  "Attribute Name*",
  "Attribute Slug*",
  "Kind",
  "Unit",
  "Show On Card",
  "Option ID [DO NOT EDIT]",
  "Option Name",
  "Option Slug",
  "Sort Order",
] as const;

export type FilterExportColumn = (typeof FILTER_EXPORT_COLUMNS)[number];

export interface VendorOptionForExport {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface VendorAttributeForExport {
  id: string;
  name: string;
  slug: string;
  kind: "LIST" | "NUMBER";
  unit: string | null;
  showOnCard: boolean;
  sortOrder: number;
  options: VendorOptionForExport[];
}

export function filterToExportRows(
  attr: VendorAttributeForExport,
): Record<FilterExportColumn, string>[] {
  if (!attr.options || attr.options.length === 0) {
    return [
      {
        "Attribute ID [DO NOT EDIT]": attr.id,
        "Attribute Name*": attr.name,
        "Attribute Slug*": attr.slug,
        Kind: attr.kind,
        Unit: attr.unit || "",
        "Show On Card": attr.showOnCard ? "TRUE" : "FALSE",
        "Option ID [DO NOT EDIT]": "",
        "Option Name": "",
        "Option Slug": "",
        "Sort Order": String(attr.sortOrder),
      },
    ];
  }

  return attr.options.map((opt) => ({
    "Attribute ID [DO NOT EDIT]": attr.id,
    "Attribute Name*": attr.name,
    "Attribute Slug*": attr.slug,
    Kind: attr.kind,
    Unit: attr.unit || "",
    "Show On Card": attr.showOnCard ? "TRUE" : "FALSE",
    "Option ID [DO NOT EDIT]": opt.id,
    "Option Name": opt.name,
    "Option Slug": opt.slug,
    "Sort Order": String(opt.sortOrder),
  }));
}

export function exportFiltersToCsv(attributes: VendorAttributeForExport[]): string {
  const rows: string[][] = [];
  for (const attr of attributes) {
    const optRows = filterToExportRows(attr);
    for (const r of optRows) {
      rows.push(FILTER_EXPORT_COLUMNS.map((col) => r[col]));
    }
  }
  return formatCsvTable(FILTER_EXPORT_COLUMNS, rows);
}

export function generateBlankFilterCsv(): string {
  return formatCsvTable(FILTER_EXPORT_COLUMNS, []);
}

export async function fetchFiltersForExport(vendorId: string): Promise<VendorAttributeForExport[]> {
  const prisma = getPrisma();

  const attributes = await prisma.vendorAttribute.findMany({
    where: { vendorId },
    select: {
      id: true,
      name: true,
      slug: true,
      kind: true,
      unit: true,
      showOnCard: true,
      sortOrder: true,
      options: {
        select: {
          id: true,
          name: true,
          slug: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return attributes as unknown as VendorAttributeForExport[];
}
