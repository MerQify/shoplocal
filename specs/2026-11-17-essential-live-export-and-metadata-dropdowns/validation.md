# Essential Live Stock Export and Metadata Dropdowns in UI and Excel Workbooks (validation)

Fixes #1646.

## Verification Checklist

- [ ] `tests/platform-stock-export-rbac.test.ts` passes and tests that `type=essential` returns live CSV stock rows.
- [ ] `tests/catalogue-import-guards.test.ts` passes (no unwanted spreadsheet packages in Worker runtime).
- [ ] `scripts/lib/read-spreadsheet.ts` correctly injects OpenXML `<dataValidations>` into generated `.xlsx` buffers using `fflate`.
- [ ] Running `npx tsx scripts/product-templates/generate-templates.ts` generates valid `.xlsx` templates containing native `<dataValidation>` tags.
- [ ] Export route at `/staff/platform/stock-export/export?type=essential&format=csv` calls `generateEssentialStockCsv` with status and category filters.
- [ ] Store Admin Export Hub UI displays dropdown selectors for Status and Category/Department, and provides both CSV and Excel links for Essential Stock Export.
- [ ] `npm run kms:build-index`, `npm run kms:validate`, and `npm run kms:check-generated` pass.
- [ ] `npm run typecheck`, `npm test`, and `npm run format:check` pass.
- [ ] `npm run sdd:preclear` passes cleanly.
