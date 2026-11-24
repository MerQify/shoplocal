---
id: staff-products-collapsible-filters-and-compact-age-restriction
title: "Staff Products Collapsible Filters and Compact Age Restriction"
type: spec
status: approved
audience: [dev]
visibility: internal
version: "1.0.0"
updated: 2026-11-24
summary: "Interactive collapsible filter sidebar to save table space, compact 'Age Restricted' label with tooltip beneath product name, and selection-scoped low-stock alert updates in the sticky bulk action bar."
tags: [products, staff, filters, sidebar, collapsible, age-restricted, low-stock, sticky-bar]
---

# Architecture Plan: Staff Products Collapsible Filters & Compact Age Restriction

## 1. Scope of Work

### A. Collapsible Product Sidebar Layout (`components/staff/ProductCatalogLayout.tsx`)
1. Create a client layout component wrapping the sidebar and main table.
2. Manage `isCollapsed` state with `localStorage` persistence (`staff_products_filters_collapsed`).
3. Render a collapse button in the sidebar header with `<Icon name="panel-left-close" />`.
4. Render a toggle button in the main toolbar and an expand bar when collapsed with `<Icon name="panel-left-open" />`.
5. When collapsed, hide the sidebar rail and expand the main section to 100% width (`w-full`), maximising table space.

### B. Compact "Age Restricted" Badge (`app/(admin)/staff/products/page.tsx`)
1. In the `Product` column cell:
   - If `product.restriction === "AGE_RESTRICTED"`, render a compact badge underneath the product name:
     `<span title="Cannot currently be sold online due to age restrictions" className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/60 cursor-help">Age Restricted</span>`.
2. In the `Status` column cell:
   - Exclude `AGE_RESTRICTED` from rendering the bulky multi-line pill, allowing the Status column to cleanly show `Active`, `Archived`, `Low stock`, and `Image Review`.

### C. Sticky Bulk Action Bar: Low-Stock Alert for Selected Products
1. Add `bulkSetLowStockThresholds` repository function in `lib/repositories/products.ts` with `prismaWs.$transaction` support.
2. Add facade in `lib/products-service.ts`.
3. Add `bulkSetLowStockThresholdAction` server action in `features/admin/catalogue.ts` accepting `productId` list and `lowStockThreshold`.
4. In `components/staff/StickyBulkActionBar.tsx`:
   - Replace global store default update with selection-scoped threshold update:
     `Low-stock alert: [ input ] [ Apply to selected ]`.
   - Pass selected product IDs into the action and display success notification upon completion.
   - Retain the top header popover (`LowStockDefaultForm`) for store-wide default management.

## 2. Dependencies & Constraints
- No arbitrary hex colors: use semantic design tokens and standard Tailwind classes.
- Motion reduce rule: include `motion-reduce:active:scale-100` on any `active:scale-95`.
- Server actions: only async functions exported from `"use server"` files.
- Repository purity: explicit `prisma` and `vendorId` parameters.
