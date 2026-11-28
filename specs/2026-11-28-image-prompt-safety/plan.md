# AI Image Generation NSFW Filter Disambiguation & Safe Retry (plan)

Closes **#1777**.

## Goal

Prevent false-positive NSFW blocks (Cloudflare AI error 8007) on legitimate grocery butchery cuts without violating multi-tenant vendor neutrality by hardcoding "food photography".

## Approach

1. **Pre-prompt sanitization (`lib/ai-image-prompts.ts`)**: Replace collision-prone anatomical cuts with clean culinary descriptions.
2. **Neutral studio framing (`lib/ai-image-prompts.ts`)**: Construct packshots anchored by category.
3. **Automatic recovery (`lib/image-generation.ts`)**: Catch 8007 errors at the network boundary and retry with sanitized prompt.
4. **Pipeline and UI alignment (`lib/product-image-pipeline.ts`, `components/staff/ImageAiGeneratorPanel.tsx`, CLI scripts)**: Pre-sanitize prompts before invoking generation.
5. **Comprehensive testing**: Vitest unit test suite covering word sanitization, prompt composition, and network retry recovery.
