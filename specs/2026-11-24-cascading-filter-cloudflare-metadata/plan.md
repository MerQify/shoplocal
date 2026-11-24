---
id: cascading-filter-cloudflare-metadata-plan
title: "Cascading Catalogue Filters & Cloudflare Metadata Architecture"
audience: [dev]
type: spec
status: draft
version: 1.0.0
updated: 2026-11-24
visibility: internal
tags: [filters, cascading, cloudflare, metadata, caching]
summary: Implementation plan for status-based cascading filters powered by Cloudflare KV facet caching.
---

# Plan: Cascading Catalogue Filters & Cloudflare Metadata Architecture

## 1. Cloudflare KV Facets Storage
- Implement `CachedCatalogueFacetsPayloadSchema` and `getFacetsCacheKey` in `lib/cloudflare-metadata.ts`.
- Implement `buildCatalogueFacets` and `getCachedCatalogueFacets` with seamless DB fallback.
- Integrate facet caching into `refreshVendorMetadata` and `invalidateVendorMetadata`.

## 2. Staff Products Cascading Form
- Wire `getCachedCatalogueFacets` into `app/(admin)/staff/products/page.tsx`.
- Dynamically filter categories, brands, restrictions, and stock modes based on `query.status` ("active" vs "archived") and `query.category`.
- Maintain strict alphabetical collation (A–Z) across all filtered optgroups and options.

## 3. Invalidation & Automation
- Invalidate facet cache in `features/admin/product-restrictions.ts` on bulk actions and `features/admin/catalogue.ts` on product saves.
- Automated overnight warming via existing scheduled cron `/api/jobs/refresh-metadata`.
