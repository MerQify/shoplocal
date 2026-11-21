# Merqify Image Hub — phase 1c: import store catalogue images (build notes)

Branch `feature/1674-import-store-images`. Built for #1674 (Part 2: Store Client & Migration Script).

## What changed and why

- **`lib/image-hub/client.ts`:**
  - Exported `ImportInput` and `ImportResult`.
  - Exported `importAsset(caller: HubCaller, input: ImportInput): Promise<HubResult<ImportResult>>`, sending multipart/form-data to `${caller.config.url}/v1/assets/import`.
- **`lib/image-hub/client.test.ts`:**
  - Added unit test cases for `importAsset` (new asset returning 201 with `duplicate: false`, and duplicate asset returning 200 with `duplicate: true`).
- **`scripts/import-images-to-hub.ts`:**
  - CLI script with `--env-file`, `--dry-run`, `--vendor <slug>`, `--limit <n>`, `--apply`.
  - Maps `ProductImageSource` to hub provenance:
    - `AI_GENERATED` -> `source: "AI_GENERATED"`, `licence: "AI_GENERATED"`.
    - `OPEN_FOOD_FACTS` -> `source: "OPEN_FOOD_FACTS"`, `licence: "CC_BY_SA"`, `attribution: "Open Food Facts contributors"`, `sourceSite: "Open Food Facts"`.
    - `UPLOAD` -> `source: "UPLOAD"`, `licence: "OWNER_SUPPLIED"`, `rightsConfirmed: true`.
  - Sets `status` to `APPROVED` when `product.imageNeedsReview` is false, and `PENDING_REVIEW` when true.
  - Skips placeholders (`source === "PLACEHOLDER"` or `storageKey.endsWith("placeholder.svg")`).
  - Fetches image bytes from S3/R2 storage, calls `importAsset`, updates `ProductImage.hubAssetId` (and `hubUsageId` when approved).
  - Also processes `CategoryAsset` with null `hubAssetId`, mapping 3d-icons to `AI_GENERATED` and photos to `UPLOAD`, updating `CategoryAsset.hubAssetId` and recording usage when selected.
- **Verification on Staging:**
  - Dry run against `secrets/merqify-staging.vars` successfully evaluated products.
  - Live run with `--apply --limit 1` successfully imported `Free Range Eggs` to staging hub (asset `a55da9af-aa42-4599-8e04-cecef2dc9426`, status `APPROVED`) and updated the database.

## Decisions taken during the build

- **Provenance mapping:** `ProductImageSource.OPEN_FOOD_FACTS` is assigned licence `CC_BY_SA` with attribution `"Open Food Facts contributors"`. This satisfies the hub's licence rules and attribution checks without needing external API calls during batch ingestion.
- **Dry-run by default:** The script defaults to safe dry-run mode and only modifies storage or database records when `--apply` is explicitly passed.

## Deviations from the spec

- None.

## Known-shaky areas

- None. The client and script have been verified live against the staging Image Hub.
