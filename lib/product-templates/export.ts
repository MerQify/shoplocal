import {
  UNIVERSAL_COLUMNS,
  ESSENTIAL_COLUMNS,
  formatPenceToGbp,
  type UniversalColumn,
  type EssentialColumn,
} from "./schema";
import { formatCsvTable } from "./csv";

export interface DatabaseProductForExport {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  unitLabel: string;
  netContentAmount: number | null;
  netContentUnit: string | null;
  originalPrice: number | null;
  vatRate: number;
  isActive: boolean;
  isFeatured: boolean;
  origin: string | null;
  isHalal: boolean;
  isFresh: boolean;
  isOrganic: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isHmcCertified: boolean;
  hmcReference: string | null;
  hmcVerifiedAt: Date | string | null;
  restriction: string | null;
  plu: string | null;
  barcode: string | null;
  brand?: { name: string } | null;
  category: {
    name: string;
    slug: string;
    parent?: { name: string } | null;
  };
  inventory?: {
    quantity: number;
    lowStockThreshold: number;
    stockMode: string;
  } | null;
  priceTier?: {
    groupQuantity: number;
    groupPricePence: number;
    isActive: boolean;
  } | null;
  attributeValues?: Array<{
    attribute: { name: string; slug: string };
    option?: { name: string; slug: string } | null;
    numericValue?: any;
  }>;
}

/** Convert a database product into a row for the Universal Product Template */
export function productToUniversalRow(
  p: DatabaseProductForExport,
): Record<UniversalColumn, string> {
  // Extract attributes
  const attrMap: Record<string, string> = {};
  if (p.attributeValues) {
    for (const av of p.attributeValues) {
      const attrSlug = av.attribute.slug.toLowerCase();
      const val = av.option?.name || (av.numericValue != null ? String(av.numericValue) : "");
      if (val) attrMap[attrSlug] = val;
    }
  }

  const findAttr = (...keys: string[]): string => {
    for (const k of keys) {
      const match = Object.keys(attrMap).find(
        (slug) => slug === k.toLowerCase() || slug.includes(k.toLowerCase()),
      );
      if (match && attrMap[match]) return attrMap[match];
    }
    return "";
  };

  const hmcVerifiedDate = p.hmcVerifiedAt
    ? typeof p.hmcVerifiedAt === "string"
      ? p.hmcVerifiedAt.split("T")[0]
      : p.hmcVerifiedAt.toISOString().split("T")[0]
    : "";

  let ageRestriction = "NONE";
  if (p.restriction === "AGE_RESTRICTED_16") ageRestriction = "16";
  if (p.restriction === "AGE_RESTRICTED_18") ageRestriction = "18";

  let vatRateStr = "";
  if (p.vatRate === 2000) vatRateStr = "20%";
  else if (p.vatRate === 500) vatRateStr = "5%";
  else if (p.vatRate === 0) vatRateStr = "0%";

  return {
    "Product ID": p.id,
    "Product Name*": p.name,
    "Brand*": p.brand?.name || "Aheed",
    "Category*": p.category.name,
    Department: p.category.parent?.name || "",
    "Price (£)*": formatPenceToGbp(p.basePrice),
    "Compare At Price (£)": p.originalPrice ? formatPenceToGbp(p.originalPrice) : "",
    "Cost Price (£)": "",
    "VAT Rate": vatRateStr,
    "Unit/Pack Size*": p.unitLabel,
    "Net Content Amount": p.netContentAmount != null ? String(p.netContentAmount) : "",
    "Net Content Unit": p.netContentUnit || "",
    Barcode: p.barcode || "",
    PLU: p.plu || "",
    "Stock Mode*": p.inventory?.stockMode || "UNKNOWN",
    "Current Stock": p.inventory?.quantity != null ? String(p.inventory.quantity) : "",
    "Low Stock Threshold":
      p.inventory?.lowStockThreshold != null ? String(p.inventory.lowStockThreshold) : "",
    "Is Halal": p.isHalal ? "TRUE" : "FALSE",
    "Is Vegetarian": p.isVegetarian ? "TRUE" : "FALSE",
    "Is Fresh": p.isFresh ? "TRUE" : "FALSE",
    "Is Organic": p.isOrganic ? "TRUE" : "FALSE",
    "Is Gluten Free": p.isGlutenFree ? "TRUE" : "FALSE",
    "Is HMC Certified": p.isHmcCertified ? "TRUE" : "FALSE",
    "HMC Reference": p.hmcReference || "",
    "HMC Verified At": hmcVerifiedDate,
    "Age Restriction": ageRestriction,
    "Country of Origin": p.origin || "",
    "Attr: Storage": findAttr("storage"),
    "Attr: Cut": findAttr("cut"),
    "Attr: Variety / Grain / Species": findAttr("variety", "grain", "species"),
    "Attr: Form": findAttr("form"),
    "Offer Group Qty": p.priceTier && p.priceTier.isActive ? String(p.priceTier.groupQuantity) : "",
    "Offer Group Price (£)":
      p.priceTier && p.priceTier.isActive ? formatPenceToGbp(p.priceTier.groupPricePence) : "",
    "Short Description": "",
    "Description / Notes": p.description || "",
    Ingredients: "",
    "Allergen Info": "",
    "URL Slug": p.slug,
    "Is Active": p.isActive ? "TRUE" : "FALSE",
    "Is Featured": p.isFeatured ? "TRUE" : "FALSE",
  };
}

/** Convert a database product into a row for the Essential Product Template */
export function productToEssentialRow(
  p: DatabaseProductForExport,
): Record<EssentialColumn, string> {
  return {
    "Product ID": p.id,
    "Product Name*": p.name,
    "Brand*": p.brand?.name || "Aheed",
    "Category*": p.category.name,
    "Price (£)*": formatPenceToGbp(p.basePrice),
    "Unit/Pack Size*": p.unitLabel,
    Barcode: p.barcode || "",
    PLU: p.plu || "",
    "Stock Mode*": p.inventory?.stockMode || "UNKNOWN",
    "Current Stock": p.inventory?.quantity != null ? String(p.inventory.quantity) : "",
    "Is Active": p.isActive ? "TRUE" : "FALSE",
  };
}

/** Export all products to Universal CSV string */
export function exportProductsToUniversalCsv(products: DatabaseProductForExport[]): string {
  const rows = products.map((p) => {
    const rowObj = productToUniversalRow(p);
    return UNIVERSAL_COLUMNS.map((col) => rowObj[col]);
  });
  return formatCsvTable(UNIVERSAL_COLUMNS, rows);
}

/** Export all products to Essential CSV string */
export function exportProductsToEssentialCsv(products: DatabaseProductForExport[]): string {
  const rows = products.map((p) => {
    const rowObj = productToEssentialRow(p);
    return ESSENTIAL_COLUMNS.map((col) => rowObj[col]);
  });
  return formatCsvTable(ESSENTIAL_COLUMNS, rows);
}
