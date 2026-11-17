# Product Export Image Availability Indicator (requirements)

Fixes #1649.

## 1. Problem Statement
When operators export products from the Store Admin / Platform Stock Export Hub, they cannot determine which products currently lack a photograph or product image. To schedule AI image generation or arrange photography, operators currently have to cross-check products one by one in the admin UI.

## 2. Requirements

### R1. Image Availability Column in Universal & Essential Schemas
- An `Image Available` column MUST be added to both `UNIVERSAL_COLUMNS` and `ESSENTIAL_COLUMNS`.
- Column value MUST be `TRUE` or `FALSE`.
- A product is considered to have an image (`TRUE`) if it has at least one associated `ProductImage` whose `storageKey` is NOT a seeded placeholder (i.e. does not end in `/main.svg`).
- If a product has no image rows or all image rows are placeholders, `Image Available` MUST be `FALSE`.

### R2. Live Export Inclusion
- The live CSV and Excel exports from `/staff/platform/stock-export/export` and `/api/staff/stock/export`:
  - `fetchStockRecordsForExport` in `lib/product-templates/service.ts` MUST include `images: { select: { storageKey: true } }`.
  - `productToUniversalRow` and `productToEssentialRow` in `lib/product-templates/export.ts` MUST compute `Image Available` according to R1.
  - Universal CSV/Excel exports MUST include `Image Available`.
  - Essential CSV/Excel exports MUST include `Image Available`.

### R3. Master Operational Workbook & Static Asset Generation
- The 7-sheet Master Operational Workbook (`scripts/product-templates/export-all-stock.ts`) MUST include `Image Available` on the "Products" sheet.
- Blank templates (`scripts/product-templates/generate-templates.ts`) MUST include `Image Available` in the header row and instructions.
- Both `UNIVERSAL_DROPDOWN_RULES` and `ESSENTIAL_DROPDOWN_RULES` MUST include `"Image Available": "TRUE,FALSE"` so Excel provides an in-cell validation dropdown.

### R4. Re-import Compatibility & Read-Only Handling
- Re-importing a CSV or Excel file containing the `Image Available` column MUST NOT cause validation errors.
- `Image Available` MUST be treated as an informational / read-only column in `analyzeTemplateGrid` (`lib/product-templates/import.ts`).
- `UNIVERSAL_COLUMN_INSTRUCTIONS` MUST document `Image Available` as a derived/system audit flag.
