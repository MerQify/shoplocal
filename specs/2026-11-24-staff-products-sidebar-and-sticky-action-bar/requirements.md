# Requirements: Staff Products Sidebar Filters & Sticky Action Bar

## Problem Statement
The staff products management dashboard (`/staff/products`) previously placed search, 8 filter dropdowns, quick views, a global store-wide low-stock default card, and two competing bulk action cards vertically above the products list. This created ~700px of vertical bloat, pushing the actual products completely below the fold and creating high cognitive friction.

## Requirements

### 1. Two-Column Desktop Layout (Sidebar Filters + Data Area)
- On desktop viewports (`lg` breakpoint, `≥ 1024px`), move the 8 filter dimensions into a persistent left sidebar (`w-72 shrink-0`).
- The sidebar must include:
  - Header with `Filters` title and `Clear all` reset action.
  - **STATUS**: Direct selection options with live product counts (`All statuses (N)`, `Active (N)`, `Archived (N)`).
  - **CATEGORY**: Cascaded category picker with parent department optgroups.
  - **BRAND**: Cascaded brand picker.
  - **RESTRICTION**: Prohibited, Age Restricted, Not Deliverable, Needs Review.
  - **STOCK**: Tracked count, Untracked, Unknown.
  - **NEEDS ATTENTION**: Price needed, Ready to switch on, Missing photo.
  - **SORT BY**: Newest first, Name A–Z, Price low/high.
  - **Apply filters** primary submit button.
- On mobile viewports (`< 1024px`), collapse the sidebar into an accessible drawer/accordion triggered by a `Filters (N)` button.

### 2. Streamlined Search & Quick Views Discovery Card
- Position search prominently at the top of the main content column.
- Integrate Quick View worklist chips directly below the search input:
  - `All Products`
  - `Price needed (£0)`
  - `Ready to switch on`
  - `No photo`
  - `Low stock`
- Sub-header with item count, sort, per-page options, and compact pagination.

### 3. Structured Product Data Table
- Render products in a clean, high-density table grid:
  - Header checkbox column (`Select all on this page`).
  - `PRODUCT`: Thumbnail image (or fallback medallion) + Name (link to detail) + Net content/PLU.
  - `CATEGORY`: Category name.
  - `BRAND`: Brand name (or "No brand").
  - `STOCK`: Interactive quantity input for fast in-place editing, plus low-stock threshold warning.
  - `PRICE`: Formatted base price and unit price.
  - `STATUS`: Status dot badge (`● Active`, `● Low stock`, `● Archived`, `● Price needed`, etc.).
  - Actions (`•••` linking to `/staff/products/${id}`).

### 4. Contextual Sticky Bulk-Action Toolbar
- Remove both permanent static cards (`BulkProductActions` and `BulkQuantityBar`) from the default page view.
- When `selectedIds.size > 0` or row quantities are modified:
  - Display a docked, high-contrast dark-navy toolbar floating at the bottom of the viewport (`fixed bottom-6 left-1/2 -translate-x-1/2 z-50`).
  - Include:
    - Checked count indicator (`☑ N selected`).
    - Bulk action dropdown (`Move to Active`, `Move to Archived`, `Change restriction`, `Mark stock untracked`).
    - Destination category dropdown (when moving to Active).
    - `Preview` action button triggering the preview confirmation modal.
    - `Set quantity [ N ]` input + `Apply` button to batch-fill selected rows.
    - `Save quantities` button for committing count changes.
    - `Clear selection` button.
- When zero items are checked and no counts are modified, the bar is hidden.

### 5. Header Actions & Store-Wide Low-Stock Default Relocation
- Title `Products` with live counter badge (`N items`).
- Move the global store-wide low-stock default form into a compact header dropdown/popover (`⚙ Low-stock default: N ▾`), accessible only to Store Admins.
- Consolidate `Export & Templates` and `Auto-fill Missing Images` into a `More actions ▾` menu.
- Primary CTA `+ New product` prominently anchored at the top right.

### 6. Design System & Performance Preservation
- Retain Merqify design tokens (`text-primary`, `bg-action`, `rounded-2xl`, `rounded-full`).
- Retain Cloudflare KV facet caching (`metadata:v1:facets:<vendorId>`) with zero-failure database fallback.
- Preserve 100% of existing functionality with zero lost features.
