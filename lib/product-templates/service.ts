import { getPrisma } from "../db";
import {
  exportProductsToUniversalCsv,
  exportProductsToEssentialCsv,
  productToUniversalRow,
  productToEssentialRow,
  type DatabaseProductForExport,
} from "./export";
import { UNIVERSAL_COLUMNS, ESSENTIAL_COLUMNS } from "./schema";
import { formatCsvTable } from "./csv";

/**
 * Fetch all stock records for a vendor with complete relational metadata.
 */
export async function fetchStockRecordsForExport(
  vendorId: string,
): Promise<DatabaseProductForExport[]> {
  const prisma = getPrisma();

  const products = await prisma.product.findMany({
    where: { vendorId },
    include: {
      brand: { select: { name: true } },
      category: {
        select: {
          name: true,
          slug: true,
          parent: { select: { name: true } },
        },
      },
      inventory: {
        select: {
          quantity: true,
          lowStockThreshold: true,
          stockMode: true,
        },
      },
      priceTier: {
        select: {
          groupQuantity: true,
          groupPricePence: true,
          isActive: true,
        },
      },
      attributeValues: {
        select: {
          attribute: { select: { name: true, slug: true } },
          option: { select: { name: true, slug: true } },
          numericValue: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return products as unknown as DatabaseProductForExport[];
}

/**
 * Generate Universal Product Export as CSV string.
 */
export async function generateUniversalStockCsv(vendorId: string): Promise<string> {
  const products = await fetchStockRecordsForExport(vendorId);
  return exportProductsToUniversalCsv(products);
}

/**
 * Generate Essential Product Export as CSV string.
 */
export async function generateEssentialStockCsv(vendorId: string): Promise<string> {
  const products = await fetchStockRecordsForExport(vendorId);
  return exportProductsToEssentialCsv(products);
}

/**
 * Generate blank Universal Template as CSV string.
 */
export function generateBlankUniversalCsv(): string {
  return formatCsvTable(UNIVERSAL_COLUMNS, []);
}

/**
 * Generate blank Essential Template as CSV string.
 */
export function generateBlankEssentialCsv(): string {
  return formatCsvTable(ESSENTIAL_COLUMNS, []);
}

/**
 * Sample rows for guidance and documentation.
 */
export function getUniversalSampleRows(): Record<string, string>[] {
  return [
    {
      "Product ID": "",
      "Product Name*": "Daawat Extra Long Basmati Rice 5kg",
      "Brand*": "Daawat",
      "Category*": "Rice & Grains",
      Department: "Groceries",
      "Price (£)*": "14.99",
      "Compare At Price (£)": "16.99",
      "Cost Price (£)": "11.50",
      "VAT Rate": "0%",
      "Unit/Pack Size*": "5kg",
      "Net Content Amount": "5",
      "Net Content Unit": "KILOGRAM",
      Barcode: "5012345678901",
      PLU: "1001",
      "Stock Mode*": "TRACKED",
      "Current Stock": "45",
      "Low Stock Threshold": "5",
      "Is Halal": "TRUE",
      "Is Vegetarian": "TRUE",
      "Is Fresh": "FALSE",
      "Is Organic": "FALSE",
      "Is Gluten Free": "TRUE",
      "Is HMC Certified": "FALSE",
      "HMC Reference": "",
      "HMC Verified At": "",
      "Age Restriction": "NONE",
      "Country of Origin": "India",
      "Attr: Storage": "Ambient",
      "Attr: Cut": "",
      "Attr: Variety / Grain / Species": "Basmati",
      "Attr: Form": "Grain",
      "Offer Group Qty": "2",
      "Offer Group Price (£)": "28.00",
      "Short Description": "Premium aged extra long basmati rice",
      "Description / Notes":
        "Fluffy, aromatic long grain basmati rice ideal for biryani and pilaf.",
      Ingredients: "100% Basmati Rice",
      "Allergen Info": "Gluten Free",
      "URL Slug": "daawat-extra-long-basmati-rice-5kg",
      "Is Active": "TRUE",
      "Is Featured": "TRUE",
    },
    {
      "Product ID": "",
      "Product Name*": "Fresh Halal Baby Chicken Curry Cut 1kg",
      "Brand*": "Aheed",
      "Category*": "Chicken & Poultry",
      Department: "Butchery",
      "Price (£)*": "4.99",
      "Compare At Price (£)": "",
      "Cost Price (£)": "3.50",
      "VAT Rate": "0%",
      "Unit/Pack Size*": "1kg",
      "Net Content Amount": "1",
      "Net Content Unit": "KILOGRAM",
      Barcode: "",
      PLU: "2045",
      "Stock Mode*": "UNTRACKED",
      "Current Stock": "",
      "Low Stock Threshold": "",
      "Is Halal": "TRUE",
      "Is Vegetarian": "FALSE",
      "Is Fresh": "TRUE",
      "Is Organic": "FALSE",
      "Is Gluten Free": "TRUE",
      "Is HMC Certified": "TRUE",
      "HMC Reference": "HMC-LON-8892",
      "HMC Verified At": "2026-01-15",
      "Age Restriction": "NONE",
      "Country of Origin": "United Kingdom",
      "Attr: Storage": "Chilled",
      "Attr: Cut": "Curry Cut",
      "Attr: Variety / Grain / Species": "Chicken",
      "Attr: Form": "Cut",
      "Offer Group Qty": "",
      "Offer Group Price (£)": "",
      "Short Description": "Fresh halal baby chicken pre-cut for curries",
      "Description / Notes": "Tender pieces of grade A British chicken, skin off, bone in.",
      Ingredients: "100% Halal Chicken",
      "Allergen Info": "None",
      "URL Slug": "fresh-halal-baby-chicken-curry-cut-1kg",
      "Is Active": "TRUE",
      "Is Featured": "FALSE",
    },
  ];
}

export function getEssentialSampleRows(): Record<string, string>[] {
  return [
    {
      "Product ID": "",
      "Product Name*": "Daawat Extra Long Basmati Rice 5kg",
      "Brand*": "Daawat",
      "Category*": "Rice & Grains",
      "Price (£)*": "14.99",
      "Unit/Pack Size*": "5kg",
      Barcode: "5012345678901",
      PLU: "1001",
      "Stock Mode*": "TRACKED",
      "Current Stock": "45",
      "Is Active": "TRUE",
    },
    {
      "Product ID": "",
      "Product Name*": "Fresh Halal Baby Chicken Curry Cut 1kg",
      "Brand*": "Aheed",
      "Category*": "Chicken & Poultry",
      "Price (£)*": "4.99",
      "Unit/Pack Size*": "1kg",
      Barcode: "",
      PLU: "2045",
      "Stock Mode*": "UNTRACKED",
      "Current Stock": "",
      "Is Active": "TRUE",
    },
  ];
}
