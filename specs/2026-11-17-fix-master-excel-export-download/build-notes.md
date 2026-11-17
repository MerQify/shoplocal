# Build Notes: Serve Master and Stock Excel Exports via Static Assets

Fixes #1642.

- **Direct Static Template Links:** Updated `PlatformExportHub.tsx` to link `Download Master Excel` directly to `/templates/aheed-food-centre-master-stock-export.xlsx` and `Export Excel (.xlsx)` directly to `/templates/aheed-food-centre-stock-export.xlsx`, matching the working static pattern used by `universal-product-template.xlsx`.
- **Worker Safe XLSX Export Handler:** Replaced Node `fs.readFileSync` in `app/(admin)/staff/platform/stock-export/export/route.ts` with `Response.redirect(new URL(staticPath, request.url), 302)` targeting Cloudflare Static Assets.
- **Removed Node `fs` & `path` Dependencies:** Removed `readFileSync`, `existsSync`, and `join` from the Worker route.
- **Test Coverage:** Added Vitest unit test in `tests/platform-stock-export-rbac.test.ts` verifying 302 redirect for XLSX exports.
