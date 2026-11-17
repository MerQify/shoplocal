# Standardised Product Import/Export Templates and Platform Admin Stock Export (build notes)

Issue #1634. Built 2026-11-17 on branch `feature/1634-product-templates-and-stock-export`.

## What changed and why

- **`lib/product-templates/schema.ts` (new):**
  Defines the comprehensive Universal template (40 columns) and streamlined Essential template (11 columns).
  Mandatory columns are marked with `*` (`Product Name*`, `Brand*`, `Category*`, `Price (£)*`, `Unit/Pack Size*`, `Stock Mode*`).
  Provides header auto-detection (`detectTemplateType`) and pure formatters/parsers for money, booleans, and integers.

- **`lib/product-templates/csv.ts` (new):**
  Pure RFC-4180 CSV serializer and parser with UTF-8 BOM (`\uFEFF`) support so that files open cleanly in Excel without mangling special characters or symbols. Completely dependency-free.

- **`lib/product-templates/import.ts` (new):**
  Validates uploaded spreadsheet grids against the standard template schemas with row-level error reporting. Implements zero-decision matching logic: lines are matched against existing products by `Product ID` (highest authority), `Barcode`, `PLU`, or exact product name to resolve `UPDATE`, while valid non-matched lines resolve `CREATE` (`autoReady: true`).

- **`lib/product-templates/export.ts` & `lib/product-templates/service.ts` (new):**
  Serializes rich Prisma product entities (with category hierarchies, inventory, brand relations, attribute values, and price tiers) into Universal and Essential rows without loss.

- **`app/(admin)/staff/platform/stock-export/page.tsx` & `export/route.ts` (new):**
  Dedicated Platform Admin stock and template export page and secure download route. Gated strictly to `auth.via === "platform-admin"`; store admins and non-platform staff receive refusal/403.

- **`scripts/product-templates/` (new):**
  - `generate-templates.ts`: Generates standard `.xlsx` (with Products and Field Instructions sheets) and `.csv` blank/sample templates in `public/templates/`.
  - `export-all-stock.ts`: Exports all 6,303 live catalogue records from the database into `public/templates/` and `.import-reports/exports/` in both `.xlsx` and `.csv` formats.

## Decisions taken during the build

- **Preserving Worker bundle isolation:**
  Per `tests/catalogue-import-guards.test.ts`, `@e965/xlsx` must not be imported anywhere under `app/`, `features/`, `components/`, `lib/`, or `prisma/`. All runtime and route code remains pure or generates CSV, while script generation routes through `scripts/lib/read-spreadsheet.ts`.
- **Including Brand in Essential Template:**
  User explicitly directed: "in the minimum one include Brand and other essntial one plan is to be able to import everythign with outaskign for anydecision if the informaiton is the format we haev asked for". Essential template mandates Brand alongside Name, Category, Price, and Unit/Pack Size.
- **Two-way update mechanics:**
  When exported stock data is edited and re-uploaded, existing products are resolved by Product ID, Barcode, or PLU, preserving existing `manuallyEditedFields`.

## Deviations from the spec

None. All deliverables (Universal Template, Essential Template, Live Data Population of 6,303 records, Import/Export Engine with Zero-Decision automation, and Platform Admin-only RBAC Export) were built to specification.

## Known-shaky areas

- **Browser-level Excel upload parsing:**
  While CSV files parse instantly via pure code, browser-side Excel parsing on client devices requires SheetJS from CDN (as loaded by `read-stock-file.ts`). If a client network blocks the CDN script, users should use the standard CSV format.
- **Category name matching:**
  When new categories are imported via template, the category name is matched against existing vendor categories. If an unrecognised category name is supplied, the row is flagged with a validation error rather than creating an orphan category.
