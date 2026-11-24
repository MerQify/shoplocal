# Requirements: Cascading Catalogue Filters & Cloudflare Metadata Facets

## 1. Cascading Filter Visibility
- **R1:** When `Status = Active` is selected on `/staff/products`:
  - Category dropdown MUST only display categories and departments containing active (`isActive: true`) products.
  - Brand dropdown MUST only display brands associated with active products.
  - Restriction and Stock dropdowns MUST only display values present among active products.
- **R2:** When `Status = Archived` is selected on `/staff/products`:
  - Category dropdown MUST only display categories and departments containing archived (`isActive: false`) products.
  - Brand dropdown MUST only display brands associated with archived products.
  - Restriction and Stock dropdowns MUST only display values present among archived products.
- **R3:** When a `Category` is selected, the Brand dropdown MUST cascade to only display brands with products within that category (under the active/archived status).
- **R4:** When `Status = All products` is selected, all categories and brands across the catalogue are available.
- **R5:** All filtered categories, optgroups, and brands MUST preserve natural alphabetical (A–Z) sorting.

## 2. Cloudflare-Native Metadata Storage
- **R6:** Facet metadata (active/archived category IDs, brand IDs, restrictions, stock modes, and category-to-brand maps) MUST be stored in Cloudflare KV / edge cache (`metadata:v1:facets:<vendorId>`).
- **R7:** Reads MUST use Cloudflare cache with automatic, zero-fail fallback to Postgres when cache is empty or stale.
- **R8:** Facet payloads MUST be strictly validated with Zod (`CachedCatalogueFacetsPayloadSchema`).
- **R9:** Cache MUST be refreshed overnight via scheduled cron (`0 3 * * *`), on deployment scripts, and invalidated on product/category mutations.
