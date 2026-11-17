---
id: 2026-11-17-category-sorting-master-export-archival-plan
title: "Category-First Product Sorting, Master Multi-Sheet Export, and Archival Filtering (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-17
visibility: internal
summary: "Hierarchical category-first product sorting, master multi-sheet workbook generation with native Excel AutoFilters, operational exports for categories, discount codes, and filters, archival status filtering, and unified store admin export hub."
tags: [catalogue, templates, categories, sorting, bundles, promotions, discounts, filters, master-export, store-admin]
related: [2026-11-17-template-brand-cleanup-and-bundle-promo-export-plan, 2026-11-17-product-templates-and-stock-export-plan]
---

# Category-First Product Sorting, Master Multi-Sheet Export, and Archival Filtering (plan)

Issue #1638. Requirements: `requirements.md`.

## Architecture & Module Organization

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Master & Operational Export Architecture                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼────────────────────────────────────┐
        ▼                                   ▼                                    ▼
┌───────────────────────┐       ┌───────────────────────┐            ┌───────────────────────┐
│ Category-First Sort   │       │ Operational Exporters │            │ Multi-Sheet Workbook  │
│  - Dept -> Cat -> Name│       │  - Categories         │            │  - Products (AutoFilt)│
│  - Stable in-memory   │       │  - Discount Codes     │            │  - Categories, Bundles│
│  - Active/All filter  │       │  - Filters/Attributes │            │  - Field Instructions │
└───────────────────────┘       └───────────────────────┘            └───────────────────────┘
                                            │
                                            ▼
                        ┌───────────────────────────────────────┐
                        │       Unified Store Admin UI Hub      │
                        │       (/staff/products/import)        │
                        │   - One-click template downloads      │
                        │   - Master & operational exports      │
                        └───────────────────────────────────────┘
```

## Step 1: Sorting and Archival Filtering in Product Templates
1. Update `lib/product-templates/export.ts` to implement `sortProductsHierarchically`:
   - Primary: Parent category name (or category name if top-level).
   - Secondary: Category name.
   - Tertiary: Product name.
2. Update `fetchStockRecordsForExport` in `lib/product-templates/service.ts`:
   - Accept optional `status?: "active" | "all" | "archived"`.
   - Filter `isActive: true` by default.
   - Sort products with `sortProductsHierarchically`.

## Step 2: New Operational Export Services
1. `lib/category-templates/export.ts`:
   - `fetchCategoriesForExport(vendorId, options)`
   - `exportCategoriesToCsv(categories)`
   - Column layout with `Category ID [DO NOT EDIT]`.
2. `lib/discount-templates/export.ts`:
   - `fetchDiscountsForExport(vendorId, options)`
   - `exportDiscountsToCsv(discounts)`
   - Human-readable money and percentage values.
3. `lib/filter-templates/export.ts`:
   - `fetchFiltersForExport(vendorId)`
   - `exportFiltersToCsv(filters)`
   - Attribute and option mapping with non-editable IDs.

## Step 3: API Endpoints for Operational Exports
1. `app/api/staff/categories/export/route.ts` (GET, RBAC: STAFF/ADMIN)
2. `app/api/staff/discounts/export/route.ts` (GET, RBAC: STAFF/ADMIN)
3. `app/api/staff/filters/export/route.ts` (GET, RBAC: STAFF/ADMIN)
4. Update `app/api/staff/bundles/export/route.ts` and `app/api/staff/promotions/export/route.ts` to support `?status=active|all|archived`.

## Step 4: Multi-Sheet Master Workbook Script & Generator
1. Extend `scripts/product-templates/export-all-stock.ts` to:
   - Query all products, categories, bundles, promotions, discount codes, and filters.
   - Build tabs: `Products`, `Categories`, `Bundles`, `Promotions`, `Discount Codes`, `Filters & Attributes`, and `Field Instructions`.
   - Write `public/templates/aheed-food-centre-master-stock-export.xlsx` with AutoFilter on every sheet.
   - Re-generate `aheed-food-centre-stock-export.xlsx` with category-first sorting and AutoFilter.

## Step 5: Unified Store Admin Export Hub
1. Update `app/(admin)/staff/products/import/page.tsx`:
   - Integrate an "Operational Exports & Templates" card.
   - Provide links to Master Excel, Universal Excel/CSV, Essential CSV, Bundles, Promotions, Categories, Discounts, and Filters CSVs.
   - Include clear visual notes regarding column safety and two-way sync.

## Step 6: Testing & Verification
1. Unit tests:
   - `tests/product-templates-sorting.test.ts`
   - `tests/operational-exports.test.ts`
2. Run typecheck, lint, test, format:check, kms:build-index, sdd:preclear.
