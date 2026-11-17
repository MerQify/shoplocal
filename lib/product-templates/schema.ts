import { z } from "zod";

/**
 * Standardised Product Import/Export Templates
 *
 * Universal Template: All available product fields including category-specific attributes,
 * dietary flags, tax, inventory, and promotions.
 *
 * Essential Template: Mandatory fields only (including Brand) for rapid zero-decision bulk imports.
 */

export const UNIVERSAL_COLUMNS = [
  "Product ID",
  "Product Name*",
  "Brand*",
  "Category*",
  "Department",
  "Price (£)*",
  "Compare At Price (£)",
  "Cost Price (£)",
  "VAT Rate",
  "Unit/Pack Size*",
  "Net Content Amount",
  "Net Content Unit",
  "Barcode",
  "PLU",
  "Stock Mode*",
  "Current Stock",
  "Low Stock Threshold",
  "Is Halal",
  "Is Vegetarian",
  "Is Fresh",
  "Is Organic",
  "Is Gluten Free",
  "Is HMC Certified",
  "HMC Reference",
  "HMC Verified At",
  "Age Restriction",
  "Country of Origin",
  "Attr: Storage",
  "Attr: Cut",
  "Attr: Variety / Grain / Species",
  "Attr: Form",
  "Offer Group Qty",
  "Offer Group Price (£)",
  "Short Description",
  "Description / Notes",
  "Ingredients",
  "Allergen Info",
  "URL Slug",
  "Is Active",
  "Is Featured",
] as const;

export type UniversalColumn = (typeof UNIVERSAL_COLUMNS)[number];

export const ESSENTIAL_COLUMNS = [
  "Product ID",
  "Product Name*",
  "Brand*",
  "Category*",
  "Price (£)*",
  "Unit/Pack Size*",
  "Barcode",
  "PLU",
  "Stock Mode*",
  "Current Stock",
  "Is Active",
] as const;

export type EssentialColumn = (typeof ESSENTIAL_COLUMNS)[number];

/** Normalize header label by stripping asterisks, parentheses, whitespace, lowercasing. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[£()]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Detect whether a given header list matches Universal or Essential template format. */
export function detectTemplateType(headers: string[]): "universal" | "essential" | "unknown" {
  const normalized = headers.map(normalizeHeader);

  const hasName = normalized.some((h) => h === "productname" || h === "name");
  const hasBrand = normalized.some((h) => h === "brand");
  const hasCategory = normalized.some((h) => h === "category");
  const hasPrice = normalized.some((h) => h === "price" || h === "baseprice");

  if (!hasName || !hasCategory || !hasPrice) {
    return "unknown";
  }

  const universalSignatures = [
    "attrstorage",
    "attrcut",
    "attrvarietygrainspecies",
    "attrform",
    "ishalal",
    "compareatprice",
    "originalprice",
    "netcontentamount",
    "vatrate",
    "ishmccertified",
  ];

  const matchedUniversalCount = universalSignatures.filter((sig) =>
    normalized.includes(sig),
  ).length;

  if (matchedUniversalCount >= 2 || headers.length >= 20) {
    return "universal";
  }

  if (hasBrand) {
    return "essential";
  }

  return "unknown";
}

/** Helper to parse money string (£2.49 or 2.49) to integer pence. Returns null if invalid or blank. */
export function parseMoneyToPence(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(/^[£$]/, "").trim();
  if (str === "") return null;
  const num = parseFloat(str);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

/** Helper to format integer pence into decimal string GBP e.g. "2.49" */
export function formatPenceToGbp(pence: number | null | undefined): string {
  if (pence === null || pence === undefined || isNaN(pence)) return "";
  return (pence / 100).toFixed(2);
}

/** Helper to parse boolean values: "true", "yes", "1", "y" => true; "false", "no", "0", "n" => false. */
export function parseBoolean(val: unknown, defaultValue = false): boolean {
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === "boolean") return val;
  const str = String(val).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(str)) return true;
  if (["false", "no", "n", "0"].includes(str)) return false;
  return defaultValue;
}

/** Helper to parse integer numbers. Returns null if blank or invalid. */
export function parseInteger(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === "") return null;
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

/** Supported Net Content Units */
export const NET_CONTENT_UNITS = [
  "GRAM",
  "KILOGRAM",
  "MILLILITRE",
  "LITRE",
  "EACH",
] as const;

/** Supported Stock Modes */
export const STOCK_MODES = [
  "UNKNOWN",
  "TRACKED",
  "UNTRACKED",
  "INFINITE",
] as const;

/** Row data structure after parsing */
export interface ParsedProductRow {
  rowNumber: number;
  productId?: string;
  name: string;
  brand: string;
  category: string;
  department?: string;
  pricePence: number;
  originalPricePence?: number | null;
  costPricePence?: number | null;
  vatRatePercent?: number | null;
  unitLabel: string;
  netContentAmount?: number | null;
  netContentUnit?: (typeof NET_CONTENT_UNITS)[number] | null;
  barcode?: string | null;
  plu?: string | null;
  stockMode: (typeof STOCK_MODES)[number];
  currentStock?: number | null;
  lowStockThreshold?: number | null;
  isHalal: boolean;
  isVegetarian: boolean;
  isFresh: boolean;
  isOrganic: boolean;
  isGlutenFree: boolean;
  isHmcCertified: boolean;
  hmcReference?: string | null;
  hmcVerifiedAt?: Date | null;
  ageRestriction?: string | null;
  countryOfOrigin?: string | null;
  attributes: Record<string, string>;
  offerGroupQuantity?: number | null;
  offerGroupPricePence?: number | null;
  shortDescription?: string | null;
  description?: string | null;
  ingredients?: string | null;
  allergenInfo?: string | null;
  slug?: string | null;
  isActive: boolean;
  isFeatured: boolean;
}

export interface RowValidationError {
  rowNumber: number;
  field: string;
  message: string;
}
