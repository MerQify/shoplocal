# Consolidate browser WebP converters onto lib/webp-convert.ts (validation)

> **Testing Strategy (Lean 80/20 Model)**
> The change eliminates duplicated browser image downscaling/canvas routines across six staff uploader components.
> An architectural guard test in `tests/webp-converters.test.ts` scans all TypeScript ASTs across `app/`, `components/`, `features/`, and `lib/` to verify that canvas blob creation and bitmap decoding are strictly constrained to `lib/webp-convert.ts` and the permitted `VendorMarkUploader.tsx` exception.

## Validation Steps

| Req | How to verify |
|---|---|
| R1 | Inspect `lib/webp-convert.ts`: `convertToWebp` accepts `(source: Blob, maxEdgePx: number = MAX_IMAGE_EDGE_PX)`. |
| R2 | Check each of the six components: imports `convertToWebp` from `@/lib/webp-convert`, private `toWebp` is deleted, and no unused canvas dimension imports remain. |
| R3 | Check `components/staff/VendorMarkUploader.tsx`: remains unchanged as the sole documented exception producing PNG mark assets. |
| R4 | `npx vitest run tests/webp-converters.test.ts --maxWorkers=4`: both tests (`restricts canvas.toBlob...` and `restricts createImageBitmap...`) pass. |
| R5 | `CHANGELOG.md` updated under `## [Unreleased]`. |
| R6 | `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npx vitest run --maxWorkers=4` all pass. |

## Results (2026-11-20)

- **R1:** PASS. `convertToWebp` signature confirmed with optional `maxEdgePx`.
- **R2:** PASS. All six components updated:
  - `BundleImageUploader.tsx`
  - `CampaignBannerUploader.tsx`
  - `ProductImageManager.tsx`
  - `PromotionForm.tsx`
  - `VendorLogoUploader.tsx`
  - `WhatsappQrUploader.tsx`
- **R3:** PASS. `VendorMarkUploader.tsx` untouched and documented as exception.
- **R4:** PASS. `tests/webp-converters.test.ts` passed:
  - `restricts canvas.toBlob to lib/webp-convert.ts and VendorMarkUploader`: PASS
  - `restricts createImageBitmap to lib/webp-convert.ts and VendorMarkUploader`: PASS
- **R5:** PASS. `CHANGELOG.md` entry added.
- **R6:** Pre-commit / full test suite passed.
