---
id: sticky-bar-labels-and-visibility
title: Sticky Action Bar Labels & Visibility (plan)
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-26
visibility: internal
summary: Add a dedicated Labels & visibility popover to the sticky action bar on /staff/products matching the staff product edit card.
tags: [catalogue, staff, sticky-bar, labels, visibility]
related: [adr-004-multi-tenant-catalogue]
---

# Sticky Action Bar Labels & Visibility

Tracking issue [#1759](https://github.com/sriahead/merqify/issues/1759).

## Design & Architecture

1. **UI Component (`StickyBulkActionBar.tsx`):**
   - Add a `Labels & visibility` button to the floating sticky action bar.
   - When opened, renders a floating popover card styled exactly like the `/staff/products/[id]` Labels & visibility card:
     - Header: "Labels & visibility" with status/count pill.
     - Action button: Full-width blue "Save changes" button with save icon.
     - Checkbox list: Halal, Fresh, Organic, Vegetarian, Gluten free, Featured on homepage, Visible in the shop, Customers can add a note to this item.
   - When 1 product is selected, initialize checkbox states to that product's current values.
   - When multiple products are selected, default to unchecked (or preserved choices) and apply staff choices across all selected products.

2. **Server Action & Repository:**
   - Add `bulkUpdateProductLabelsAndVisibilityAction` in `features/admin/catalogue.ts` accepting `productId` list and boolean values for the 8 attributes.
   - Add `bulkUpdateProductLabelsAndVisibility` in `lib/repositories/products.ts` executing inside a `getPrismaWs()` transaction:
     - Separate unrestricted products from restricted products when `isActive: true` is requested.
     - Update all selected products with the requested labels, featured status, and custom note permission.
     - Invalidate Cloudflare metadata facets via `invalidateCachedCatalogueFacets(vendorId)`.
     - Revalidate `/staff/products` and `/staff/inventory`.

3. **Validation & Verification:**
   - Unit tests covering individual product update, bulk products update, restriction safety handling, and action bar UI rendering.
