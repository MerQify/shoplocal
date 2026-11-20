# Merqify Image Hub — phase 2: AI image generation in the gallery (validation)

> **Testing Strategy**
> AI generation and metering checks are verified via unit tests with mock Workers AI and AI meter instances.
> Product query inclusion of inactive products is verified via unit/integration tests and typecheck.
> CLI script options and query filtering are tested via CLI dry-run and help validation.

## Validation Steps

| Req | Testing Area | How to verify |
|---|---|---|
| R1–R2 | Budget & RBAC | Unit test in `lib/image-hub-service.test.ts` verifies `generateAiImageForLibrary` enforces `STAFF` role and returns budget refusal when `aiMeter.check().allowed` is false. |
| R3–R5 | Generation & Hub Import | Unit test verifies Workers AI call, `aiMeter.recordImage` recording, and `importAsset` with `AI_GENERATED` / `PENDING_REVIEW` provenance. |
| R6 | Product Query | Unit test verifies `listProductsForAiPrompt` returns products regardless of `isActive` flag. |
| R7–R8 | Server Actions | Unit test or typecheck verifies `generateAiImageAction` and `listProductsForAiPromptAction` export async functions only. |
| R9–R14 | UI | Typecheck and preview verify `ImageAiGeneratorPanel`, product search, prompt composition, inactive badge, and import response handling in `ImageLibraryClient`. |
| R15–R18 | CLI Script | Running `npx tsx scripts/generate-product-images-ai.ts --help` prints usage; dry-run verifies query of active and inactive products lacking photos. |
| R19 | Changelog | `git diff origin/staging -- CHANGELOG.md` shows entry for #1701. |
| R20 | Quality Gates | `npm run lint && npm run typecheck && npm run format:check && npx vitest run --maxWorkers=4` all exit 0. |
