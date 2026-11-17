# Product Template Brand Cleanup, Bundle & Promotion Export, and Protected Columns (validation)

Issue #1636. Requirements: `requirements.md`. Plan: `plan.md`.

## Verification Matrix

| Req | Verification Method | Pass Criteria |
| --- | ------------------- | ------------- |
| **R1** (Brand Cleanup) | Unit tests (`tests/product-templates.test.ts`) & check generated files | Products with no brand export with `""` (blank), not `"Aheed"`. Import accepts blank Brand without raising an error. |
| **R2** (Protected Columns) | Schema inspection & template output | System ID column named `Product ID [DO NOT EDIT / SYSTEM ID]`; instructions sheet explains non-editable nature clearly. Import recognizes both legacy and new header formats. |
| **R3** (Bundles Export) | Unit & route tests (`tests/bundle-promotion-templates.test.ts`) | Bundles export accurately converts bundle entities and items to CSV/Excel format. Export button functional on `/staff/bundles`. |
| **R4** (Promotions Export) | Unit & route tests (`tests/bundle-promotion-templates.test.ts`) | Promotions export accurately serializes all promotion fields and targets to CSV/Excel format. Export button functional on `/staff/promotions`. |
| **R5** (Two-Way Sync Integrity) | Test suite (`tests/product-templates.test.ts`) | Exporting and re-importing unchanged data produces identical entities without data duplication or loss. |
| **R6** (Code Quality) | `npm run lint`, `npm run typecheck`, `npm run kms:validate`, test runs | 0 errors across all checks. |
