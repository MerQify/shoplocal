# Requirements: Staff Product Edit 2-Column Responsive Layout & Sticky Low-Stock Alert

## Problem Statement
1. In the Staff Products dashboard (`/staff/products`), staff need immediate access to configure the **Low-Stock Alert At** threshold directly from the Sticky Floating Action Bar without having to open the header settings dropdown or leave the active selection workflow.
2. When drilling down to an individual product (`/staff/products/[id]`), there is no prominent back navigation option at the top of the page, making return to the filtered catalogue cumbersome.
3. The product edit screen (`/staff/products/[id]`) is constrained to a narrow single-column container (`width="narrow"`, `max-w-2xl`), which creates excessive vertical scrolling and under-utilises desktop and tablet screen space.

## User Stories & Acceptance Criteria

### 1. Sticky Floating Action Bar: Low-Stock Alert At Option
- **US1:** As a store admin using the Sticky Floating Action Bar on `/staff/products`, I want a dedicated **Low-Stock Alert At** control group in the toolbar so that I can view and update the store-wide default low-stock alert threshold immediately.
- **AC1.1:** The Sticky Floating Action Bar displays `Low-stock alert at:` followed by a numeric threshold input (min 0, max 999) populated with the current store default.
- **AC1.2:** A `Save default` action button submits the updated threshold via `saveLowStockDefaultAction`.
- **AC1.3:** Success and error feedback messages are presented clearly upon completion.
- **AC1.4:** Visible to store admins (`isStoreAdmin`), while staff without admin permissions see their permitted actions.

### 2. Top Navigation & Back Option on Product Drilldown
- **US2:** As a staff user drilling down to `/staff/products/[id]`, I want a prominent back navigation button and breadcrumb trail at the top of the page so that I can easily return to the catalogue.
- **AC2.1:** A prominent `← Back to products` link button is rendered at the top left of `/staff/products/[id]`.
- **AC2.2:** Breadcrumbs show `Products / {product.name}` with clean truncation for long titles.
- **AC2.3:** A top status summary displays Active / Archived / Restricted state, price, and current stock badge.

### 3. Responsive 2-Column Layout for Product Edit Page
- **US3:** As an admin managing a product on `/staff/products/[id]`, I want an organised 2-column layout on desktop that adapts to a single-column layout on smaller screens.
- **AC3.1:** Container width is expanded to `width="wide"` (`max-w-7xl`), matching the platform's standard admin width.
- **AC3.2:** On desktop (`lg:` breakpoint and above), the layout splits into:
  - **Main Left Column (`lg:col-span-8`)**: Details (Name, Web address, Description, Category), Price & Stock (Price, Was-price, VAT rate, Unit label, Net content, Origin, Brand, Stock mode, Stock quantity, Low-stock threshold, Restock date), Product filters (Attributes), Multi-buy offer, and HMC certification.
  - **Sidebar Right Column (`lg:col-span-4`)**: Status & Visibility Card (Active/Archived toggle, Featured, Halal/Fresh/Organic/Vegetarian/Gluten-free badges, Customer notes, primary Save button), Images Card (`ProductImageManager`, `ProductImageUploader`, `ProductLibraryPicker`), and Restriction Card (`ProductRestrictionPanel`).
- **AC3.3:** On mobile and tablet (`< lg`), the layout smoothly stacks into 1 column with natural visual hierarchy and accessible touch targets.
- **AC3.4:** HTML form association ensures all inputs in both columns submit cleanly to `saveProduct` without invalid nested `<form>` elements.
