# Requirements: Category-First Sorting, Master Multi-Sheet Export, Operational Exports, and Archival Filtering

Issue: #1638
Status: Draft -> In Review
Target: Staging / Production

## 1. Problem Statement
Store managers and catalog operations staff currently experience friction when working with exported stock and templates:
1. **Scattered Category Navigation:** The current stock export sorts alphabetically by Product Name alone (`orderBy: { name: "asc" }`). As a result, products from the same category or department are scattered throughout 6,000+ rows, making category-by-category stock audits tedious.
2. **Missing Operational Exports:** Categories (hierarchies, sort orders, slugs), Vendor Attributes/Filters, and Discount Codes exist in the database but have no CSV/Excel export mechanisms for auditing, backup, or batch review.
3. **No Single Master Workbook:** Staff must download separate files for products, bundles, and promotions. There is no consolidated multi-sheet Excel spreadsheet containing all catalogue and operational data with native AutoFilters for quick navigation.
4. **Inactive/Expired Clutter:** Expired promotions, exhausted/expired discount codes, and deactivated products/categories clutter the export files when managers only want to review active live inventory.
5. **Admin Hub Access:** While platform admin has `/staff/platform/stock-export`, store admins and managers working in `/staff/products/import` and `/staff/products` need direct, one-click access to download templates, stock exports, and operational exports without navigating to platform-restricted routes.

## 2. User & Business Requirements

### R1. Category-First Hierarchical Sorting
- Product exports (both CSV and Excel, Universal and Essential) must be ordered hierarchically:
  1. Department name ASC (parent category name, e.g., "Groceries", "Halal Meat & Poultry", "Fresh Fruit & Vegetables"). If no parent, fall back to Category name.
  2. Category name ASC (e.g., "Rice & Grains", "Spices", "Beef & Veal").
  3. Product name ASC (e.g., "Daawat Extra Long Basmati Rice 5kg").
- All products belonging to the same Category and Department must appear consecutively.

### R2. Native Excel AutoFilters
- All generated `.xlsx` sheets (Universal, Master, Bundles, Promotions, Categories, Filters, Discount Codes) must enable Excel's native AutoFilter dropdowns on the header row so managers can immediately filter by Category, Brand, In Stock, etc.

### R3. Archival and Status Filtering
- Add filtering options across stock, bundle, promotion, category, and discount export services:
  - `active` (Default): Only active products (`isActive: true`), active unexpired promotions (`isActive: true` AND `endsAt >= now` or null), active unexpired discount codes (`isActive: true` AND `endsAt >= now` or null AND `remainingRedemptions > 0` or null), active categories (`isActive: true`), active bundles (`isActive: true`).
  - `all`: Include all records (both active and inactive/expired/archived).
  - `archived`: Only inactive or expired records.
- Standard export downloads default to `active` so working files stay uncluttered.

### R4. New Operational Exports
1. **Categories Export (`/api/staff/categories/export` & Master tab):**
   - Columns: `Category ID [DO NOT EDIT]`, `Category Name*`, `Slug*`, `Department (Parent Category)`, `Sort Order`, `Is Active`, `Allows Custom Note`, `Total Products`.
2. **Discount Codes Export (`/api/staff/discounts/export` & Master tab):**
   - Columns: `Discount Code ID [DO NOT EDIT]`, `Code*`, `Description`, `Kind (PERCENTAGE/FIXED_AMOUNT)*`, `Value (Percent/Pence)*`, `Min Spend (£)`, `Starts At`, `Ends At`, `Remaining Redemptions`, `Max Per Customer`, `Is Active`, `Status`.
3. **Filters & Attributes Export (`/api/staff/filters/export` & Master tab):**
   - Columns: `Attribute ID [DO NOT EDIT]`, `Attribute Name*`, `Slug*`, `Kind`, `Unit`, `Show On Card`, `Option ID [DO NOT EDIT]`, `Option Name`, `Option Slug`, `Sort Order`.

### R5. Consolidated Master Multi-Sheet Workbook
- A master `.xlsx` workbook (`aheed-food-centre-master-stock-export.xlsx`) containing sheets:
  1. `Products` (Universal format, sorted by Category hierarchy, AutoFilter enabled)
  2. `Categories` (Category tree with product counts, AutoFilter enabled)
  3. `Bundles` (All active bundles with items summary, AutoFilter enabled)
  4. `Promotions` (Active marketing promotions with target links, AutoFilter enabled)
  5. `Discount Codes` (Voucher codes, discount values, expirations, AutoFilter enabled)
  6. `Filters & Attributes` (Storefront filter options and specifications, AutoFilter enabled)
  7. `Field Instructions` (Documentation on non-editable ID columns and formatting rules)

### R6. Unified Store Admin Export Hub
- Embed a comprehensive, responsive Export Hub in `/staff/products/import`:
  - Quick Download buttons for:
    - Master Multi-Sheet Workbook (.xlsx)
    - Universal Stock Export (.xlsx and .csv)
    - Blank Universal & Essential Templates (.csv)
    - Bundles, Promotions, Categories, Discounts, and Filters Exports (.csv)
  - Active vs All records toggle / status indicator.
  - Clear guidance on two-way synchronization and non-editable columns.
- Ensure Store Admins and Staff have appropriate RBAC permissions (`requireVendorRole("STAFF", "ADMIN")`).
