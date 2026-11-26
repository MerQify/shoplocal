---
id: category-sorting-and-dual-pagination-plan
title: "Category Sorting (Icon sortOrder vs Text Alphabetical) and Dual Top/Bottom Pagination"
audience: [dev]
type: spec
status: draft
version: 1.0.0
updated: 2026-11-26
visibility: internal
tags: [categories, sorting, sortOrder, pagination, staff, storefront]
summary: Preserves database sortOrder for icon categories while collating text/list categories alphabetically, and implements top and bottom dual pagination across all paginated pages.
---

# Plan: Category Sorting (Icon sortOrder vs Text Alphabetical) and Dual Top/Bottom Pagination

## 1. Category Sorting Realignment
- In `lib/repositories/categories.ts`:
  - Update `listTopLevelCategories` to return `summaries` directly without calling `sortNamedEntities(summaries)`. This preserves database `sortOrder` for icon rails (`DepartmentScroller`, `DepartmentHero`) on the homepage, `/categories`, `/categories/[slug]`, `/search`, `/bundles`, and `/help`.
  - Maintain `sortCategoryTreeAlphabetical` in `listCategoryTreeForStorefront` for text/select filter views.
  - Maintain `sortNamedEntities` in `getCategoryBySlug` for subcategory link pills.
  - Maintain alphabetical ordering in `toCategoryOptionGroups` (`lib/catalogue-form.ts`) and `app/(admin)/staff/categories/page.tsx`.

## 2. Dual Top & Bottom Pagination Implementation
- Update all 6 paginated views to render `<Pagination position="top" ... />` above the table/grid and `<Pagination position="bottom" ... />` below:
  1. `app/(admin)/staff/products/page.tsx`: Replace simple count subheader with `<Pagination mode="numbered" position="top" ... />` above the table; keep bottom pagination with `position="bottom"`.
  2. `app/(admin)/staff/orders/page.tsx`: Add `<Pagination mode="sequential" position="top" ... />` above orders list; keep bottom pagination with `position="bottom"`.
  3. `app/(admin)/staff/customers/page.tsx`: Add `<Pagination mode="numbered" position="top" ... />` above customer cards; keep bottom pagination with `position="bottom"`.
  4. `app/(storefront)/categories/[slug]/page.tsx`: Add `<Pagination mode="sequential" position="top" ... />` above `<ProductGrid>`; keep bottom pagination with `position="bottom"`.
  5. `app/(storefront)/search/page.tsx`: Add top pagination above `<ProductGrid>`; keep bottom pagination with `position="bottom"`.
  6. `app/(storefront)/account/orders/page.tsx`: Add `<Pagination mode="sequential" position="top" ... />` above orders list; keep bottom pagination with `position="bottom"`.

## 3. Automated Testing & Verification
- Update `tests/category-visibility.test.ts` to verify `listTopLevelCategories` returns items respecting `sortOrder`.
- Update `tests/pagination.test.tsx` to assert that all 6 paginated views render both `position="top"` and `position="bottom"` instances of `<Pagination>`.
- Run vitest suite across affected modules.
- Run `npm run kms:validate` and `npm run kms:check-generated`.
- Update `CHANGELOG.md`.
