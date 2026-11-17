import { getPrisma } from "@/lib/db";
import { formatCsvTable } from "@/lib/product-templates/csv";
import { formatPenceToGbp } from "@/lib/product-templates/schema";

export const DISCOUNT_EXPORT_COLUMNS = [
  "Discount Code ID [DO NOT EDIT]",
  "Code*",
  "Description",
  "Kind*",
  "Value Display*",
  "Raw Value*",
  "Min Spend (£)",
  "Starts At",
  "Ends At",
  "Remaining Redemptions",
  "Max Per Customer",
  "Is Active",
  "Status",
] as const;

export type DiscountExportColumn = (typeof DISCOUNT_EXPORT_COLUMNS)[number];

export interface DiscountForExport {
  id: string;
  code: string;
  description: string | null;
  kind: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minSubtotalPence: number;
  startsAt: Date | string;
  endsAt: Date | string | null;
  remainingRedemptions: number | null;
  maxPerCustomer: number | null;
  isActive: boolean;
}

export function discountToExportRow(d: DiscountForExport): Record<DiscountExportColumn, string> {
  const now = new Date();
  const endsAtDate = d.endsAt ? new Date(d.endsAt) : null;
  const isExpired = endsAtDate ? endsAtDate < now : false;
  const isExhausted = d.remainingRedemptions === 0;

  let status = "ACTIVE";
  if (!d.isActive) {
    status = "INACTIVE";
  } else if (isExpired) {
    status = "EXPIRED";
  } else if (isExhausted) {
    status = "EXHAUSTED";
  }

  const valueDisplay =
    d.kind === "PERCENTAGE" ? `${(d.value / 100).toFixed(0)}%` : formatPenceToGbp(d.value);

  const startsAtStr = d.startsAt
    ? typeof d.startsAt === "string"
      ? d.startsAt.split("T")[0]
      : d.startsAt.toISOString().split("T")[0]
    : "";

  const endsAtStr = d.endsAt
    ? typeof d.endsAt === "string"
      ? d.endsAt.split("T")[0]
      : d.endsAt.toISOString().split("T")[0]
    : "";

  return {
    "Discount Code ID [DO NOT EDIT]": d.id,
    "Code*": d.code,
    Description: d.description || "",
    "Kind*": d.kind,
    "Value Display*": valueDisplay,
    "Raw Value*": String(d.value),
    "Min Spend (£)": d.minSubtotalPence > 0 ? formatPenceToGbp(d.minSubtotalPence) : "",
    "Starts At": startsAtStr,
    "Ends At": endsAtStr,
    "Remaining Redemptions":
      d.remainingRedemptions != null ? String(d.remainingRedemptions) : "Unlimited",
    "Max Per Customer": d.maxPerCustomer != null ? String(d.maxPerCustomer) : "Unlimited",
    "Is Active": d.isActive ? "TRUE" : "FALSE",
    Status: status,
  };
}

export function exportDiscountsToCsv(discounts: DiscountForExport[]): string {
  const rows = discounts.map((d) => {
    const rowObj = discountToExportRow(d);
    return DISCOUNT_EXPORT_COLUMNS.map((col) => rowObj[col]);
  });
  return formatCsvTable(DISCOUNT_EXPORT_COLUMNS, rows);
}

export function generateBlankDiscountCsv(): string {
  return formatCsvTable(DISCOUNT_EXPORT_COLUMNS, []);
}

export interface DiscountExportFilterOptions {
  status?: "active" | "all" | "archived";
}

export async function fetchDiscountsForExport(
  vendorId: string,
  options?: DiscountExportFilterOptions,
): Promise<DiscountForExport[]> {
  const prisma = getPrisma();
  const status = options?.status ?? "active";
  const now = new Date();

  const where: Record<string, any> = { vendorId };
  if (status === "active") {
    where.isActive = true;
    where.AND = [
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      { OR: [{ remainingRedemptions: null }, { remainingRedemptions: { gt: 0 } }] },
    ];
  } else if (status === "archived") {
    where.OR = [{ isActive: false }, { endsAt: { lt: now } }, { remainingRedemptions: 0 }];
  }

  const discounts = await prisma.discountCode.findMany({
    where,
    select: {
      id: true,
      code: true,
      description: true,
      kind: true,
      value: true,
      minSubtotalPence: true,
      startsAt: true,
      endsAt: true,
      remainingRedemptions: true,
      maxPerCustomer: true,
      isActive: true,
    },
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
  });

  return discounts as unknown as DiscountForExport[];
}
