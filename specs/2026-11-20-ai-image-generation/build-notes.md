# Merqify Image Hub — phase 2: AI image generation in the gallery (build notes)

Branch `feature/1701-ai-image-generation`. Built for #1701 (part of #1669).

## What changed and why

- **Service Layer (`lib/image-hub-service.ts`):**
  - Added `listProductsForAiPrompt(vendorId, q)`: Returns up to 15 products matching the query across **both active and inactive** catalogue items (`isActive: true` and `isActive: false`), returning id, name, slug, category name, and `isActive` status.
  - Added `generateAiImageForLibrary(input)`:
    - Verifies `STAFF` or `ADMIN` vendor role.
    - Checks daily AI meter allowance via `getVendorAiMeter(auth.vendorId, "PRODUCT_IMAGE")` with `budget.allowed`. Refuses gracefully with `describeAiBudgetRefusal` when budget is depleted.
    - Calls `getImageGenerationService().generateImage(prompt)` targeting `@cf/black-forest-labs/flux-1-schnell`.
    - Debits daily AI meter via `meter.recordImage({ model: IMAGE_GENERATION_MODEL })`.
    - Imports generated asset to the Merqify Image Hub via `importAsset` with `source: "AI_GENERATED"`, `licence: "AI_GENERATED"`, `status: "PENDING_REVIEW"`, `rightsConfirmed: true`.
  - Added unit test coverage in `lib/image-hub-service.test.ts` for RBAC enforcement, empty prompt rejection, AI budget refusal, and successful generation & hub import with provenance.

- **Server Actions (`features/admin/image-library.ts`):**
  - Exported `generateAiImageAction` and `listProductsForAiPromptAction` adhering to the `"use server"` rule (exporting only async functions).
  - Triggers cache revalidation on `/staff/image-library` upon generation.

- **Staff Gallery UI (`components/staff/`):**
  - Created `components/staff/ImageAiGeneratorPanel.tsx`:
    - Collapsible panel in `/staff/image-library`.
    - Product search with clear "Active" and "Inactive" badges.
    - Auto-composes optimized commercial studio prompt on product selection: `"Studio product photograph of [Name], [Category], clean plain white background, professional commercial lighting, crisp focus, centered, 4k"`.
    - Editable prompt and title inputs.
    - "Generate Photo" button with loading transition and error/budget refusal feedback.
  - Integrated into `components/staff/ImageLibraryClient.tsx` to automatically prepend generated assets into the gallery grid upon completion.

- **Batch Generation CLI (`scripts/generate-product-images-ai.ts`):**
  - Built CLI script supporting `--env-file`, `--vendor <slug>`, `--limit <n>`, `--status <all|active|inactive>`, `--dry-run`, `--apply`.
  - By default (`--status all`), processes products lacking non-placeholder photos across **both active and inactive** items, readying photos ahead of activation.
  - Dry-run mode displays candidate products with status tags and formulated prompts without calling Workers AI or mutating database records.
  - Apply mode verifies meter budget, invokes Workers AI, imports into Image Hub as `PENDING_REVIEW`, uploads to store bucket, and links to `ProductImage` with `imageNeedsReview: true` and `hubAssetId`.
  - Verified with live dry run against staging database.

## Decisions taken during the build

- **Inclusive product queries (active and inactive):** Both the UI product picker and the CLI tool explicitly query products regardless of `isActive` status (or with a dedicated `--status` filter), fulfilling the requirement that staff can generate, review, and approve product photos ahead of activating products in the catalogue.
- **Strict metering before generation:** In both UI action and CLI script, `aiMeter.check()` is performed prior to invoking Cloudflare Workers AI, preventing any unmetered or budget-exceeding calls.

## Deviations from the spec

- None.

## Known-shaky areas

- None. All service functions and server actions are covered by unit tests, typechecked, and verified against staging via CLI dry-run.
