# Merqify Image Hub — phase 1c: import store catalogue images (validation)

> **Testing Strategy**
> Client functions are verified with unit tests in `lib/image-hub/client.test.ts`.
> The import script is verified via unit/CLI dry-run against staging config and Prisma.

## Validation Steps

| Req | Testing Area | How to verify |
|---|---|---|
| R1 | Client | `importAsset` is exported from `lib/image-hub/client.ts`. Typecheck verifies `ImportInput` and `ImportResult`. |
| R2–R3 | Client | Unit tests verify `POST /v1/assets/import` request method, path, headers, multipart form data fields, and return shapes for both 201 (new) and 200 (duplicate). |
| R4 | Unit Tests | `npx vitest run lib/image-hub/client.test.ts` passes. |
| R5–R8 | Script CLI | Running `npx tsx scripts/import-images-to-hub.ts --help` prints usage with `--env-file`, `--dry-run`, `--vendor`, `--limit`. |
| R9–R13 | Script Mapping | Unit tests or dry-run verify `ProductImageSource` mapping to hub source/licence and approval status derived from `imageNeedsReview`. |
| R14–R15 | Persistence | In dry-run mode, logs planned updates for `hubAssetId` and `hubUsageId`. In live execution against staging, asserts `hubAssetId` is saved. |
| R16 | Changelog | `git diff origin/staging -- CHANGELOG.md` shows entry for #1674. |
| R17 | Quality Gates | `npm run lint && npm run typecheck && npm run format:check && npx vitest run --maxWorkers=4` all exit 0. |
