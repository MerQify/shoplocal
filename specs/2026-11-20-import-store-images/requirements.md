# Merqify Image Hub — phase 1c: import store catalogue images (requirements / acceptance criteria)

Tracks #1674 (part of #1669). Adds `importAsset` to `lib/image-hub/client.ts` and `scripts/import-images-to-hub.ts`.

## Client

R1. `lib/image-hub/client.ts` exports `importAsset(caller: HubCaller, input: ImportInput): Promise<HubResult<ImportResult>>`.
R2. `importAsset` posts multipart/form-data to `${caller.config.url}/v1/assets/import` with `file`, `title`, `source`, `licence`, `attribution`, `originalUrl`, `sourceSite`, `alt`, `keywords`, `rightsConfirmed`, `status`, and headers `Authorization`, `X-Image-Hub-Tenant`, `X-Image-Hub-Actor`.
R3. `importAsset` handles both HTTP 201 (new asset) and HTTP 200 (duplicate asset), returning `{ ok: true, value: { ok: true, asset, duplicate } }`. It returns typed `{ ok: false, code, message, status }` on hub errors or network failures.
R4. `lib/image-hub/client.test.ts` includes unit test cases covering `importAsset` with stubbed `fetch`.

## Script

R5. `scripts/import-images-to-hub.ts` exists and can be executed with `npx tsx scripts/import-images-to-hub.ts`.
R6. The script requires `--env-file <path>` and extracts `IMAGE_HUB_URL`, `IMAGE_HUB_API_KEY`, and database/storage variables.
R7. The script accepts optional flags `--dry-run`, `--vendor <slug>`, and `--limit <n>`.
R8. Under `--dry-run`, the script performs no S3 writes, no hub import mutations, and no database writes, printing planned imports.
R9. The script selects `ProductImage` rows where `hubAssetId IS NULL` and `source != 'PLACEHOLDER'`.
R10. `ProductImageSource.AI_GENERATED` is mapped to hub `source: "AI_GENERATED"` and `licence: "AI_GENERATED"`.
R11. `ProductImageSource.OPEN_FOOD_FACTS` is mapped to hub `source: "OPEN_FOOD_FACTS"`, `licence: "CC_BY_SA"`, `attribution: "Open Food Facts contributors"`, and `sourceSite: "Open Food Facts"`.
R12. `ProductImageSource.UPLOAD` is mapped to hub `source: "UPLOAD"`, `licence: "OWNER_SUPPLIED"`, and `rightsConfirmed: true`.
R13. If `product.imageNeedsReview` is false, `status` is set to `"APPROVED"`; if true, `"PENDING_REVIEW"`.
R14. On successful import in live mode, `ProductImage.hubAssetId` is updated in the database. If `status` is `"APPROVED"`, `recordUsage` is called with `kind: "PRODUCT"` and `ProductImage.hubUsageId` is updated.
R15. The script selects `CategoryAsset` rows where `hubAssetId IS NULL`, imports them, and updates `CategoryAsset.hubAssetId` and `hubUsageId`.

## Quality & Gates

R16. `CHANGELOG.md` updated with an entry referencing #1674.
R17. `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npx vitest run --maxWorkers=4` exit 0.
