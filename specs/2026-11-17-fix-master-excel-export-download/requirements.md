# Requirements: Serve Master and Stock Excel Exports via Static Assets

Fixes #1642.

## Problem Description
In the Cloudflare Workers isolate execution environment (OpenNext), files in `public/` are deployed as Cloudflare Static Assets and are not accessible on the Worker isolate's local filesystem via Node.js `fs.readFileSync`.

When users click **Download Master Excel** or **Export Excel (.xlsx)** on `/staff/platform/stock-export`, the request previously routed to `/staff/platform/stock-export/export?type=master&format=xlsx` which attempted to read from local disk and failed with 404 Not Found, causing Chrome to report "File wasn't available on site".

## Functional Requirements
1. **Direct Static Links in UI Hub:**
   - In `components/staff/platform-stock-export/PlatformExportHub.tsx`, the Master Excel download button must link directly to `/templates/aheed-food-centre-master-stock-export.xlsx`.
   - The Universal Stock Export Excel link must link directly to `/templates/aheed-food-centre-stock-export.xlsx`.
2. **Graceful Redirection on Dynamic Export Route:**
   - If `/staff/platform/stock-export/export` is invoked with `format=xlsx`, it must redirect (`302`) to the appropriate `/templates/...` static asset URL rather than executing `readFileSync`.
   - Supported types:
     - `master` -> `/templates/aheed-food-centre-master-stock-export.xlsx`
     - `stock` -> `/templates/aheed-food-centre-stock-export.xlsx`
     - `universal` -> `/templates/universal-product-template.xlsx`
     - `essential` -> `/templates/essential-product-template.xlsx`
3. **Remove Node `fs` Disk Access:**
   - Eliminate Node `fs` file operations from the Worker runtime route, relying on in-memory generators for blank templates and static assets for pre-generated workbooks.
