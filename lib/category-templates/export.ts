import { getPrisma } from "@/lib/db";
import { formatCsvTable } from "@/lib/product-templates/csv";

export const CATEGORY_EXPORT_COLUMNS = [
  "Category ID [DO NOT EDIT]",
  "Category Name*",
  "Slug*",
  "Department (Parent Category)",
  "Department Slug",
  "Sort Order",
  "Is Active",
  "Allows Custom Note",
  "Total Products",
] as const;

export type CategoryExportColumn = (typeof CATEGORY_EXPORT_COLUMNS)[number];

export interface CategoryForExport {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  allowsCustomNote: boolean;
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  _count?: {
    products: number;
  };
}

export function categoryToExportRow(c: CategoryForExport): Record<CategoryExportColumn, string> {
  return {
    "Category ID [DO NOT EDIT]": c.id,
    "Category Name*": c.name,
    "Slug*": c.slug,
    "Department (Parent Category)": c.parent?.name || "",
    "Department Slug": c.parent?.slug || "",
    "Sort Order": String(c.sortOrder),
    "Is Active": c.isActive ? "TRUE" : "FALSE",
    "Allows Custom Note": c.allowsCustomNote ? "TRUE" : "FALSE",
    "Total Products": String(c._count?.products ?? 0),
  };
}

export function exportCategoriesToCsv(categories: CategoryForExport[]): string {
  const rows = categories.map((c) => {
    const rowObj = categoryToExportRow(c);
    return CATEGORY_EXPORT_COLUMNS.map((col) => rowObj[col]);
  });
  return formatCsvTable(CATEGORY_EXPORT_COLUMNS, rows);
}

export function generateBlankCategoryCsv(): string {
  return formatCsvTable(CATEGORY_EXPORT_COLUMNS, []);
}

export interface CategoryExportFilterOptions {
  status?: "active" | "all" | "archived";
}

export async function fetchCategoriesForExport(
  vendorId: string,
  options?: CategoryExportFilterOptions,
): Promise<CategoryForExport[]> {
  const prisma = getPrisma();
  const status = options?.status ?? "active";

  const where: Record<string, any> = { vendorId };
  if (status === "active") {
    where.isActive = true;
  } else if (status === "archived") {
    where.isActive = false;
  }

  const categories = await prisma.category.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      isActive: true,
      allowsCustomNote: true,
      parent: {
        select: { id: true, name: true, slug: true },
      },
      _count: {
        select: { products: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories as unknown as CategoryForExport[];
}
