# Product Export Image Availability Indicator (build notes)

Fixes #1649.

## Changes Implemented

1. **Schema & Types (`lib/product-templates/schema.ts`):**
   - Added `"Image Available"` to `UNIVERSAL_COLUMNS` (positioned after `PLU`).
   - Added `"Image Available"` to `ESSENTIAL_COLUMNS` (positioned after `PLU`).
   - Added column metadata & instructions in `UNIVERSAL_COLUMN_INSTRUCTIONS["Image Available"]`.

2. **Image Availability Derivation (`lib/product-templates/export.ts`):**
   - Added `images?: Array<{ storageKey: string }> | null` to `DatabaseProductForExport`.
   - Added `hasProductImage(p: DatabaseProductForExport): boolean` helper checking for non-placeholder images via `isPlaceholderImageKey(img.storageKey)`.
   - Updated `productToUniversalRow` and `productToEssentialRow` to map `"Image Available": hasProductImage(p) ? "TRUE" : "FALSE"`.

3. **Data Retrieval (`lib/product-templates/service.ts`):**
   - Included `images: { select: { storageKey: true } }` in `fetchStockRecordsForExport`.
   - Updated sample rows for Universal and Essential templates to include `"Image Available": "TRUE"`.

4. **Spreadsheet In-Cell Dropdown Rules (`scripts/lib/read-spreadsheet.ts`):**
   - Added `"Image Available": "TRUE,FALSE"` to `UNIVERSAL_DROPDOWN_RULES`.
   - Added `"Image Available": "TRUE,FALSE"` to `ESSENTIAL_DROPDOWN_RULES`.

5. **Workbook & Template Generation Scripts:**
   - Updated `scripts/product-templates/generate-templates.ts` to document `Image Available` in the Field Guide.
   - Updated `scripts/product-templates/export-all-stock.ts` to query `images` and populate `Image Available` across all generated operational workbooks.
   - Re-generated static assets: `universal-product-template.{xlsx,csv}`, `essential-product-template.{xlsx,csv}`, `aheed-food-centre-stock-export.xlsx`, `aheed-food-centre-essential-export.xlsx`, and `aheed-food-centre-master-stock-export.xlsx`.

6. **Unit Tests (`tests/product-templates.test.ts`):**
   - Added tests verifying `Image Available` is `"FALSE"` when images are missing or only contain seeded placeholders (`/main.svg`).
   - Added tests verifying `Image Available` is `"TRUE"` when at least one real non-placeholder image exists.
   - Updated grid fixtures to maintain alignment with Essential schema.
