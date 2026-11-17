# Product Template Brand Cleanup, Bundle & Promotion Export, and Protected Columns (build notes)

Issue #1636. Built 2026-11-17 on branch `feature/1636-template-brand-cleanup-and-bundle-promo-export`.

## What changed and why

- **Brand Disassociation & Tolerance (`lib/product-templates/`):**
  - Updated `export.ts`: removed fallback `|| "Aheed"`, outputting `""` (blank) whenever a product has no associated brand.
  - Updated `import.ts`: removed `Brand*` mandatory validation check. A blank Brand on import is accepted without errors and maps to an unbranded product (`brandId: null`).
  - Updated `schema.ts`: renamed canonical column header from `Brand*` to `Brand` and updated template type detection.
  - Re-exported all live catalogue stock records (6,103 products) in `public/templates/` so that no unbranded product carries the store name as its brand.

- **Non-Editable Column Protection (`lib/product-templates/`):**
  - Updated primary system ID column to `Product ID [DO NOT EDIT]`.
  - Added multi-alias resolution in `import.ts` (`productiddonotedit`, `productid`, `id`) so both new and legacy exports parse seamlessly.
  - Enhanced `scripts/product-templates/generate-templates.ts` Field Instructions sheet with explicit guidance: do not alter system IDs when updating existing products; leave blank when creating new items.

- **Bundles & Promotions Export (`lib/bundle-templates/`, `lib/promotion-templates/`):**
  - Built pure TypeScript CSV exporters with RFC-4180 compliance and UTF-8 BOM (`\uFEFF`) support for both Bundles and Promotions.
  - Added dedicated staff download endpoints:
    - `/api/staff/bundles/export` (staff role gated)
    - `/api/staff/promotions/export` (staff role gated)
  - Integrated "Export CSV" buttons onto `/staff/bundles` and `/staff/promotions`.
  - Added Bundles and Promotions export links into Platform Admin stock export hub (`/staff/platform/stock-export`).

## Decisions taken during the build

- **Blank Brand Selection:** Per user confirmation ("leave it blank as recommended"), unbranded products export with empty Brand strings rather than placeholder tokens like "Unknown", keeping spreadsheet grids clean and uncluttered.
- **Worker Bundle Isolation:** Exporters generate pure CSV at runtime and pre-build XLSX via offline scripts, adhering strictly to `tests/catalogue-import-guards.test.ts` (no `@e965/xlsx` in application runtime).

## Deviations from the spec

None. All requirements (Brand cleanup, protected ID columns, bundles export, promotions export, and two-way sync compatibility) were met.

## Known-shaky areas

- None.
