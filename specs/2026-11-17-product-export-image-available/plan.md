---
id: 2026-11-17-product-export-image-available-plan
title: "Product Export Image Availability Indicator (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-17
visibility: internal
summary: "Add Image Available column to Universal and Essential product exports, static templates, Master Operational workbook, and native Excel in-cell dropdown rules."
tags: [catalogue, export, image-available, templates, excel, dropdowns]
---

# Product Export Image Availability Indicator (plan)

Fixes #1649.

## 1. Schema & Data Model
- Update `lib/product-templates/schema.ts`:
  - Add `"Image Available"` to `UNIVERSAL_COLUMNS` (e.g. after `"PLU"` or alongside status flags).
  - Add `"Image Available"` to `ESSENTIAL_COLUMNS`.
  - Add `"Image Available"` to `UNIVERSAL_COLUMN_INSTRUCTIONS` with description and example `"TRUE or FALSE"`.
  - Update sample rows in `lib/product-templates/service.ts`.
- Update `DatabaseProductForExport` in `lib/product-templates/export.ts`:
  - Add `images?: Array<{ storageKey: string }>`.
  - In `productToUniversalRow` and `productToEssentialRow`, compute:
    ```ts
    const hasRealImage = Boolean(
      p.images && p.images.some((img) => !isPlaceholderImageKey(img.storageKey)),
    );
    const imageAvailableStr = hasRealImage ? "TRUE" : "FALSE";
    ```
- Update `lib/product-templates/service.ts`:
  - In `fetchStockRecordsForExport`, include `images: { select: { storageKey: true } }`.

## 2. Spreadsheet Validations & Generation Scripts
- Update `scripts/lib/read-spreadsheet.ts`:
  - Add `"Image Available": "TRUE,FALSE"` to `UNIVERSAL_DROPDOWN_RULES` and `ESSENTIAL_DROPDOWN_RULES`.
- Update `scripts/product-templates/export-all-stock.ts`:
  - Include `images: { select: { storageKey: true } }` in product queries.
  - Re-generate `public/templates/*.xlsx`.
- Update `scripts/product-templates/generate-templates.ts`:
  - Ensure blank and sample templates include `Image Available`.

## 3. Import Compatibility
- Verify `lib/product-templates/import.ts` tolerates `Image Available` without errors.

## 4. Tests & Validation
- Update `tests/product-templates.test.ts` to assert `Image Available` is present in Universal and Essential exports.
- Assert products without images or with `/main.svg` placeholder return `"FALSE"`.
- Assert products with real photos return `"TRUE"`.
- Run `npm run typecheck`, `npm run lint`, `npx vitest run --maxWorkers=4`.
