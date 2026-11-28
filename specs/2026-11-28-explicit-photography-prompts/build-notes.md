# Explicit Domain Commercial Photography Prompts & Anti-Live-Animal Guardrails (build-notes)

Built for **#1779**.

## Implementation Details

- **`lib/ai-image-prompts.ts`**:
  - Implemented `detectPhotographyDomain(categoryName, description, productName)` with prioritization:
    1. Category inspection (food/butchery, electronics, beauty, household).
    2. Overrides for product names with strong electronics/battery keywords even if placed in generic grocery categories.
    3. Product name and description inspection.
    4. Fallback to `"general"`.
  - Added `getDomainPhotographyDetails(domain)` providing photography style prefixes (`"Commercial food photography of"`, `"Commercial electronic goods photography of"`, etc.) and domain guardrails.
  - Refined `sanitizePromptForSafety(text)` to produce explicit dressed cuts ready to cook and removed `"on butcher block"` / `"on wooden board"` triggers.
  - Updated `buildProductStudioPrompt` to incorporate domain prefix and domain guardrails on every product prompt.
- **`lib/product-image-pipeline.ts`**:
  - Added `categoryName` and `description` to `PipelineOptions`.
  - Passed `categoryName` and `description` to `buildProductStudioPrompt`.
- **`scripts/generate-product-images-ai.ts`**:
  - Selected `description` from Prisma product query and passed to `buildProductStudioPrompt`.
- **`lib/image-generation.ts`**:
  - Integrated `buildProductStudioPrompt` into fallback prompt generation during safety filter retries.
