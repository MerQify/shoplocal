---
id: category-selector-alphabetical-sort-plan
title: "Category Selector Alphabetical Sorting & Staff Category Collation"
audience: [dev]
type: spec
status: draft
version: 1.0.0
updated: 2026-11-24
visibility: internal
tags: [lists, sorting, categories, selectors]
summary: Default alphabetical sorting for category option groups across staff and product forms.
---

# Plan: Category Selector Alphabetical Sorting & Staff Category Collation

## 1. Centralised Category Option Group Sorting
- Wire `sortCategoryOptionGroups` from `@/lib/list-sorting` into `toCategoryOptionGroups` in `lib/catalogue-form.ts`.
- Ensure parents and children are sorted alphabetically (A–Z) by default with an optional `{ sortAlphabetical: false }` escape hatch.
- Update `tests/catalogue-form.test.ts` to assert A–Z ordering.

## 2. Staff Categories Administration
- Apply `sortCategoryTreeAlphabetical` to `categories` in `app/(admin)/staff/categories/page.tsx` for consistent A–Z presentation.

## 3. Test Flakiness Remediation
- Harden `tests/image-library-client.test.tsx` async rejection assertions to ensure robust CI executions.
