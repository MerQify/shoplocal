# AI Image Generation NSFW Filter Disambiguation & Safe Retry (requirements)

Closes **#1777**.

## Context & Problem Statement

When generating AI product photos via Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`), legitimate grocery and butchery items (e.g. `Halal Chicken Thighs 1kg`, `Chicken Breasts`, `Baby Chicken Whole`, `Cocktail Sausages`) trigger false-positive NSFW content filter blocks (`AiError: Input prompt contains NSFW content. (code 8007) HTTP 400`).

Manually typing "food photography" into the prompt masked the error by shifting the semantic text embedding into the culinary domain, but violates multi-tenant vendor neutrality by styling non-food products (e.g. electronics or stationery) as food, and can introduce secondary false positives on culinary adjectives.

## Requirements

### R1. Pre-Prompt Word Sanitization (`lib/ai-image-prompts.ts`)
- `sanitizePromptForSafety(text: string): string` must be exported as a pure, DB-free, session-free function.
- It must map anatomical/butchery cut names prone to false-positive NSFW blocks (code 8007) to safe culinary synonyms (e.g. `chicken breasts` &rarr; `poultry fillets on a wooden board`, `chicken thighs` &rarr; `boneless leg cutlets on a wooden board`, `baby chicken` &rarr; `cornish game hens on butcher block`, `drumsticks` &rarr; `poultry drumsticks on butcher block`, `cocktail sausages` &rarr; `bite-size party sausages`, `pork butt` &rarr; `pork shoulder roast`).
- It must preserve non-butchery grocery products (e.g. `Basmati Rice 5kg`) and non-food vendor items (e.g. `USB-C Fast Charger 65W`) untouched.

### R2. Vendor-Neutral Studio Prompt Builder (`lib/ai-image-prompts.ts`)
- `buildProductStudioPrompt(productName: string, categoryName?: string | null): string` must compose an optimized commercial packshot prompt:
  `Studio product photograph of ${safeName}${categoryPart}, clean plain white background, professional commercial lighting, crisp focus, centered, 4k`
- It must sanitize `productName` using `sanitizePromptForSafety`.

### R3. Transparent Retry on NSFW Filter Blocks (`lib/image-generation.ts`)
- In `getImageGenerationService().generateImage(prompt)`:
  - If Cloudflare AI responds with HTTP 400 containing error code `8007` or `"nsfw"`:
    - Attempt a secondary fetch using `sanitizePromptForSafety(prompt)` (or neutral commercial studio framing if no butchery terms match).
    - If the retry succeeds, return the resulting ArrayBuffer transparently.
    - If the retry fails, throw a clear error explaining both attempts.

### R4. Product Image Pipeline Integration (`lib/product-image-pipeline.ts`)
- `runProductImagePipeline` must construct its AI prompt using `buildProductStudioPrompt(productName)` instead of raw string interpolation.

### R5. Staff Panel UI Integration (`components/staff/ImageAiGeneratorPanel.tsx`)
- When selecting a product in `/staff/image-library`, populate the prompt field via `buildProductStudioPrompt(prod.name, prod.categoryName)`.

### R6. CLI and Script Tools (`scripts/generate-product-images-ai.ts`, `scripts/backfill-visual-assets.ts`)
- `scripts/generate-product-images-ai.ts` must use `buildProductStudioPrompt(prod.name, prod.category?.name)`.
- `scripts/backfill-visual-assets.ts` must reuse `sanitizePromptForSafety` from `lib/ai-image-prompts.ts`.

### R7. Automated Test Suite (`tests/image-prompt-safety.test.ts`)
- Unit tests must cover:
  1. Sanitization of sensitive butchery cut names.
  2. Preservation of grocery and non-food vendor products.
  3. `buildProductStudioPrompt` with and without category.
  4. Automatic retry recovery on 400 code 8007 errors.
