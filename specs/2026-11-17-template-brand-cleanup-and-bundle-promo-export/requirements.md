# Product Template Brand Cleanup, Bundle & Promotion Export, and Protected Columns (requirements)

Issue #1636. Approved 2026-11-17.

## Context & Objectives

Following the introduction of the Universal and Essential product import/export templates (#1634), three enhancements are required to ensure data integrity, expand bulk management capabilities, and prevent accidental data corruption:
1. **Brand Disassociation (Unbranded Handling):** "Aheed" is the store/vendor name, not a product brand. Products without an explicit brand must not be associated with or defaulted to "Aheed". When exported, the Brand cell for unbranded products must be left blank. On import, unbranded rows (blank Brand) must be accepted without validation errors.
2. **Bundle & Promotion Export:** Curated Bundles and Store Promotions must be exportable to both CSV and Excel formats from their respective staff management pages (`/staff/bundles`, `/staff/promotions`) and the Platform Admin export hub.
3. **Protected Columns & Instructions:** In both product, bundle, and promotion templates, system identification columns (such as `Product ID`, `Bundle ID`, `Promotion ID`) must be clearly labeled with explicit warning notes (e.g. `[DO NOT EDIT / SYSTEM ID]`) and documented in the instructions sheet so that clients know not to alter them when performing two-way updates.
4. **Seamless Two-Way Merge:** Editing exported spreadsheets and re-uploading must cleanly merge updates into existing records using system IDs or natural secondary keys, while leaving an empty ID creates a new record.

## Requirements

### R1 — Brand Field Cleanup & Optionality
- In `lib/product-templates/export.ts` and related export services:
  - When `product.brand` is null or undefined, the exported Brand field must be empty string `""` (blank), NEVER "Aheed".
  - Existing template generators and export scripts must not populate "Aheed" as the fallback brand.
- In `lib/product-templates/schema.ts` and `lib/product-templates/import.ts`:
  - `Brand` column is marked optional or unbranded-tolerant: a blank or whitespace-only Brand value does not raise a validation error and does not block the row from being imported.
  - If Brand is blank on import, the product is created or updated with no associated brand (`brandId: null`).
- Regenerate the live stock export files (`public/templates/aheed-food-centre-stock-export.xlsx`, `public/templates/aheed-food-centre-stock-export.csv`, `public/templates/aheed-food-centre-essential-export.csv`) and blank templates so unbranded products have blank brand cells.

### R2 — Non-Editable Column Notices & Guidance
- In Universal and Essential product schemas:
  - Column header for Product ID updated to `Product ID [DO NOT EDIT / SYSTEM ID]` (with backward-compatible alias matching `Product ID` or `id` on import).
- In Excel templates (`.xlsx`):
  - Field Instructions sheet explicitly details:
    - `Product ID [DO NOT EDIT / SYSTEM ID]`: Unique database identifier. **DO NOT MODIFY** for existing products. Leave blank only when adding a new product.
  - System ID column headers formatted with clear visual indication.
- In CSV headers:
  - Header naming clearly reflects the non-editable nature of the system identifier.

### R3 — Bundles Export (CSV & Excel)
- Schema for Bundles export:
  - `Bundle ID [DO NOT EDIT]`, `Bundle Name*`, `URL Slug*`, `Tagline`, `Is Active*`, `Sort Order`, `Total Items`, `Bundle Items (Product ID:Qty)`.
- Export service in `lib/bundle-templates/` or `lib/product-templates/`:
  - Serializes vendor bundles into RFC-4180 CSV and `.xlsx` workbook.
- UI integration:
  - Staff Bundles page (`/staff/bundles`) gets "Export CSV" and "Export Excel" download actions.
  - Platform Admin export page (`/staff/platform/stock-export`) includes Bundles in exportable datasets.

### R4 — Promotions Export (CSV & Excel)
- Schema for Promotions export:
  - `Promotion ID [DO NOT EDIT]`, `Headline*`, `Subtitle`, `Badge Text`, `Call To Action`, `Link URL`, `Priority*`, `Is Active*`, `Starts At`, `Ends At`, `Target Type` (STORE_WIDE, PRODUCT, CATEGORY, BUNDLE, DISCOUNT_CODE), `Target Reference (Name/Slug/Code)`.
- Export service in `lib/promotion-templates/` or `lib/product-templates/`:
  - Serializes vendor promotions into RFC-4180 CSV and `.xlsx` workbook.
- UI integration:
  - Staff Promotions page (`/staff/promotions`) gets "Export CSV" and "Export Excel" download actions.
  - Platform Admin export page (`/staff/platform/stock-export`) includes Promotions in exportable datasets.

### R5 — Two-Way Merge & Sync Integrity
- Product import engine accepts headers with either `Product ID` or `Product ID [DO NOT EDIT / SYSTEM ID]`.
- Existing matching logic (`Product ID` $\to$ `Barcode` $\to$ `PLU` $\to$ exact name) safely resolves updates without duplicate creation or field erasure.
- Preserves existing `manuallyEditedFields`.

### R6 — Verification & Testing
- Unit tests verifying:
  - Unbranded products export with blank Brand.
  - Import accepts blank Brand and assigns null brand without error.
  - Header aliases with `[DO NOT EDIT / SYSTEM ID]` parse correctly.
  - Bundles and Promotions export functions generate valid CSV and Excel formats.
- Quality gates pass: `npm run lint`, `npm run typecheck`, `npm run kms:validate`, and test suite pass.
