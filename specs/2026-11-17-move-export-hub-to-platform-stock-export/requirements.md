# Requirements: Move Templates & Operational Exports to /staff/platform/stock-export

Issue: #1640
Target: Staging / Production

## 1. Problem Statement
The user requested to move the "Templates & Operational Exports" section out of the general store import screen (`/staff/products/import`) and place it directly into the dedicated Platform Stock & Template Export interface (`/staff/platform/stock-export`).

## 2. Requirements
1. **Clean up `/staff/products/import`:**
   - Remove `<StoreExportHub />` from `/staff/products/import/page.tsx`.
   - Remove the anchor link `#export-hub` from `/staff/products/import/page.tsx`.
   - Provide a clean action link in the header linking to `/staff/platform/stock-export` ("Stock & template export →").
2. **Update `/staff/products` Navigation:**
   - Point the "Export & Templates" link to `/staff/platform/stock-export`.
3. **Upgrade `/staff/platform/stock-export`:**
   - Move the full interactive "Templates & Operational Exports" hub into `/staff/platform/stock-export/page.tsx` (or a dedicated client component `PlatformExportHub.tsx`).
   - Include:
     - Master Multi-Sheet Workbook (.xlsx) with 7 sheets & AutoFilters
     - Active Only vs. All Records filter toggle
     - Live Catalogue & Operational Exports (Universal, Essential, Categories, Bundles, Promotions, Discounts, Filters)
     - Blank Formatted Import Templates (Universal, Essential, Categories, Discounts, Filters, Bundles, Promotions)
     - Two-way sync & non-editable column safety guide
     - Two-Way Sync explanation card
