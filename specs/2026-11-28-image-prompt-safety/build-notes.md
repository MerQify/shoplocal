# AI Image Generation NSFW Filter Disambiguation & Safe Retry (build notes)

Closes **#1777**.

## Summary

Resolved false-positive NSFW blocks (`AiError: Input prompt contains NSFW content. (code 8007)`) in Cloudflare Workers AI image generation by introducing pre-prompt word sanitization and automatic transparent retry recovery.

## Files Touched

- `lib/ai-image-prompts.ts`: Exported `sanitizePromptForSafety` and `buildProductStudioPrompt`.
- `lib/image-generation.ts`: Intercepted 400 code 8007 errors and retried with safe prompt.
- `lib/product-image-pipeline.ts`: Integrated `buildProductStudioPrompt`.
- `components/staff/ImageAiGeneratorPanel.tsx`: Auto-populated prompt field using `buildProductStudioPrompt`.
- `scripts/generate-product-images-ai.ts`: Used `buildProductStudioPrompt`.
- `scripts/backfill-visual-assets.ts`: Reused `sanitizePromptForSafety`.
- `tests/product-image-pipeline.test.ts`: Fixed Vitest matcher and added prompt sanitization test.
- `tests/image-prompt-safety.test.ts`: Added unit tests for sanitization, prompt composition, and 8007 retry.
- `CHANGELOG.md`: Recorded changes under `## [Unreleased]`.
