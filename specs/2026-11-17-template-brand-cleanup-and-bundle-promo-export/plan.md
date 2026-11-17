---
id: 2026-11-17-template-brand-cleanup-and-bundle-promo-export-plan
title: "Product Template Brand Cleanup, Bundle & Promotion Export, and Protected Columns (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-17
visibility: internal
summary: "Leaves Brand blank for unbranded products, supports CSV and Excel exports for Bundles and Promotions with two-way sync support, and marks system ID columns with explicit non-editable notices in templates and instructions."
tags: [catalogue, templates, brands, bundles, promotions, export, import]
related: [2026-11-17-product-templates-and-stock-export-plan]
---

# Product Template Brand Cleanup, Bundle & Promotion Export, and Protected Columns (plan)

Issue #1636. Requirements: `requirements.md`.

## Architecture & Module Organization

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Template System Updates                                │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼────────────────────────────────────┐
        ▼                                   ▼                                    ▼
┌───────────────────────┐       ┌───────────────────────┐            ┌───────────────────────┐
│ Product Brand Cleanup │       │ Protected Column Keys │            │ Bundles & Promotions  │
│  - Blank if unbranded │       │  - Product ID         │            │  - CSV/Excel Export   │
│  - Tolerant on import │       │    [DO NOT EDIT]      │            │  - Staff UI endpoints │
└───────────────────────┘       └───────────────────────┘            └───────────────────────┘
```

1. **Brand Cleanup & Tolerance:**
   - Update `lib/product-templates/export.ts`: remove `|| "Aheed"`, output `""`.
   - Update `lib/product-templates/import.ts`: remove mandatory validation for `Brand*` or allow empty brand as unbranded (`brandId: null`).
   - Update `lib/product-templates/schema.ts`: adjust column definition and aliases so `Brand` and `Brand*` accept empty string.

2. **Protected Column Notices:**
   - Update `UNIVERSAL_COLUMNS` and `ESSENTIAL_COLUMNS` primary header for Product ID to `Product ID [DO NOT EDIT / SYSTEM ID]`.
   - Update `normalizeHeader()` and alias lookups in `lib/product-templates/import.ts` to recognise `product id`, `id`, `product id [do not edit / system id]`.
   - Update `scripts/product-templates/generate-templates.ts` to include clear non-editable instructions and visual highlights in the Field Instructions sheet.

3. **Bundles & Promotions Export:**
   - Create `lib/bundle-templates/export.ts` (and `service.ts`) for serializing `Bundle` and `BundleItem` rows to CSV and Excel.
   - Create `lib/promotion-templates/export.ts` (and `service.ts`) for serializing `Promotion` rows to CSV and Excel.
   - Create route handlers:
     - `/api/staff/bundles/export` (staff role gated)
     - `/api/staff/promotions/export` (staff role gated)
   - Add export buttons to `/staff/bundles` and `/staff/promotions` pages.
   - Update `/staff/platform/stock-export` to include Bundles and Promotions export options.

4. **Re-generate Live Exports:**
   - Run `scripts/product-templates/export-all-stock.ts` and `scripts/product-templates/generate-templates.ts` to update `public/templates/` files.

## Tests & Verification
- `tests/product-templates.test.ts`: Update tests to verify blank brand export, unbranded import tolerance, and protected ID header alias parsing.
- `tests/bundle-promotion-templates.test.ts`: Verify bundle and promotion export formatting, CSV escaping, and field mappings.
