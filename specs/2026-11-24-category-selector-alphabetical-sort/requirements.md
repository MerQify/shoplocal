# Requirements: Category Selector Alphabetical Sorting & Staff Category Collation

## 1. Category Option Groups (Dropdowns & Selectors)
- **R1:** `toCategoryOptionGroups` MUST automatically sort parent department optgroups alphabetically (A–Z) by default.
- **R2:** `toCategoryOptionGroups` MUST automatically sort child subcategory options alphabetically (A–Z) within each optgroup by default.
- **R3:** `toCategoryOptionGroups` MUST support opting out of alphabetical sorting via `{ sortAlphabetical: false }` if explicit input order is required.
- **R4:** All forms and pickers utilizing `toCategoryOptionGroups` (`/staff/products` category filter, `BulkProductActions` destination category picker, `ProductForm` category picker, and `PromotionForm` department/category picker) inherit alphabetical sorting automatically.

## 2. Staff Categories Administration
- **R5:** `/staff/categories` MUST render top-level departments and their nested subcategories alphabetically (A–Z) by default.
