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
  "Product ID [DO NOT EDIT]",
  "Product Name*",
  "Brand",
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
  "Product ID [DO NOT EDIT]",
  "Product Name*",
  "Brand",
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

export interface ColumnInstruction {
  required: boolean;
  description: string;
  example: string;
}

export const UNIVERSAL_COLUMN_INSTRUCTIONS: Record<UniversalColumn, ColumnInstruction> = {
  "Product ID [DO NOT EDIT]": {
    required: false,
    description:
      "System UUID. DO NOT EDIT! Leave unchanged when updating existing products. Leave blank when creating a new product.",
    example: "a4ed0000-0000-4000-a000-000000000001 or (blank)",
  },
  "Product Name*": {
    required: true,
    description: "Full descriptive product title including net content/pack size.",
    example: "Daawat Extra Long Basmati Rice 5kg",
  },
  Brand: {
    required: false,
    description:
      "Manufacturer brand name. Leave blank for unbranded, fresh butcher meat, or loose produce. Do NOT use Aheed.",
    example: "Daawat or (blank)",
  },
  "Category*": {
    required: true,
    description: "Category name. Matched case-insensitively.",
    example: "Rice & Grains",
  },
  Department: {
    required: false,
    description: "Top-level department name (parent category).",
    example: "Groceries",
  },
  "Price (£)*": {
    required: true,
    description: "Selling price in GBP (£). Decimal or integer.",
    example: "14.99",
  },
  "Compare At Price (£)": {
    required: false,
    description: "Original/was price to show strike-through discount.",
    example: "16.99",
  },
  "Cost Price (£)": {
    required: false,
    description: "Wholesale cost price in GBP.",
    example: "11.50",
  },
  "VAT Rate": {
    required: false,
    description: "VAT rate: 0%, 5%, or 20%. UK groceries are standard 0%.",
    example: "0%",
  },
  "Unit/Pack Size*": {
    required: true,
    description: "Display pack size label.",
    example: "5kg",
  },
  "Net Content Amount": {
    required: false,
    description: "Numeric quantity for unit pricing calculations.",
    example: "5",
  },
  "Net Content Unit": {
    required: false,
    description: "Unit: GRAM, KILOGRAM, MILLILITRE, LITRE, or EACH.",
    example: "KILOGRAM",
  },
  Barcode: {
    required: false,
    description: "EAN-13, EAN-8, or UPC barcode.",
    example: "5012345678900",
  },
  PLU: {
    required: false,
    description: "Price Look-Up code for fresh butcher or weighed produce.",
    example: "4011",
  },
  "Stock Mode*": {
    required: true,
    description:
      "TRACKED (decrement on purchase), UNTRACKED (unlimited), or UNKNOWN (needs audit).",
    example: "TRACKED",
  },
  "Current Stock": {
    required: false,
    description: "Available quantity in units.",
    example: "25",
  },
  "Low Stock Threshold": {
    required: false,
    description: "Alert threshold for low inventory warnings.",
    example: "5",
  },
  "Is Halal": {
    required: false,
    description: "TRUE or FALSE.",
    example: "TRUE",
  },
  "Is Vegetarian": {
    required: false,
    description: "TRUE or FALSE.",
    example: "TRUE",
  },
  "Is Fresh": {
    required: false,
    description: "TRUE or FALSE.",
    example: "FALSE",
  },
  "Is Organic": {
    required: false,
    description: "TRUE or FALSE.",
    example: "FALSE",
  },
  "Is Gluten Free": {
    required: false,
    description: "TRUE or FALSE.",
    example: "TRUE",
  },
  "Is HMC Certified": {
    required: false,
    description: "TRUE or FALSE. Halal Monitoring Committee certified.",
    example: "FALSE",
  },
  "HMC Reference": {
    required: false,
    description: "HMC certificate or license number.",
    example: "HMC-12345",
  },
  "HMC Verified At": {
    required: false,
    description: "Date when HMC certificate was audited (YYYY-MM-DD).",
    example: "2026-01-15",
  },
  "Age Restriction": {
    required: false,
    description: "NONE, 16, or 18.",
    example: "NONE",
  },
  "Country of Origin": {
    required: false,
    description: "Country where product originated.",
    example: "India",
  },
  "Attr: Storage": {
    required: false,
    description: "Storage instructions filter.",
    example: "Ambient, Chilled, or Frozen",
  },
  "Attr: Cut": {
    required: false,
    description: "Meat cut specification.",
    example: "Boneless, Diced, Minced, Whole",
  },
  "Attr: Variety / Grain / Species": {
    required: false,
    description: "Product grain or species variety.",
    example: "Basmati, Sella, Jasmine",
  },
  "Attr: Form": {
    required: false,
    description: "Product form factor.",
    example: "Whole, Ground, Powder, Liquid",
  },
  "Offer Group Qty": {
    required: false,
    description: "Quantity required to trigger multi-buy discount (e.g. 2 for £5).",
    example: "2",
  },
  "Offer Group Price (£)": {
    required: false,
    description: "Total bundle price in GBP when group quantity is met.",
    example: "5.00",
  },
  "Short Description": {
    required: false,
    description: "Brief summary for search previews.",
    example: "Premium aged Indian aromatic long grain rice.",
  },
  "Description / Notes": {
    required: false,
    description: "Full product description and handling instructions.",
    example: "Ideal for biryani and pilaf.",
  },
  Ingredients: {
    required: false,
    description: "List of ingredients.",
    example: "100% Basmati Rice",
  },
  "Allergen Info": {
    required: false,
    description: "Allergen warnings.",
    example: "Packed in a facility that handles nuts and gluten.",
  },
  "URL Slug": {
    required: false,
    description: "Custom URL slug. Auto-generated from name if left blank.",
    example: "daawat-extra-long-basmati-rice-5kg",
  },
  "Is Active": {
    required: false,
    description: "TRUE (visible to shoppers) or FALSE (hidden/draft).",
    example: "TRUE",
  },
  "Is Featured": {
    required: false,
    description: "TRUE (showcased on landing page) or FALSE.",
    example: "FALSE",
  },
};

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

  return "essential";
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
export const NET_CONTENT_UNITS = ["GRAM", "KILOGRAM", "MILLILITRE", "LITRE", "EACH"] as const;

/** Supported Stock Modes */
export const STOCK_MODES = ["UNKNOWN", "TRACKED", "UNTRACKED", "INFINITE"] as const;

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
