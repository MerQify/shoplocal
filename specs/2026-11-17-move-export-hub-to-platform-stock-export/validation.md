# Validation: Move Templates & Operational Exports to /staff/platform/stock-export

Issue: #1640

## Test Matrix

| Area | Check | Expected Result |
| :--- | :--- | :--- |
| **Platform Page** | Visit `/staff/platform/stock-export` | Displays the full Templates & Operational Exports section with Master Excel & filters |
| **Store Import Page** | Visit `/staff/products/import` | Clean import layout without the duplicate export hub; has link to platform export |
| **Products Page** | Click "Export & Templates" | Navigates to `/staff/platform/stock-export` |
| **Downloads** | Download Master Excel & CSVs from platform hub | All files download with correct data and status filters |
| **Quality Gates** | `typecheck`, `lint`, `test`, `format:check`, `sdd:preclear` | Clean 0 errors |
