# Requirements — Sticky Action Bar Labels & Visibility

Tracking issue [#1759](https://github.com/sriahead/merqify/issues/1759).

- **R1 (Labels & Visibility Trigger):** The sticky bulk action bar (`StickyBulkActionBar`) on `/staff/products` must provide a "Labels & visibility" trigger button that opens a card/popover styled to match the staff product edit panel.
- **R2 (Card Header & Action):** The popover must display the "Labels & visibility" heading, a status/selection badge (e.g. "Active" or "N products"), and a prominent "Save changes" action button with the save icon.
- **R3 (Complete Checkbox Attributes):** The popover must provide the exact 8 attribute checkboxes matching the product edit view:
  1. Halal (`isHalal`)
  2. Fresh (`isFresh`)
  3. Organic (`isOrganic`)
  4. Vegetarian (`isVegetarian`)
  5. Gluten free (`isGlutenFree`)
  6. Featured on homepage (`isFeatured`)
  7. Visible in the shop (`isActive`)
  8. Customers can add a note to this item (`allowsCustomNote`)
- **R4 (Individual & Bulk Support):** 
  - When 1 product is selected, the checkboxes initialize to that product's current values.
  - When multiple products are selected, staff can configure the desired state and apply across all selected items.
- **R5 (Restriction Safety):** "Visible in the shop" (`isActive: true`) must respect database restriction checks (`Product_restricted_inactive_check`), safely skipping restricted items and reporting skipped counts.
- **R6 (Atomic Database Write):** The bulk update must execute in a database transaction via `getPrismaWs()`, revalidate `/staff/products` and `/staff/inventory`, and invalidate cached Cloudflare metadata facets (`invalidateCachedCatalogueFacets`).
- **R7 (Verification & Quality):** Pass all quality gates (`lint`, `format:check`, `typecheck`, and comprehensive unit tests).
- **R8 (Tri-State Label Preservation in Bulk Mode):** When multiple products are selected, each of the 8 attributes must support a tri-state toggle: `Keep current` (default, does not modify existing values for that attribute across selected items), `Set to Yes` (sets to true), and `Set to No` (sets to false). Only attributes explicitly set to Yes or No are updated in the database.
- **R9 (Single-Product Direct Toggle):** When exactly 1 product is selected, the checkboxes reflect that product's current values and toggle directly between `Yes` and `No`.
