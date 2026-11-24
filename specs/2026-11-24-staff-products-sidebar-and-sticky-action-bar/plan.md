---
id: staff-products-sidebar-and-sticky-action-bar-plan
title: "Staff Products Sidebar Filters & Contextual Sticky Action Toolbar"
audience: [dev]
type: spec
status: draft
version: 1.0.0
updated: 2026-11-24
visibility: internal
tags: [staff, products, ui, sidebar, sticky-toolbar, filters]
summary: Implementation plan for a two-column sidebar layout, structured product table, and contextual sticky action bar on /staff/products.
---

# Plan: Staff Products Sidebar Filters & Contextual Sticky Action Toolbar

## 1. Cloudflare Facets & Facet Counts
- Extend `CachedFacetSetSchema` and `CachedCatalogueFacetsPayloadSchema` in `lib/cloudflare-metadata.ts` with optional `count` fields.
- Record `activeCount`, `archivedCount`, and `totalCount` in `buildCatalogueFacets` so status filters display live product counts.

## 2. Low-Stock Header Popover & Action Menus
- Create a header popover component or native details popover for `LowStockDefaultForm`.
- Consolidate `Export & Templates` and `BackfillImagesButton` into a `More actions ▾` menu.

## 3. Sidebar Filters Component
- Implement `StaffProductsSidebar` (or inline sidebar in `app/(admin)/staff/products/page.tsx`):
  - Status options with live product counts.
  - Category, Brand, Restriction, Stock, Needs attention, and Sort selectors.
  - Reset / Apply controls.
  - Responsive collapse for mobile (`lg:hidden`).

## 4. Product Table Transformation
- Replace `<ul className="space-y-3">` cards with a responsive table grid:
  - Header with `Select all on this page` checkbox.
  - Checkbox, Thumbnail, Product Name (with net content and badges), Category, Brand, Stock quantity input, Price, Status dot badge, and Edit link.

## 5. Unified Contextual Sticky Action Toolbar
- Create `components/staff/StickyBulkActionBar.tsx` merging `BulkProductActions` and `BulkQuantityBar`:
  - Listens to selection checkboxes and quantity inputs.
  - Renders as a floating high-contrast bar docked at `fixed bottom-6 left-1/2 -translate-x-1/2`.
  - Only visible when `selectedIds.size > 0` or row quantities are modified.
  - Houses bulk status/category moves, preview confirmation dialog, batch quantity setter, save button, and deselect button.

## 6. Verification & Automated Tests
- Create `tests/staff-products-sidebar-layout.test.ts` testing the two-column sidebar structure, sticky action bar presence, and popover.
- Run `npm run kms:build-index`, `npm run format`, `npm run kms:validate`, `npm run typecheck`, and `npm test`.
