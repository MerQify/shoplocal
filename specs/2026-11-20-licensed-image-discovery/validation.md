# Merqify Image Hub — phase 3: licensed search & discovery (validation)

> **Testing Strategy**
> Discovery providers are tested via unit tests with mock HTTP responses to verify parsing, licence filtering, and error handling.
> Server actions are tested with unit tests checking RBAC, parameter validation, and hub import calls.
> The UI is verified via build/typecheck and manual/live verification against the staging Image Hub.

## Validation Steps

| Req | Testing Area | How to verify |
|---|---|---|
| R1 | Types | TypeScript compilation confirms `DiscoveredImage` and provider interfaces. |
| R2 | Openverse | Unit test in `lib/image-discovery/openverse.test.ts` verifies search request URL, licence params, response parsing, and fallback formatting. |
| R3 | Wikimedia | Unit test in `lib/image-discovery/wikimedia.test.ts` verifies search request URL, `extmetadata` parsing, open licence validation, and non-open rejection. |
| R4 | Open Food Facts | Unit test in `lib/image-discovery/open-food-facts.test.ts` verifies search query formatting, image URL extraction, and attribution assignment. |
| R5 | Aggregator | Unit test in `lib/image-discovery/service.test.ts` verifies parallel execution and resilient handling when one provider fails. |
| R6–R7 | Server Actions RBAC | Unit tests verify `searchDiscoveredImagesAction` and `importDiscoveredImageAction` reject unauthenticated/non-staff callers. |
| R8–R9 | Import Flow | Unit test verifies `importDiscoveredImageAction` fetches bytes, passes full provenance to `importAsset`, and handles duplicate (200) vs new (201) responses. |
| R10–R12 | UI | Typecheck and preview verify the discovery search tab, provider filter, result card rendering, and import button in `ImageLibraryClient`. |
| R13–R14 | CLI Script | Running `npx tsx scripts/discover-product-images.ts --help` prints usage; dry run demonstrates candidate discovery. |
| R15 | Changelog | `git diff origin/staging -- CHANGELOG.md` shows entry for #1697. |
| R16 | Quality Gates | `npm run lint && npm run typecheck && npm run format:check && npx vitest run --maxWorkers=4` all exit 0. |
