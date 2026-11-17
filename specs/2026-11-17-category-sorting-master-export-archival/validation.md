# Validation: Category-First Sorting, Master Multi-Sheet Export, and Archival Filtering

Issue: #1638
Status: Draft -> Ready for Verification

## Test Matrix

| Area | Test Case | Method | Expected Result |
| :--- | :--- | :--- | :--- |
| **Category Sorting** | Products sorted by Dept -> Cat -> Name | Vitest unit test | Items grouped consecutively by Department and Category |
| **Archival Filter** | `fetchStockRecordsForExport` with active vs all | Vitest unit test | Default returns only active; all returns inactive too |
| **Category Export** | `fetchCategoriesForExport` & `exportCategoriesToCsv` | Vitest unit test | Generates RFC-4180 CSV with BOM, Category ID, parent, total products |
| **Discount Export** | `fetchDiscountsForExport` & `exportDiscountsToCsv` | Vitest unit test | Formats percentages and pence into readable strings |
| **Filter Export** | `fetchFiltersForExport` & `exportFiltersToCsv` | Vitest unit test | Serializes vendor attributes and options correctly |
| **RBAC Endpoints** | GET `/api/staff/categories/export`, discounts, filters | Route test | Requires STAFF or ADMIN, returns 401/403 for unauthorized |
| **Master Workbook** | Multi-sheet .xlsx generation | Script execution | Produces valid workbook with all 7 sheets and native AutoFilter |
| **UI Integration** | Store admin `/staff/products/import` | Visual / Build | Renders unified download buttons and guides |

## Quality Gates
- `npm run typecheck`: clean
- `npm run lint`: clean
- `npm run format:check`: clean
- `npm test`: all unit tests pass
- `npm run sdd:preclear`: clean
