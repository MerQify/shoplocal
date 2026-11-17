# Build Notes: Move Templates & Operational Exports to /staff/platform/stock-export

Issue: #1640

## What changed and why
- Relocated the interactive "Templates & Operational Exports" section from `/staff/products/import` to `/staff/platform/stock-export`.
- Created `components/staff/platform-stock-export/PlatformExportHub.tsx` encapsulating the Master Multi-Sheet Workbook (.xlsx) card, the Active vs. All Records toggle, live operational exports (Universal, Essential, Categories, Bundles, Promotions, Discounts, Filters), and blank template downloads.
- Cleaned up `app/(admin)/staff/products/import/page.tsx` by removing the embedded hub and anchor button, and added an outbound action link to `/staff/platform/stock-export`.
- Updated the "Export & Templates" navigation link on `app/(admin)/staff/products/page.tsx` to link directly to `/staff/platform/stock-export`.

## Decisions taken during the build
- Integrated the hub cleanly into the existing Platform Admin layout using `PlatformExportHub` so all live download routes connect to the platform-authenticated `/staff/platform/stock-export/export` endpoint.

## Deviations from the spec
- None.

## Known-shaky areas
- None.
