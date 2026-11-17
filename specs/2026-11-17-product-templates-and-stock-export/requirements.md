# Universal & Essential product import/export templates and platform admin stock export (requirements)

Issue #1634. Approved 2026-11-17.

## Context & Objectives

Aheed Online Store requires two standardised product templates supporting all product categories to simplify bulk product creation, updates, and exports:
1. **Universal Product Template**: Comprehensive template containing all available product fields, including mandatory, optional, and category-specific attributes.
2. **Essential Product Template**: Streamlined template containing only the essential/mandatory fields (including Brand) for fast bulk product creation without decision overhead.

Additionally, all existing catalogue records (6,303+ products) must be exported and populated into the Universal Product Template without information loss. The import engine must support two-way synchronisation (editing exported data and re-uploading to update existing products or create new ones) with automated zero-decision import when files adhere to standard formats. Finally, a dedicated Platform Admin-only stock export capability must be provided with strict role-based access control.

## Requirements

### R1 — Universal Product Template (All Fields)
- Must provide a comprehensive schema in both `.xlsx` (Excel) and `.csv` formats supporting all grocery and catalogue categories.
- Must clearly indicate mandatory fields (`*`) vs optional fields.
- Mandatory fields:
  - `Product Name*`
  - `Brand*`
  - `Category*` (Category slug or display name)
  - `Price (£)*` (Decimal GBP, e.g. `2.49`)
  - `Unit/Pack Size*` (Display label or parseable quantity e.g. `1kg`, `500g`, `Each`)
  - `Stock Mode*` (`QUANTITY`, `UNLIMITED`, or `UNKNOWN`)
- Optional & Extended fields:
  - Identification: `Product ID` (for update matching), `SKU`, `Barcode` (EAN-13/UPC), `PLU` (till code).
  - Pricing & Tax: `Compare At Price (£)` (original price for discount display), `Cost Price (£)`, `VAT Rate` (`STANDARD`, `ZERO`, `REDUCED`).
  - Net Content: `Net Content Amount` (integer/decimal), `Net Content Unit` (`GRAM`, `KILOGRAM`, `MILLILITRE`, `LITRE`, `EACH`), `Unit Price Measure` (e.g. `per kg`, `per 100g`).
  - Inventory: `Current Stock` (integer), `Low Stock Threshold` (integer), `Disallow Out Of Stock Purchasing` (`TRUE`/`FALSE`).
  - Dietary & Certifications: `Is Halal` (`TRUE`/`FALSE`), `Is Vegetarian` (`TRUE`/`FALSE`), `Is Fresh` (`TRUE`/`FALSE`), `Is Organic` (`TRUE`/`FALSE`), `Is Gluten Free` (`TRUE`/`FALSE`), `HMC Certified` (`TRUE`/`FALSE`), `HMC Reference`, `HMC Verified At` (YYYY-MM-DD).
  - Age & Restrictions: `Age Restricted` (`16`, `18`, `NONE`).
  - Taxonomy & Filters: `Department` / `Main Section`, `Secondary Categories` (comma-separated), `Tags` (comma-separated).
  - Speciality Grocery Attributes: `Attr: Storage` (`Ambient`, `Chilled`, `Frozen`), `Attr: Cut` (e.g. `Whole`, `Diced`, `Curry Cut`, `Steaks`, `Fillets`), `Attr: Variety / Grain / Species` (e.g. `Basmati`, `Sona Masoori`, `Ponni`, `Tilapia`, `Rohu`, `King Prawns`), `Attr: Form` (`Powder`, `Whole`, `Paste`, `Leaves`), `Attr: Grade / Flavour`.
  - Promotions: `Offer Type` (`MULTI_BUY`, `BUNDLE`, `PERCENTAGE_OFF`), `Offer Trigger Qty`, `Offer Value (£)`, `Offer Notes`.
  - Details & Media: `Short Description`, `Description / Notes`, `Ingredients`, `Allergen Info`, `Storage Instructions`, `Country of Origin`, `Image Filenames / Keys` (comma-separated).
  - SEO: `SEO Title`, `SEO Description`, `URL Slug`.
  - Status: `Is Active` (`TRUE`/`FALSE`), `Is Featured` (`TRUE`/`FALSE`).

### R2 — Essential Product Template (Mandatory Fields Only + Brand)
- Must provide a minimal, user-friendly template in both `.xlsx` and `.csv` formats.
- Specifically includes `Brand` alongside other essential attributes:
  - `Product ID` (Optional — blank for new creation, filled for updating)
  - `Product Name*` (Mandatory)
  - `Brand*` (Mandatory)
  - `Category*` (Mandatory)
  - `Price (£)*` (Mandatory decimal e.g. `2.49`)
  - `Unit/Pack Size*` (Mandatory display string e.g. `1kg`, `Each`)
  - `Barcode` (Optional)
  - `PLU` (Optional)
  - `Stock Mode*` (Default `UNKNOWN` if blank, or `QUANTITY` / `UNLIMITED`)
  - `Current Stock` (Optional integer)
  - `Is Active` (Default `TRUE` if blank)
- Designed to allow users to create or import products rapidly without any prompt or ambiguity.

### R3 — Populate Templates with Existing Data
- Complete export of all existing active and inactive catalogue products across the system into the Universal Product Template.
- Maps all existing database fields (including `Product`, `Brand`, `Category`, `InventoryItem`, `ProductAttributeValue`, `ProductPriceTier`) accurately without loss.
- Money converted from integer pence to decimal GBP string with 2 decimal places.
- Blank cells left when attributes or fields are null/empty rather than generating placeholder assumptions.
- Outputs generated `.xlsx` and `.csv` artifacts available for download and verification.

### R4 — Two-Way Import & Export Engine with Zero-Decision Automation
- Pure TypeScript schema definitions and parser (`lib/product-templates/`).
- Supports both Universal and Essential template formats.
- **Two-way sync**: When an exported file is edited and re-uploaded:
  - If `Product ID` is supplied and matches an existing product in the store -> automatically resolves as `UPDATE`.
  - If `Product ID` is absent, matches against existing products by `Barcode` or `PLU`. If matched -> resolves as `UPDATE`.
  - If no match found -> resolves as `CREATE`.
- **Zero-decision automated apply**: When files match either standard template (Universal or Essential), valid rows are prepared for immediate one-click apply or direct batch execution without requiring manual line-by-line review.
- **Strict validation & error reporting**:
  - Missing mandatory fields are flagged with exact row numbers and field names.
  - Invalid data formats (invalid decimals, invalid dates, invalid enum values) produce descriptive error messages.
  - Valid rows can proceed while invalid rows are isolated with clear diagnostic feedback.
- Safeguards: Respects `manuallyEditedFields` on existing products so that human overrides are preserved unless explicitly overridden.

### R5 — Platform Admin-Only Stock Export
- Export functionality dedicated strictly to Platform Admins (`auth.via === "platform-admin"`).
- UI location: `/staff/platform/stock-export` accessible under the Platform Admin navigation shell.
- Download endpoint: streams or serves the Universal Product Template populated with current stock records.
- Role-based security:
  - Frontend: Non-platform admins are refused via `PanelRefusal` component with clear access explanation.
  - Backend/API: Rejects non-platform admins with HTTP 403 / unauthorized response. Store admins cannot access this route.
- Registered in `components/staff/platform-nav-items.ts`.

### R6 — Verification & Testing
- Unit tests covering template schema parsing, serialisation, validation rules, error formatting, and two-way mapping.
- RBAC tests confirming access refusal for non-platform users.
- Lint and typecheck clean; CI passes.
