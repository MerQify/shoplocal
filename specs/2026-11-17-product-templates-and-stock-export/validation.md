# Standardised Product Import/Export Templates and Platform Admin Stock Export (validation)

Issue #1634. Requirements: `requirements.md`. Plan: `plan.md`.

## Verification Matrix

| Req | Verification Method | Pass Criteria |
| --- | ------------------- | ------------- |
| **R1** (Universal Template) | Schema unit tests (`tests/product-templates.test.ts`) & inspection of generated template | All mandatory and optional fields present; marked with `*` for mandatory; supports all categories, dietary, attributes, SEO, and inventory. |
| **R2** (Essential Template) | Schema unit tests (`tests/product-templates.test.ts`) & inspection of generated template | Minimal fields only; includes `Brand*` as requested; supports immediate entry without superfluous fields. |
| **R3** (Existing Data Export) | Export execution script against staging/production database | All active/inactive catalogue records exported into Universal Template; money formatted as GBP decimals; no data loss; verified row count matches DB. |
| **R4** (Import & Validation) | Unit tests (`tests/product-templates.test.ts`) & mock import runs | Template type auto-detected; missing mandatory fields flagged with row/col; invalid numbers/dates rejected; valid rows auto-categorised into `CREATE` / `UPDATE` based on ID, Barcode, PLU without requiring manual decision. |
| **R5** (Platform Admin RBAC) | Integration / route test (`tests/platform-stock-export-rbac.test.ts`) | Only `auth.via === "platform-admin"` can access the page and API route; store admins and unauthorized users receive refusal / 403. |
| **R6** (Code Quality) | `npm run lint`, `npm run typecheck`, and test suite execution | 0 lint errors, 0 typecheck errors, all new and existing tests pass. |
