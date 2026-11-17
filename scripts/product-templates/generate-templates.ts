import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeWorkbook } from "../lib/read-spreadsheet";
import { UNIVERSAL_COLUMNS, ESSENTIAL_COLUMNS } from "../../lib/product-templates/schema";
import {
  getUniversalSampleRows,
  getEssentialSampleRows,
} from "../../lib/product-templates/service";
import { formatCsvTable } from "../../lib/product-templates/csv";

const OUTPUT_DIR = join(process.cwd(), "public", "templates");
mkdirSync(OUTPUT_DIR, { recursive: true });

// Column Field Documentation
const UNIVERSAL_FIELD_GUIDE: [string, string, string, string][] = [
  ["Column", "Mandatory", "Type", "Description"],
  [
    "Product ID [DO NOT EDIT]",
    "No (Blank for New)",
    "System Identifier",
    "DO NOT MODIFY! System database identifier used to match and update this exact product. If creating a new product, leave this cell completely blank.",
  ],
  [
    "Product Name*",
    "Yes",
    "Text",
    "Full customer-facing product name (e.g. 'Daawat Extra Long Basmati Rice 5kg').",
  ],
  ["Brand", "No", "Text", "Brand name (e.g. 'Daawat', 'Heera', 'Laila'). Leave blank if unbranded."],
  [
    "Category*",
    "Yes",
    "Text",
    "Product category name or slug (e.g. 'Rice & Grains', 'Spices & Masalas').",
  ],
  ["Department", "No", "Text", "High-level department (e.g. 'Groceries', 'Butchery', 'Produce')."],
  [
    "Price (£)*",
    "Yes",
    "Decimal",
    "Selling price in GBP (e.g. '14.99'). Do not include currency symbol.",
  ],
  [
    "Compare At Price (£)",
    "No",
    "Decimal",
    "Pre-discount original price. When set, displays discount strikethrough badge.",
  ],
  ["Cost Price (£)", "No", "Decimal", "Internal cost of goods."],
  [
    "VAT Rate",
    "No",
    "Text",
    "Tax rate ('0%', '5%', '20%'). Defaults to 0% for standard grocery items.",
  ],
  [
    "Unit/Pack Size*",
    "Yes",
    "Text",
    "Pack size or unit label (e.g. '5kg', '1kg', '500g', 'Each', 'per kg').",
  ],
  [
    "Net Content Amount",
    "No",
    "Integer",
    "Numeric net content (e.g. '5' for 5kg, '500' for 500g).",
  ],
  [
    "Net Content Unit",
    "No",
    "Text",
    "Unit of measurement: GRAM, KILOGRAM, MILLILITRE, LITRE, EACH.",
  ],
  ["Barcode", "No", "Text", "EAN-13, UPC, or till barcode."],
  ["PLU", "No", "Text", "Price Look-Up till code (e.g. '1001', '4011')."],
  [
    "Stock Mode*",
    "Yes",
    "Text",
    "Inventory mode: TRACKED (fixed stock), UNTRACKED (always in stock), INFINITE, UNKNOWN.",
  ],
  ["Current Stock", "No", "Integer", "Current stock quantity on hand."],
  [
    "Low Stock Threshold",
    "No",
    "Integer",
    "Threshold triggering low-stock alert (defaults to store setting).",
  ],
  ["Is Halal", "No", "Boolean", "TRUE or FALSE."],
  ["Is Vegetarian", "No", "Boolean", "TRUE or FALSE."],
  ["Is Fresh", "No", "Boolean", "TRUE or FALSE."],
  ["Is Organic", "No", "Boolean", "TRUE or FALSE."],
  ["Is Gluten Free", "No", "Boolean", "TRUE or FALSE."],
  [
    "Is HMC Certified",
    "No",
    "Boolean",
    "TRUE or FALSE. Requires HMC Reference & Verified At when TRUE.",
  ],
  [
    "HMC Reference",
    "No",
    "Text",
    "Halal Monitoring Committee certification certificate reference.",
  ],
  ["HMC Verified At", "No", "Date", "Verification date in YYYY-MM-DD format."],
  ["Age Restriction", "No", "Text", "NONE, 16, or 18."],
  [
    "Country of Origin",
    "No",
    "Text",
    "Country of provenance (e.g. 'India', 'United Kingdom', 'Pakistan').",
  ],
  ["Attr: Storage", "No", "Text", "Storage temperature: Ambient, Chilled, Frozen."],
  [
    "Attr: Cut",
    "No",
    "Text",
    "Butchery cut (e.g. 'Curry Cut', 'Whole', 'Diced', 'Fillets', 'Steaks').",
  ],
  [
    "Attr: Variety / Grain / Species",
    "No",
    "Text",
    "Grain variety or fish species (e.g. 'Basmati', 'Sona Masoori', 'Tilapia').",
  ],
  ["Attr: Form", "No", "Text", "Form factor (e.g. 'Powder', 'Whole', 'Paste', 'Leaves')."],
  ["Offer Group Qty", "No", "Integer", "Multi-buy bundle quantity (e.g. '3' for 3 for £10)."],
  ["Offer Group Price (£)", "No", "Decimal", "Multi-buy bundle price in GBP (e.g. '10.00')."],
  ["Short Description", "No", "Text", "Brief highlight shown on search and cards."],
  [
    "Description / Notes",
    "No",
    "Text",
    "Detailed description, serving suggestions, cooking notes.",
  ],
  ["Ingredients", "No", "Text", "Full ingredients list."],
  [
    "Allergen Info",
    "No",
    "Text",
    "Allergen declarations (e.g. 'Contains Mustard', 'Gluten Free').",
  ],
  ["URL Slug", "No", "Text", "Custom SEO slug (auto-generated from product name if left blank)."],
  ["Is Active", "No", "Boolean", "TRUE to publish live, FALSE to hide in catalogue."],
  ["Is Featured", "No", "Boolean", "TRUE to show in homepage Featured rail, FALSE otherwise."],
];

const ESSENTIAL_FIELD_GUIDE: [string, string, string, string][] = [
  ["Column", "Mandatory", "Type", "Description"],
  [
    "Product ID [DO NOT EDIT]",
    "No (Blank for New)",
    "System Identifier",
    "DO NOT MODIFY! System database identifier used to match and update this exact product. If creating a new product, leave this cell completely blank.",
  ],
  [
    "Product Name*",
    "Yes",
    "Text",
    "Customer-facing product name (e.g. 'Daawat Basmati Rice 5kg').",
  ],
  ["Brand", "No", "Text", "Brand name (e.g. 'Daawat', 'Heera', 'Laila'). Leave blank if unbranded."],
  ["Category*", "Yes", "Text", "Category name or slug (e.g. 'Rice & Grains')."],
  ["Price (£)*", "Yes", "Decimal", "Selling price in GBP (e.g. '14.99')."],
  ["Unit/Pack Size*", "Yes", "Text", "Pack size display label (e.g. '5kg', 'Each', '1kg')."],
  ["Barcode", "No", "Text", "EAN / UPC barcode for automatic matching."],
  ["PLU", "No", "Text", "Till PLU code for automatic matching."],
  ["Stock Mode*", "Yes", "Text", "TRACKED, UNTRACKED, INFINITE, or UNKNOWN (default: UNKNOWN)."],
  ["Current Stock", "No", "Integer", "Current stock quantity on hand."],
  ["Is Active", "No", "Boolean", "TRUE to publish live, FALSE to keep hidden (default: TRUE)."],
];

function main() {
  console.log("Generating standardised product import/export templates...");

  // 1. Universal Template (.xlsx & .csv)
  const universalSampleRows = getUniversalSampleRows().map((row) =>
    UNIVERSAL_COLUMNS.map((col) => row[col] || ""),
  );

  const universalRows: (string | number)[][] = [[...UNIVERSAL_COLUMNS], ...universalSampleRows];

  const universalColWidths = UNIVERSAL_COLUMNS.map((col) => {
    if (col === "Product Name*") return 38;
    if (col === "Description / Notes") return 45;
    if (col.startsWith("Product ID")) return 38;
    return Math.max(col.length + 3, 14);
  });

  const universalXlsxPath = join(OUTPUT_DIR, "universal-product-template.xlsx");
  writeWorkbook(universalXlsxPath, [
    { name: "Products", rows: universalRows, widths: universalColWidths },
    { name: "Field Instructions", rows: UNIVERSAL_FIELD_GUIDE, widths: [30, 12, 12, 65] },
  ]);
  console.log(`✓ Universal Template (.xlsx): ${universalXlsxPath}`);

  const universalCsvContent = formatCsvTable(UNIVERSAL_COLUMNS, universalSampleRows);
  const universalCsvPath = join(OUTPUT_DIR, "universal-product-template.csv");
  writeFileSync(universalCsvPath, universalCsvContent, "utf8");
  console.log(`✓ Universal Template (.csv): ${universalCsvPath}`);

  // 2. Essential Template (.xlsx & .csv)
  const essentialSampleRows = getEssentialSampleRows().map((row) =>
    ESSENTIAL_COLUMNS.map((col) => row[col] || ""),
  );

  const essentialRows: (string | number)[][] = [[...ESSENTIAL_COLUMNS], ...essentialSampleRows];

  const essentialColWidths = ESSENTIAL_COLUMNS.map((col) => {
    if (col === "Product Name*") return 38;
    if (col.startsWith("Product ID")) return 38;
    return Math.max(col.length + 3, 14);
  });

  const essentialXlsxPath = join(OUTPUT_DIR, "essential-product-template.xlsx");
  writeWorkbook(essentialXlsxPath, [
    { name: "Products", rows: essentialRows, widths: essentialColWidths },
    { name: "Field Instructions", rows: ESSENTIAL_FIELD_GUIDE, widths: [25, 12, 12, 65] },
  ]);
  console.log(`✓ Essential Template (.xlsx): ${essentialXlsxPath}`);

  const essentialCsvContent = formatCsvTable(ESSENTIAL_COLUMNS, essentialSampleRows);
  const essentialCsvPath = join(OUTPUT_DIR, "essential-product-template.csv");
  writeFileSync(essentialCsvPath, essentialCsvContent, "utf8");
  console.log(`✓ Essential Template (.csv): ${essentialCsvPath}`);

  console.log("Template generation complete.");
}

if (require.main === module) {
  main();
}
