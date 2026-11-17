---
id: 2026-11-17-essential-live-export-and-metadata-dropdowns-plan
title: "Essential Live Stock Export and Metadata Dropdowns in UI and Excel Workbooks (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-17
visibility: internal
summary: "Fix Essential Stock Export to return live database catalogue products rather than a blank template, add metadata filter dropdowns to the Store Admin Export Hub, and inject Excel Data Validation dropdowns into generated workbooks."
tags: [catalogue, export, essential-export, excel, dropdowns, data-validation]
related: [2026-11-17-fix-master-excel-export-download-plan]
---

# Essential Live Stock Export and Metadata Dropdowns in UI and Excel Workbooks (plan)

Fixes #1646. Requirements: `requirements.md`.

## Changes

1. **`app/(admin)/staff/platform/stock-export/export/route.ts`:**
   - Fix `type === "essential"` in CSV mode: call `generateEssentialStockCsv(auth.vendorId, { status, category })` instead of `generateBlankEssentialCsv()`.
   - Support `category` query parameter in search params and pass to stock export generators.
   - Support `type === "essential"` in XLSX mode redirecting to `/templates/aheed-food-centre-essential-export.xlsx`.

2. **`lib/product-templates/service.ts`:**
   - Extend `StockExportFilterOptions` with `category?: string`.
   - In `fetchStockRecordsForExport`, filter products matching category by `categoryId`, `category.slug`, `category.name`, or parent category.

3. **`components/staff/platform-stock-export/PlatformExportHub.tsx` & `page.tsx`:**
   - In `page.tsx`, query available vendor categories and pass to `PlatformExportHub`.
   - In `PlatformExportHub.tsx`, replace binary buttons with metadata dropdown selectors for Status (Active Only, All Records, Archived Only) and Category (All Departments & Categories, plus individual categories).
   - Add Excel (.xlsx) download link for Essential Stock Export alongside CSV.

4. **`scripts/lib/read-spreadsheet.ts` & Template Scripts:**
   - In `scripts/lib/read-spreadsheet.ts`, enhance `writeWorkbook` to support `validations?: SheetDataValidation[]` and inject OpenXML `<dataValidations>` into worksheet XMLs via `fflate`.
   - Export `UNIVERSAL_DROPDOWN_RULES` and `ESSENTIAL_DROPDOWN_RULES` for VAT Rate, Stock Mode, Storage Condition, Units, and Dietary Flags.
   - Regenerate all templates in `public/templates/` with interactive dropdowns.

5. **`tests/platform-stock-export-rbac.test.ts`:**
   - Add tests verifying `type=essential` returns live CSV stock rows.
