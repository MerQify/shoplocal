---
id: import-store-images
title: "Merqify Image Hub — phase 1c: import store catalogue images (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Adds importAsset to lib/image-hub/client.ts and a safe, idempotent CLI script to import existing store ProductImage and CategoryAsset rows into the central Image Hub with provenance and attribution, updating hubAssetId."
tags: [image-hub, script, provenance, p10]
related: ["#1669", "#1671", "#1674"]
---

# Merqify Image Hub — phase 1c: import store catalogue images (plan)

**Goal:** a node script imports all existing store catalogue images (product photography, AI illustrations, Open Food Facts images, category assets) into the central Merqify Image Hub with full provenance, updating the store's `hubAssetId` columns so every store image is linked to the hub library.

## Why this slice exists

Phase 1a created the standalone Merqify Image Hub service, and Phase 1b gave store staff the `/staff/image-library` client. Part 1 of #1674 added the `POST /v1/assets/import` endpoint with `import` scope.

Existing store catalogues contain hundreds of images:
1. `AI_GENERATED` product and category images from Workers AI pipelines.
2. `OPEN_FOOD_FACTS` images requiring `CC_BY_SA` licence and attribution.
3. Live store product photography with confirmed ownership.

This slice implements the store-side client method and migration script to ingest these into the central Image Hub idempotently without losing provenance.

## Scope (this slice)

1. **Client method (`lib/image-hub/client.ts`):**
   - Add `importAsset(caller: HubCaller, input: ImportInput): Promise<HubResult<ImportResult>>`.
   - Add unit tests in `lib/image-hub/client.test.ts`.

2. **Migration script (`scripts/import-images-to-hub.ts`):**
   - Accepts `--env-file <path>` (e.g. `secrets/merqify-staging.vars`, `.env`), `--vendor <slug>`, `--limit <n>`, `--dry-run`.
   - Iterates over `ProductImage` where `hubAssetId IS NULL` and `source != 'PLACEHOLDER'`:
     - Reads image bytes from S3 storage (`getObject`).
     - Maps provenance:
       - `AI_GENERATED` -> `source: "AI_GENERATED"`, `licence: "AI_GENERATED"`
       - `OPEN_FOOD_FACTS` -> `source: "OPEN_FOOD_FACTS"`, `licence: "CC_BY_SA"`, `attribution: "Open Food Facts contributors"`, `sourceSite: "Open Food Facts"`
       - `UPLOAD` -> `source: "UPLOAD"`, `licence: "OWNER_SUPPLIED"`, `rightsConfirmed: true`
     - Determines approval status from `product.imageNeedsReview`.
     - Calls `importAsset`.
     - In live mode: updates `ProductImage.hubAssetId`.
     - If `status === "APPROVED"`: calls `recordUsage` with `kind: "PRODUCT"`, `externalId: product.id`, and updates `ProductImage.hubUsageId`.
   - Iterates over `CategoryAsset` where `hubAssetId IS NULL`:
     - Reads image bytes.
     - Maps provenance: `source: "AI_GENERATED"` for 3d-icons, otherwise `UPLOAD`.
     - In live mode: updates `CategoryAsset.hubAssetId`, and records usage if selected.

3. **Safety & Idempotency:**
   - `--dry-run` mode logs all planned operations without uploading bytes or writing to the DB.
   - The hub returns HTTP 200 with `duplicate: true` for existing SHA-256 matches, allowing the script to safely update `hubAssetId` even if previously uploaded.

## Deliberately excluded

- **Deleting store images from S3:** Images stay in the store bucket so live storefront traffic continues without disruption.
- **External network lookups during import:** Open Food Facts attribution uses the standard `"Open Food Facts contributors"` string to avoid rate limits or network failures during batch runs.
