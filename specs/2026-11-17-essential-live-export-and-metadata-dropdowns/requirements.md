# Essential Live Stock Export and Metadata Dropdowns in UI and Excel Workbooks (requirements)

Fixes #1646.

## 1. Problem Statement
1. In the Store Admin Export Hub under "Live Catalogue & Operational Exports", clicking "Essential Stock Export (CSV)" downloads only a blank template header (`generateBlankEssentialCsv()`), returning a 120-byte file without live stock records.
2. Metadata filters on the Export Hub are currently rigid and lack dropdown selection for category/department and archive states.
3. Excel templates and operational workbooks lack native in-cell dropdown validation, requiring staff to manually type enum values like "TRACKED", "0%", "Ambient", leading to typos during bulk imports.

## 2. Requirements

### R1. Live Essential Stock Export
When an authenticated platform administrator requests `/staff/platform/stock-export/export?type=essential&format=csv`, the endpoint MUST stream real live catalogue products formatted with the 10 Essential columns (`Product ID [DO NOT EDIT]`, `Product Name*`, `Brand`, `Category*`, `Price (£)*`, `Unit/Pack Size*`, `Barcode`, `PLU`, `Stock Mode*`, `Current Stock`, `Is Active`).

### R2. Web UI Metadata Dropdowns
The Export Hub on `/staff/platform/stock-export`:
- MUST provide an interactive Status dropdown selector:
  - "Active Only (Uncluttered)"
  - "All Records (Active & Inactive)"
  - "Archived Only"
- MUST provide an interactive Category / Department dropdown selector:
  - "All Departments & Categories"
  - Options populated from the vendor's actual categories.
- Updating either dropdown MUST immediately update download links so all live exports filter dynamically by status and category.

### R3. Excel Data Validation In-Cell Dropdowns
Workbook generation scripts (`generate-templates.ts` and `export-all-stock.ts`) via `scripts/lib/read-spreadsheet.ts`:
- MUST inject compliant OpenXML `<dataValidations>` into `.xlsx` worksheets for:
  - VAT Rate: `0%, 5%, 20%`
  - Stock Mode: `TRACKED, UNTRACKED, INFINITE, UNKNOWN`
  - Net Content Unit: `GRAM, KILOGRAM, MILLILITRE, LITRE, EACH`
  - Storage Condition: `Ambient, Chilled, Frozen`
  - Dietary Flags (`Is Halal`, `Is Vegetarian`, `Is Fresh`, `Is Organic`, `Is Gluten Free`, `Is HMC Certified`): `TRUE, FALSE`
  - Active & Featured states: `TRUE, FALSE`
- When opened in Microsoft Excel, Google Sheets, or LibreOffice, clicking these cells MUST present a native dropdown menu.
