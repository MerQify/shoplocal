# Requirements: Platform-Wide List Optimisation & Cloudflare Metadata Architecture

## 1. Natural Alphabetical Sorting Standard
- **R1:** All applicable lists (categories, subcategories, brands, dropdowns, selectors, admin management lists, navigation menus) MUST sort alphabetically (A–Z) by default.
- **R2:** Sorting MUST be natural and case-insensitive (`Item 2` before `Item 10`, `Tilapia 500` before `Tilapia 800`).
- **R3:** Two-tier category hierarchies MUST preserve parent-child structure: departments sorted A–Z, and subcategories within each department sorted A–Z.
- **R4:** Orphan subcategories whose parent is missing or inactive MUST be preserved and sorted at the top level rather than dropped.

## 2. Shopper Visibility Filtering Standard
- **R5:** Shopper-facing lists MUST automatically display only active and shopper-visible items adhering to `visibleCategoryWhere`.
- **R6:** Shoppers MUST only see brands that have active products in shopper-visible categories (`listShopperVisibleBrands`).
- **R7:** Staff and administrators MUST retain complete access to view and manage all records (active, inactive, archived).

## 3. Cloudflare-Native Metadata Cache
- **R8:** Pre-build and store categories, visible brands, and navigation structures in Cloudflare KV / edge cache (`metadata:v1:*`).
- **R9:** All reads MUST use the cache by default with safe, seamless fallback to Neon Postgres if cache is empty, stale, or malformed.
- **R10:** Cached payloads MUST be validated against strict Zod schemas (`CachedCategoriesPayloadSchema`, `CachedBrandsPayloadSchema`, `CachedNavigationPayloadSchema`).

## 4. Automated Refresh Lifecycle
- **R11:** Scheduled overnight run (`DAILY_CRON = "0 3 * * *"`) MUST invoke `/api/jobs/refresh-metadata` to refresh all store metadata.
- **R12:** Refresh script (`scripts/refresh-metadata-cache.ts`) MUST support manual execution and scheduled refresh for all store metadata caches.
- **R13:** Administrative category saves and brand mutations MUST immediately invalidate the corresponding metadata cache.

## 5. Staff Products Active & Archived Controls
- **R14:** Staff products list (`/staff/products`) MUST support filtering by Active and Archived status.
- **R15:** Bulk product actions MUST support "Move to Active" with an optional destination category selector.
