# Consolidate browser WebP converters onto lib/webp-convert.ts (requirements / acceptance criteria)

Closes #1675. Consolidates duplicate client-side `canvas.toBlob` and `createImageBitmap` WebP conversion routines across staff image uploaders onto `lib/webp-convert.ts`.

R1. `lib/webp-convert.ts` exports `convertToWebp(source: Blob, maxEdgePx?: number): Promise<Blob>`, where `maxEdgePx` defaults to `MAX_IMAGE_EDGE_PX` (1200px) from `lib/product-image.ts`.
R2. The following six components import and call `convertToWebp` from `@/lib/webp-convert` and remove their local `toWebp` function:
    - `components/staff/BundleImageUploader.tsx`
    - `components/staff/CampaignBannerUploader.tsx`
    - `components/staff/ProductImageManager.tsx`
    - `components/staff/PromotionForm.tsx`
    - `components/staff/VendorLogoUploader.tsx`
    - `components/staff/WhatsappQrUploader.tsx`
R3. `components/staff/VendorMarkUploader.tsx` remains separate as the sole documented exception, because it renders five distinct PNG files (`MARK_FILES`) with square containment and background fill via `MARK_CONTENT_TYPE` (`image/png`), rather than converting an arbitrary image to WebP.
R4. A new guard test in `tests/webp-converters.test.ts` scans all TypeScript/TSX files under `app/`, `components/`, `features/`, and `lib/`:
    - Asserts that no occurrence of `canvas.toBlob(` or `.toBlob(` exists outside `lib/webp-convert.ts` and `components/staff/VendorMarkUploader.tsx`.
    - Asserts that no occurrence of `createImageBitmap(` exists outside `lib/webp-convert.ts` and `components/staff/VendorMarkUploader.tsx`.
R5. `CHANGELOG.md` is updated under `## [Unreleased]` (Gate 4).
R6. All existing and new tests pass (`npm test`, `npx vitest run --maxWorkers=4`), and `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
