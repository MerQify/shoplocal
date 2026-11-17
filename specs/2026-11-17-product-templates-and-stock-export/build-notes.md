# Standardised Product Import/Export Templates and Platform Admin Stock Export (build notes)

Issue #1634. Built 2026-11-17 on branch `feature/1634-product-templates-and-stock-export`.

## What was built

1. **Universal & Essential Product Schemas (`lib/product-templates/schema.ts`)**:
   - `UNIVERSAL_COLUMNS` (40 columns): All mandatory, optional, tax, dietary, speciality grocery attributes (`Attr: Storage`, `Attr: Cut`, `Attr: Variety / Grain / Species`, `Attr: Form`), HMC certifications, age restrictions, and multi-buy promotions.
   - `ESSENTIAL_COLUMNS` (11 columns): Streamlined minimal schema containing only essential fields (`Product ID`, `Product Name*`, `Brand*`, `Category*`, `Price (£)*`, `Unit/Pack Size*`, `Barcode`, `PLU`, `Stock Mode*`, `Current Stock`, `Is Active`). Includes `Brand*` as requested.
   - Pure formatters and parsers for money (pence <-> GBP decimal), booleans, integers, and template header auto-detection (`detectTemplateType`).

2. **Pure RFC-4180 CSV Serialization & Parsing (`lib/product-templates/csv.ts`)**:
   - Zero-dependency CSV table generator and parser with UTF-8 BOM (`\uFEFF`) support for seamless opening in Microsoft Excel.

3. **Two-Way Import Engine with Zero-Decision Automation (`lib/product-templates/import.ts`)**:
   - `analyzeTemplateGrid`: Auto-detects template type (Universal vs Essential), maps aliases, validates mandatory and optional fields with row/column error attribution.
   - Zero-decision matching: Auto-resolves `UPDATE` based on `Product ID` (highest priority), `Barcode`, `PLU`, or exact product name; auto-resolves `CREATE` for valid new rows; marks lines as `autoReady: true` for immediate single-click application without manual decision friction.

4. **Product Serializer & Service Layer (`lib/product-templates/export.ts`, `lib/product-templates/service.ts`)**:
   - Converts rich database product entities (with category hierarchies, inventory, brand relations, attribute values, and price tiers) into Universal and Essential rows without data loss.

5. **Template & Stock Generation Scripts (`scripts/product-templates/`)**:
   - `generate-templates.ts`: Generates standard `.xlsx` (with "Products" and "Field Instructions" sheets) and `.csv` blank/sample templates in `public/templates/`.
   - `export-all-stock.ts`: Exports all 6,303 live catalogue records from production database into `public/templates/` and `.import-reports/exports/` in both `.xlsx` and `.csv` formats.
   - Complies with `tests/catalogue-import-guards.test.ts` by routing spreadsheet workbook writes through `scripts/lib/read-spreadsheet.ts`.

6. **Platform Admin-Only Stock Export Page & API Route**:
   - `app/(admin)/staff/platform/stock-export/page.tsx`: Platform Admin page rendering download actions for live stock export, Universal template, and Essential template.
   - `app/(admin)/staff/platform/stock-export/export/route.ts`: Secure download endpoint streaming CSV or serving XLSX workbooks.
   - RBAC security: Strictly enforced at both frontend and backend layers with `auth.via === "platform-admin"`. Non-platform admins and store admins receive `PanelRefusal` / 403 Forbidden.
   - Registered in `components/staff/platform-nav-items.ts` under Platform Admin navigation.

7. **Test Suites**:
   - `tests/product-templates.test.ts` (15 tests): Schema parsing, template auto-detection, CSV round-trip, mandatory validation, zero-decision matching logic, and Worker bundle isolation.
   - `tests/platform-stock-export-rbac.test.ts` (3 tests): RBAC verification (401 unauthenticated, 403 store admin, 200 platform admin).
   - `tests/rbac-gate-matrix.test.ts` (121 tests passed): AST role-gate validation passed for new page and route.
   - `tests/catalogue-import-guards.test.ts` (38 tests passed): Worker bundle isolation verified.

## Verification

- `npx vitest run tests/product-templates.test.ts tests/platform-stock-export-rbac.test.ts tests/rbac-gate-matrix.test.ts tests/catalogue-import-guards.test.ts`: 177 tests passed.
- `npm run typecheck`: 0 errors.
- `npm run lint`: 0 errors.
- `npm run kms:validate` and `npm run kms:coverage`: 100% green.
- Live catalogue export verified: 6,303 records exported cleanly without data loss.
