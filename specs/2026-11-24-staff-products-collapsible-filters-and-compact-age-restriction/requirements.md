# Requirements: Staff Products Collapsible Filters & Compact Age Restriction

## Problem Statement
1. **Collapsible Sidebar Filters**: On wider screens (desktop and high-resolution displays), staff users often need to maximize the visible width of the product table to view barcodes, categories, stock, prices, and status columns without horizontal scrolling. Currently, the sidebar filter panel is fixed at `lg:w-72`, occupying significant horizontal real estate even when staff are done configuring filters.
2. **Age Restriction Clutter in Status Column**: In `/staff/products`, products that cannot currently be sold online due to age restrictions render a lengthy multi-line notice (`"AGE-RESTRICTED — CANNOT BE SOLD ONLINE YET"`) inside the `STATUS` column. This balloons table row height and pushes other critical status badges (such as Archived or Image Review) into an awkward, crowded vertical stack.
3. **Bulk Low-Stock Threshold Clarity**: Staff need clarification and consistent separation between:
   - The top header popover (`LowStockDefaultForm`), which configures the store-wide default for all products (`Vendor.lowStockDefault`).
   - The floating sticky bulk action bar, which should apply a low-stock alert threshold specifically to the currently selected products (`Inventory.lowStockThreshold`).

## User Stories & Acceptance Criteria

### 1. Collapsible Sidebar Filters on Wider Devices
- **US1:** As a store admin or staff member on a desktop/tablet device, I want to collapse the filter sidebar so that the product data table expands across the entire screen width.
- **AC1.1:** A toggle control is provided on both the sidebar header (`Collapse filters` with `panel-left-close` icon) and the table toolbar (`Hide filters` / `Show filters` with active filter count).
- **AC1.2:** When collapsed, the sidebar disappears from the layout, and the main product catalog area smoothly expands to 100% width (`w-full`).
- **AC1.3:** An unobtrusive bar or button allows staff to quickly restore the filter sidebar at any time.
- **AC1.4:** Collapsed state preference is preserved across page refreshes and pagination via `localStorage`.

### 2. Compact "Age Restricted" Badge Under Product Name
- **US2:** As a staff member scanning catalogue rows, I want age restrictions indicated cleanly beneath the product name so that the Status column remains uncluttered and row heights stay uniform.
- **AC2.1:** When a product has `restriction === "AGE_RESTRICTED"`, a compact, stylish badge labelled **"Age Restricted"** is displayed underneath the product name alongside PLU and net content.
- **AC2.2:** The compact badge includes a native tooltip (`title="Cannot currently be sold online due to age restrictions"`) explaining the constraint.
- **AC2.3:** The bulky, multi-line banner is removed from the `STATUS` column, allowing `Active`, `Archived`, `Image Review`, and price alerts to render cleanly.

### 3. Bulk Low-Stock Threshold for Selected Products
- **US3:** As a store admin working with selected products in the Sticky Floating Action Bar, I want to set the low-stock alert count for those selected items specifically.
- **AC3.1:** The Sticky Floating Action Bar contains `Low-stock alert:` with an input and an `Apply to selected` button.
- **AC3.2:** Submitting applies the chosen threshold (`Inventory.lowStockThreshold`) only to the selected product IDs.
- **AC3.3:** The top header control remains the designated place for setting the store-wide default for all products.
