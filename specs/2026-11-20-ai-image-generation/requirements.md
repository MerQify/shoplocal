# Merqify Image Hub — phase 2: AI image generation in the gallery (requirements)

Built for #1701 (part of #1669).

## Functional Requirements

### AI Image Generation & Metering (`lib/image-hub-service.ts`)

- **R1:** `generateAiImageForLibrary` must require `STAFF` or `ADMIN` vendor role.
- **R2:** Every generation request must check the vendor's daily AI budget via `getVendorAiMeter(vendorId, "PRODUCT_IMAGE")`. If the budget check fails (`budget.allowed === false`), it must return a clean refusal without invoking Workers AI.
- **R3:** When the budget allows, the service must invoke `getImageGenerationService().generateImage(prompt)` using `@cf/black-forest-labs/flux-1-schnell`.
- **R4:** Upon successful generation, the service must record image usage in the meter via `aiMeter.recordImage({ model: IMAGE_GENERATION_MODEL })`.
- **R5:** The generated image must be imported to the Image Hub via `importAsset` with:
  - `source: "AI_GENERATED"`
  - `licence: "AI_GENERATED"`
  - `rightsConfirmed: true`
  - `status: "PENDING_REVIEW"`
  - `title`: product name or prompt summary
- **R6:** `listProductsForAiPrompt` must search this vendor's products, returning **both active and inactive** products (`isActive: true` and `isActive: false`), returning id, name, slug, category name, and `isActive` boolean.

### Server Actions (`features/admin/image-library.ts`)

- **R7:** `generateAiImageAction(input)` must wrap `generateAiImageForLibrary`, revalidate `/staff/image-library` on success, and return `LibraryResult<HubAsset>`.
- **R8:** `listProductsForAiPromptAction(query)` must wrap `listProductsForAiPrompt` and require `STAFF` or `ADMIN` vendor role.

### Staff Panel UI (`/staff/image-library`)

- **R9:** `/staff/image-library` must feature an interactive AI generation panel (`ImageAiGeneratorPanel`).
- **R10:** The panel must allow searching/selecting any of the vendor's products, displaying an "Inactive" badge if `isActive === false`.
- **R11:** Selecting a product must populate an optimized studio grocery prompt containing the product name and category.
- **R12:** The panel must allow manual prompt editing and provide a "Generate Photo" action.
- **R13:** When generation completes, the newly created asset must be prepended into the gallery view.
- **R14:** If the vendor's daily AI budget is exhausted, a clear refusal notice with the budget explanation must be shown.

### Batch Generation CLI (`scripts/generate-product-images-ai.ts`)

- **R15:** `scripts/generate-product-images-ai.ts` must accept `--env-file`, `--vendor <slug>`, `--limit <n>`, `--status <all|active|inactive>`, `--dry-run`, `--apply`.
- **R16:** By default, the script must query products lacking non-placeholder photos across **both active and inactive** statuses.
- **R17:** In dry-run mode, the script must log candidate products and generated prompts without calling Workers AI or writing to the Hub.
- **R18:** In `--apply` mode, the script must meter each call, generate the image, import it into the Hub as `PENDING_REVIEW`, and link it to the product with `imageNeedsReview: true`.

### Quality & SDD Discipline

- **R19:** `CHANGELOG.md` must record the changes on the branch before merge (Gate 4).
- **R20:** All quality checks (`npm run lint`, `npm run typecheck`, `npm run format:check`, `npx vitest run --maxWorkers=4`) and KMS checks (`kms:validate`, `kms:check-generated`) must exit 0.
