---
id: staff-product-edit-2col-and-sticky-alert
title: "Staff Product Edit 2-Column Responsive Layout and Sticky Low-Stock Alert"
type: spec
status: approved
audience: [dev]
visibility: internal
version: "1.0.0"
updated: 2026-11-24
summary: "Prominent back navigation, 2-column responsive layout for product detail/edit page, and low-stock alert at option in the sticky floating action bar."
tags: [products, staff, responsive, sticky-bar, low-stock]
---

# Architecture Plan: Staff Product Edit 2-Column Responsive Layout & Sticky Low-Stock Alert

## 1. Scope of Work

### A. Sticky Floating Action Bar (`components/staff/StickyBulkActionBar.tsx`)
1. Extend `StickyBulkActionBar` props with:
   - `lowStockDefault?: number` (defaults to `DEFAULT_LOW_STOCK_THRESHOLD = 3`)
   - `isStoreAdmin?: boolean` (defaults to `false`)
2. Connect `saveLowStockDefaultAction` with `useActionState(saveLowStockDefaultAction, LOW_STOCK_DEFAULT_IDLE)`.
3. Add a clean control group with label `Low-stock alert at:`, numeric input, and `Save default` button styled with semantic brand tokens (`bg-white/10`, `border-white/20`, `text-white`, `rounded-xl`).
4. In `app/(admin)/staff/products/page.tsx`, pass `lowStockDefault` and `isStoreAdmin` into `<StickyBulkActionBar />`.

### B. Product Detail / Edit Top Navigation (`app/(admin)/staff/products/[id]/page.tsx`)
1. Upgrade `PageContainer` width to `"wide"` (`max-w-7xl`).
2. Add a prominent top navigation bar:
   - `← Back to products` link button with `Icon name="arrow-left"` returning to `/staff/products`.
   - Breadcrumb navigation: `Products / {product.name}`.
   - Status & metrics pill group (Active/Restricted badge, price, stock quantity).

### C. Responsive 2-Column Product Form (`components/staff/ProductForm.tsx`)
1. Add `restrictionPanel?: ReactNode` to `ProductFormProps`.
2. Restructure the layout using Tailwind CSS Grid: `grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 items-start`:
   - **Left Column (`lg:col-span-8 space-y-6`)**: Form `id="product-form"` housing Details, Price & stock, Attributes, Multi-buy, HMC certification, and bottom Save & Back actions.
   - **Right Column (`lg:col-span-4 space-y-6`)**:
     - Status & Visibility Card: Primary `Save changes` button and checkboxes bound to `form="product-form"`.
     - Images Card: Outside `<form>`, containing `ProductImageManager`, `ProductImageUploader`, and `ProductLibraryPicker`.
     - Restriction Card: Renders `restrictionPanel` slot outside `<form>`, avoiding invalid HTML form nesting.
3. On smaller viewports (`< lg`), components gracefully stack into 1 column.

### D. Test Updates & KMS Governance
1. Update `tests/page-container.test.ts` to expect `width: "wide"` for `app/(admin)/staff/products/[id]/page.tsx`.
2. Update `tests/staff-products-sidebar-layout.test.ts` to assert the Low-stock alert at option in `StickyBulkActionBar` and the 2-column responsive layout of `[id]/page.tsx`.
3. Update `CHANGELOG.md` under `## [Unreleased]`.
4. Rebuild documentation artifacts with `npm run kms:build-index`.
