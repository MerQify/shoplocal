# Requirements: Category Sorting (Icon sortOrder vs Text Alphabetical) and Dual Top/Bottom Pagination

## 1. Category Sorting Rules
- **R1 (Icon Category Sorting):** Wherever categories are displayed as icons or visual department cards (e.g. `DepartmentScroller`, `DepartmentHero` across landing, category browse, and search, and subcategory medallion links in `SubcategoryLinks.tsx`), their ordering MUST preserve the database `sortOrder` (`orderBy: [{ sortOrder: "asc" }, { name: "asc" }]`). `listTopLevelCategories` and `getCategoryBySlug` in `lib/repositories/categories.ts` must return categories and subcategories in database `sortOrder` without overriding them with alphabetical collation. Invalidate Cloudflare KV cache by incrementing `METADATA_VERSION` to ensure edge cache reflects database `sortOrder` immediately upon deployment.
- **R2 (Text / List Category Sorting):** Wherever categories are displayed as text or lists (without icons, including dropdown selectors, forms, filters, and admin management tables), categories MUST be sorted alphabetically:
  - Parent/department options and child subcategory options in `toCategoryOptionGroups` (`lib/catalogue-form.ts`) sort alphabetically A–Z by default.
  - Storefront category tree (`listCategoryTreeForStorefront` in `lib/repositories/categories.ts`) sorts departments and subcategories alphabetically A–Z.
  - Staff categories administration (`/staff/categories`) displays departments and subcategories sorted alphabetically A–Z.

## 2. Dual Pagination (Top and Bottom)
- **R3 (Top and Bottom Placement):** All paginated table and list views MUST render pagination controls at **both the top** (above the table/list) and **the bottom** (below the table/list) for seamless navigation without requiring users to scroll down the entire page.
- **R4 (Staff Tables Coverage):** The following staff management views MUST display dual pagination:
  - `/staff/products` (`app/(admin)/staff/products/page.tsx`): Numbered pagination above and below the products data table.
  - `/staff/orders` (`app/(admin)/staff/orders/page.tsx`): Sequential pagination above and below the orders list.
  - `/staff/customers` (`app/(admin)/staff/customers/page.tsx`): Numbered pagination above and below the customers list.
- **R5 (Storefront Lists Coverage):** The following storefront views MUST display dual pagination:
  - `/categories/[slug]` (`app/(storefront)/categories/[slug]/page.tsx`): Sequential pagination above and below the product grid.
  - `/search` (`app/(storefront)/search/page.tsx`): Numbered/sequential pagination above and below the search results grid.
  - `/account/orders` (`app/(storefront)/account/orders/page.tsx`): Sequential pagination above and below the customer order history list.
- **R6 (Accessibility & IDs):** Each instance of `<Pagination>` MUST pass its respective `position="top"` or `position="bottom"`, ensuring clean unique element IDs for jump-to-page forms (`jump-top`, `jump-bottom`) and unique aria labels (`aria-label="... (top)"` vs `" (bottom)"`).
