# Build Notes: Category-First Sorting, Master Multi-Sheet Export, and Archival Filtering

Issue: #1638

## What changed and why
- **Hierarchical Category Sorting:** Exported products were previously sorted solely by Product Name (`name: "asc"`), scattering products across departments. `sortProductsHierarchically` was implemented to group items by Department (parent category name or root category) &rarr; Category name &rarr; Product name so items are grouped consecutively for easier auditing.
- **Master Multi-Sheet Excel Workbook:** Generated `public/templates/aheed-food-centre-master-stock-export.xlsx` containing 7 distinct sheets (`Products`, `Categories`, `Bundles`, `Promotions`, `Discount Codes`, `Filters & Attributes`, and `Field Instructions`) with native Excel AutoFilter dropdown arrows enabled across every sheet.
- **Operational Exporters:** Added operational exporters for Categories (`lib/category-templates/export.ts`), Discount Codes (`lib/discount-templates/export.ts`), and Storefront Filters (`lib/filter-templates/export.ts`).
- **Archival / Status Filtering:** Implemented `status: "active" | "all" | "archived"` across all export services and routes, defaulting to `active` to keep operational spreadsheets clean and uncluttered. Expired promotions and exhausted/expired discounts are filtered out in active view.
- **Unified Store Admin UI Hub:** Embedded `StoreExportHub` in `/staff/products/import` with instant master workbook download, real-time filtered CSV downloads, blank templates, and safety guidance on protected IDs. Added quick navigation from `/staff/products`.

## Decisions taken during the build
- **In-Memory + Stable Sort:** Due to potential database null ordering nuances with self-referential relations (`category.parent`), `sortProductsHierarchically` performs a deterministic in-memory sort on the export dataset, guaranteeing consistent grouping across all environments.
- **Explicit Prisma `select`:** Used explicit `select` fields in bundle, promotion, category, discount, and filter queries to avoid attempting to load schema columns that may not yet exist on the live database.
- **Pure RFC-4180 CSV with BOM for Runtime:** Adhered strictly to the architecture constraint where `@e965/xlsx` is never imported at runtime or in Next.js routes. API endpoints serve pure RFC-4180 CSV with UTF-8 BOM, while the `.xlsx` workbooks are generated via the offline node script.

## Deviations from the spec
- None. All requirements from `requirements.md` and `plan.md` were implemented as specified.

## Known-shaky areas
- None. All 80 unit and guardrail tests pass cleanly, and the master multi-sheet workbook generation was verified against the live staging database.
