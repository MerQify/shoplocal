# Build Notes: Category-First Sorting, Master Multi-Sheet Export, and Archival Filtering

Issue: #1638

## Implementation Summary
1. **Hierarchical Category-First Sorting:**
   - Implemented `sortProductsHierarchically` in `lib/product-templates/export.ts` ordering products by Department (parent category name or root category) &rarr; Category name &rarr; Product name.
   - Integrated hierarchical sorting into `exportProductsToUniversalCsv` and `exportProductsToEssentialCsv`.
   - Updated `scripts/product-templates/export-all-stock.ts` to order all 6,103 products hierarchically.

2. **Archival & Status Filtering:**
   - Added `status: "active" | "all" | "archived"` options to `fetchStockRecordsForExport`, `fetchBundlesForExport`, `fetchPromotionsForExport`, `fetchCategoriesForExport`, and `fetchDiscountsForExport`.
   - Defaults to `active` across all services so exports are clean and uncluttered. Expired promotions and exhausted/expired discounts are excluded from active exports.

3. **New Operational Exporters:**
   - `lib/category-templates/export.ts`: Serializes Category tree, department associations, product counts, and generates RFC-4180 CSV with UTF-8 BOM.
   - `lib/discount-templates/export.ts`: Serializes discount codes, kinds (PERCENTAGE/FIXED_AMOUNT), display values (e.g., 10%, £5.00), min spend, redemption limits, and statuses (ACTIVE, EXPIRED, EXHAUSTED, INACTIVE).
   - `lib/filter-templates/export.ts`: Serializes vendor attributes (LIST/NUMBER) and options with IDs.

4. **Dedicated Staff Export Endpoints:**
   - `app/api/staff/categories/export/route.ts` (GET, RBAC: STAFF/ADMIN)
   - `app/api/staff/discounts/export/route.ts` (GET, RBAC: STAFF/ADMIN)
   - `app/api/staff/filters/export/route.ts` (GET, RBAC: STAFF/ADMIN)
   - `app/api/staff/stock/export/route.ts` (GET, RBAC: STAFF/ADMIN)
   - Updated `app/api/staff/bundles/export/route.ts` and `app/api/staff/promotions/export/route.ts` to support `?status=all|active|archived`.
   - Updated `app/(admin)/staff/platform/stock-export/export/route.ts` to support master workbook and all operational types.

5. **Consolidated Master Multi-Sheet Excel Workbook:**
   - Generated `public/templates/aheed-food-centre-master-stock-export.xlsx` (9.29 MB) containing 7 sheets:
     - `Products` (Universal format, sorted by Department &rarr; Category &rarr; Name, native AutoFilter enabled)
     - `Categories` (66 categories, native AutoFilter enabled)
     - `Bundles` (4 bundles, native AutoFilter enabled)
     - `Promotions` (2 promotions, native AutoFilter enabled)
     - `Discount Codes` (15 discount codes, native AutoFilter enabled)
     - `Filters & Attributes` (native AutoFilter enabled)
     - `Field Instructions` (Universal columns instruction guide)

6. **Unified Store Admin UI Hub:**
   - Created `components/staff/stock-import/StoreExportHub.tsx` embedded directly into `app/(admin)/staff/products/import/page.tsx`.
   - Features active/all filter toggle, direct download button for the Master Excel workbook, live CSV and Excel export buttons, blank template downloads, and non-editable column protection guide.
   - Added "Export & Templates" navigation button on `/staff/products` header.
