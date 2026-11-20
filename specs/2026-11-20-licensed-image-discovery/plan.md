---
id: licensed-image-discovery
title: "Merqify Image Hub — phase 3: licensed search & discovery (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Adds machine-readable open licensed search providers (Openverse, Wikimedia Commons, Open Food Facts) to /staff/image-library and a batch discovery CLI, importing candidate images with verified provenance into the Image Hub as PENDING_REVIEW."
tags: [image-hub, openverse, wikimedia, open-food-facts, discovery, p10]
related: ["#1669", "#1671", "#1674", "#1697"]
---

# Merqify Image Hub — phase 3: licensed search & discovery (plan)

**Goal:** Staff and store admins can search open-licensed image repositories (Openverse, Wikimedia Commons, and Open Food Facts) directly from `/staff/image-library`, preview results with verified licences and attributions, and import candidates into the central Merqify Image Hub with a single click. A CLI tool also allows batch discovery for unphotographed products (#1521).

## Why this slice exists

Merqify Image Hub (#1669) creates a central multi-store image gallery. Phase 1a established the standalone hub service, Phase 1b built the `/staff/image-library` client, and Phase 1c (#1674) added the import endpoint and migrated existing store catalogue images.

However, many store products lack photography—for example, 86 of Aheed Food Centre's 98 live products lack real photos (#1521). Scraping arbitrary commercial websites is illegal and violates copyright. Phase 3 provides a compliant, automated solution by searching open repositories that offer machine-readable open licences (CC0, Public Domain, CC-BY, CC-BY-SA, ODbL).

## Licensing stance (non-negotiable)

1. **Zero arbitrary web scraping:** Only machine-readable APIs from recognized open repositories with explicit commercial/derivative reuse permissions are queried:
   - **Openverse:** Filtered to commercial-use friendly licenses (`CC0`, `PDM`, `CC_BY`, `CC_BY_SA`).
   - **Wikimedia Commons:** MediaWiki API filtering to public domain and CC licenses.
   - **Open Food Facts:** User-contributed food package photos under `CC_BY_SA` / `CC0`.
2. **Complete Provenance:** Every imported image records `source`, `licence`, `attribution`, `sourceSite`, and `originalUrl`.
3. **Admin Review Required:** Imported images enter the hub as `PENDING_REVIEW`. Store admins must review and approve them before they can be assigned to live products.

## Scope (this slice)

1. **Discovery Provider Adapters (`lib/image-discovery/`):**
   - Core types: `DiscoveredImage`, `DiscoveryProvider`, `DiscoverySearchParams`.
   - Adapters for:
     - `Openverse`: queries Openverse REST API, parses licensing & creator.
     - `Wikimedia Commons`: queries MediaWiki API `generator=search` with `imageinfo`, parses metadata.
     - `Open Food Facts`: queries Open Food Facts search API, parses package photos & contributors.
   - Aggregator service: `searchDiscoveredImages` querying enabled providers with timeout & error resilience.

2. **Server Actions & Service Integration:**
   - `searchDiscoveredImagesAction`: exposes provider searches to `/staff/image-library` for `STAFF` and `ADMIN`.
   - `importDiscoveredImageAction`: takes a `DiscoveredImage`, fetches image bytes server-side, validates format, calls `importAsset` with full provenance, and returns the created `HubAsset`.

3. **Staff Panel UI (`components/staff/`):**
   - In `/staff/image-library`, add an open image discovery drawer/tab:
     - Search bar with provider selector (`All`, `Openverse`, `Wikimedia Commons`, `Open Food Facts`).
     - Results grid with image preview, provider tag, licence badge, attribution text, and link to original source.
     - "Import to Library" button that calls `importDiscoveredImageAction` and prepends the new asset into the library list.

4. **Batch Discovery CLI (`scripts/discover-product-images.ts`):**
   - Discovers candidates for store products where `ProductImage` is empty or placeholder.
   - Flags candidates with product name, provider, licence, and similarity.
   - In `--dry-run`, prints planned matches. In `--apply`, imports candidates into the hub as `PENDING_REVIEW`.
