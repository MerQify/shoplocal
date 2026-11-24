---
id: staff-products-filter-dropdown-widths-plan
title: "Staff Products Filter Dropdown Widths & Layout Stability"
audience: [dev]
type: spec
status: draft
version: 1.0.0
updated: 2026-11-24
visibility: internal
tags: [filters, layout, ui, staff, styling]
summary: Implementation plan for fixed optimal widths and layout stability across staff catalogue filter dropdowns.
---

# Plan: Staff Products Filter Dropdown Widths & Layout Stability

## 1. Filter Dropdown Styling in `app/(admin)/staff/products/page.tsx`
- Update `selectClass` with `w-full truncate` to ensure uniform box sizing and clean ellipsis truncation for long selected names.
- Assign dedicated optimal fixed width and `shrink-0` classes to each filter `<label>`:
  - Status: `shrink-0 w-36`
  - Category: `shrink-0 w-56`
  - Brand: `shrink-0 w-44`
  - Restriction: `shrink-0 w-40`
  - Stock: `shrink-0 w-40`
  - Needs attention: `shrink-0 w-44`
  - Sort: `shrink-0 w-44`
  - Per page: `shrink-0 w-24`
- Group the submit/clear actions with `shrink-0` to prevent awkward orphan wrapping.

## 2. Regression Testing
- Create `tests/staff-products-filter-widths.test.ts` verifying that every filter label retains its optimal width and `shrink-0`, and that `selectClass` retains `w-full truncate`.

## 3. KMS & Quality Verification
- Run `npm run kms:build-index`, `npm run format`, `npm run kms:validate`, `npm run typecheck`, and `npm test`.
