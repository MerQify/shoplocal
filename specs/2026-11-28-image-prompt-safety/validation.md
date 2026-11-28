# AI Image Generation NSFW Filter Disambiguation & Safe Retry (validation)

Closes **#1777**.

## Results

| Req | Description | Status | Evidence |
| --- | --- | --- | --- |
| R1 | `sanitizePromptForSafety` replaces butchery cuts and preserves non-butchery/non-food items | ✅ PASS | `tests/image-prompt-safety.test.ts` (6 assertions) |
| R2 | `buildProductStudioPrompt` composes category-aware commercial packshot prompts | ✅ PASS | `tests/image-prompt-safety.test.ts` (with & without category) |
| R3 | `generateImage` transparently retries on HTTP 400 code 8007 (NSFW) | ✅ PASS | `tests/image-prompt-safety.test.ts` (mocked Cloudflare 400 8007 -> 200 PNG) |
| R4 | `runProductImagePipeline` uses `buildProductStudioPrompt` | ✅ PASS | `tests/product-image-pipeline.test.ts` |
| R5 | Staff panel `ImageAiGeneratorPanel` uses `buildProductStudioPrompt` | ✅ PASS | `components/staff/ImageAiGeneratorPanel.tsx` |
| R6 | Scripts reuse `buildProductStudioPrompt` and `sanitizePromptForSafety` | ✅ PASS | `scripts/generate-product-images-ai.ts`, `scripts/backfill-visual-assets.ts` |
| R7 | All unit and regression tests pass | ✅ PASS | 18/18 tests in `tests/image-prompt-safety.test.ts` and `tests/product-image-pipeline.test.ts` pass |
