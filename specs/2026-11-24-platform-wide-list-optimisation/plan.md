---
id: platform-wide-list-optimisation-plan
title: "Platform-Wide List Optimisation & Cloudflare Metadata Architecture"
audience: [dev]
type: spec
status: draft
version: 1.0.0
updated: 2026-11-24
visibility: internal
tags: [lists, sorting, cloudflare, metadata, caching]
summary: Implementation plan for list collation, edge metadata caching, and admin archive controls.
---

# Plan: Platform-Wide List Optimisation & Cloudflare Metadata Architecture

## 1. Shared List Management Utilities
- Create `lib/list-sorting.ts` with `compareAlphabetical`, `sortCategoryTreeAlphabetical`, `sortNamedEntities`, and shared pagination/filtering helpers.
- Add unit tests in `tests/list-sorting.test.ts`.

## 2. Platform-Wide Default Collation & Visibility
- Update `lib/repositories/categories.ts`, `lib/repositories/brands.ts`, and `lib/repositories/products.ts`.
- Add `listShopperVisibleBrands` enforcing `visibleCategoryWhere` for shopper brand lists.
- Update `components/layout/search-departments.ts` for natural alphabetical navigation order.

## 3. Cloudflare-Native Metadata Cache
- Implement `lib/cloudflare-metadata.ts` with Zod schema validation and KV storage.
- Route `lib/categories-service.ts` and `lib/brands-service.ts` through cache with automatic DB fallback.

## 4. Automated Refresh Lifecycle
- Add `/api/jobs/refresh-metadata` to scheduler under `DAILY_CRON = "0 3 * * *"`.
- Implement `scripts/refresh-metadata-cache.ts` for full-platform batch cache warming and verification.
- Invalidate metadata in `features/admin/catalogue.ts` and `features/admin/brands.ts`.

## 5. Staff Product Archive UI
- Update `app/(admin)/staff/products/page.tsx` and `components/staff/BulkProductActions.tsx`.
