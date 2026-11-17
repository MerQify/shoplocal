---
id: 2026-11-17-product-templates-and-stock-export-plan
title: "Standardised Product Import/Export Templates and Platform Admin Stock Export (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-17
visibility: internal
summary: "Defines Universal and Essential product import/export schemas, exports existing stock into the Universal template, implements zero-decision bulk import/export processing, and provides a Platform Admin-only stock export page and API."
tags: [catalogue, templates, import, export, admin, platform]
related: [2026-11-14-staff-stock-import-plan, 2026-11-14-stock-data-import-plan]
---

# Standardised Product Import/Export Templates and Platform Admin Stock Export (plan)

Issue #1634. Requirements: `requirements.md`.

## Architectural Overview

```
                                      ┌──────────────────────────────────────────────┐
                                      │             Uploaded Spreadsheet             │
                                      │   (Universal Template or Essential Template) │
                                      └──────────────────────┬───────────────────────┘
                                                             │
                                                             ▼
                                      ┌──────────────────────────────────────────────┐
                                      │       lib/product-templates/schema.ts        │
                                      │   (Header detection & Zod schema validation) │
                                      └──────────────────────┬───────────────────────┘
                                                             │
                                                             ▼
                                      ┌──────────────────────────────────────────────┐
                                      │       lib/product-templates/import.ts        │
                                      │  - Zero-decision matching (ID / Barcode / PLU)│
                                      │  - Resolves CREATE vs UPDATE                 │
                                      │  - Row-level diagnostics & error isolation   │
                                      └──────────────────────┬───────────────────────┘
                                                             │
                                                             ▼
                                      ┌──────────────────────────────────────────────┐
                                      │   lib/repositories/product-templates.ts      │
                                      │  - Batch create/update with transaction safe  │
                                      │  - Respects manuallyEditedFields             │
                                      └──────────────────────────────────────────────┘
```

## Data & Schema

No database migrations required — all product fields, brands, categories, inventory, attributes, price tiers, and dietary metadata already exist in the PostgreSQL schema.

### Core Modules

1. **`lib/product-templates/schema.ts`**:
   - Column header constants and metadata for Universal and Essential templates.
   - Column markers for mandatory fields (`*`).
   - Zod validation schemas for row objects:
     - `UniversalProductRowSchema`: Validates money (`/^\d+(\.\d{1,2})?$/`), numbers, booleans (`TRUE`/`FALSE`, `1`/`0`, `yes`/`no`), dates (`YYYY-MM-DD`), enums (`StockMode`, `NetContentUnit`, `VatRate`, `AgeRestriction`).
     - `EssentialProductRowSchema`: Validates mandatory name, brand, category, price, unit label, and stock mode.
   - Template detection helper: `detectTemplateType(headers: string[]): "universal" | "essential" | "unknown"`.

2. **`lib/product-templates/export.ts`**:
   - `exportToUniversalRows(products: ProductWithRelations[])`: Maps Prisma products (with brands, categories, attributes, inventory) to Universal template rows.
   - `generateWorkbook(templateType: "universal" | "essential", rows: Record<string, any>[], options?: { sampleOnly?: boolean })`: Builds an `xlsx` workbook using `xlsx` library with auto-styled headers and instructions worksheet.
   - `generateCsv(templateType: "universal" | "essential", rows: Record<string, any>[])`: Builds a standard RFC-4180 CSV string.

3. **`lib/product-templates/import.ts`**:
   - `parseProductTemplateFile(buffer: Buffer, filename: string)`: Extracts raw row data from `.xlsx` or `.csv`.
   - `validateProductTemplateRows(templateType, rows)`: Validates rows, categorises into valid vs invalid with line numbers, field paths, and human-friendly messages.
   - `planTemplateImport(validRows, existingProductsMap)`:
     - Direct matching:
       - Match by `Product ID` (highest priority) -> `UPDATE`.
       - Match by `Barcode` (if unique match) -> `UPDATE`.
       - Match by `PLU` (if unique match) -> `UPDATE`.
       - No match -> `CREATE`.
     - Zero-decision mode flag: if confidence is definitive (standard template format), rows are tagged as `AUTO_READY` without needing line-by-line manual resolution.

4. **`lib/repositories/product-templates.ts`**:
   - `exportExistingStockRecords(vendorId: string)`: Queries all products for the vendor including categories, brands, attributes, and inventory items.
   - `applyTemplateImport(vendorId, plannedLines, userContext)`: Applies the approved/auto-planned lines using `getPrismaWs()` for transactional batches, honoring `manuallyEditedFields`.

5. **`app/(admin)/staff/platform/stock-export/`**:
   - `page.tsx`: Platform Admin page rendering download controls for:
     - Populated Universal Product Export (live catalogue data).
     - Blank Universal Product Template (`.xlsx` and `.csv`).
     - Blank Essential Product Template (`.xlsx` and `.csv`).
     - RBAC: Checked via `const auth = await requireVendorRole("ADMIN"); if (auth.via !== "platform-admin") return <PanelRefusal ... />`.
   - `export/route.ts`: Secure GET route for generating and streaming the live catalogue export or template files. Verified via same auth check.

6. **Navigation Integration**:
   - Add "Stock Export" to `components/staff/platform-nav-items.ts` with icon `Download` / `FileSpreadsheet`.

## Template Files & Artifacts

- Pre-generated sample blank templates saved to `public/templates/`:
  - `public/templates/universal-product-template.xlsx`
  - `public/templates/universal-product-template.csv`
  - `public/templates/essential-product-template.xlsx`
  - `public/templates/essential-product-template.csv`
- Populated export generated and saved into `.import-reports/exports/` and downloadable via platform admin route.

## Security & Guardrails

- `auth.via === "platform-admin"` strictly enforced on platform export route and page.
- Decimal money parsing cleanly translates to integer pence (`Math.round(parseFloat(price) * 100)`).
- Relational integrity: Brand names are normalised or auto-resolved; category slugs are matched against vendor categories; non-existent categories are flagged with validation errors rather than silently dropped.
- Preserves manual edits: Existing products keep fields recorded in `Product.manuallyEditedFields`.
