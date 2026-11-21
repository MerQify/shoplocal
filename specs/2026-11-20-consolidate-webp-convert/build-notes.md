# Consolidate browser WebP converters onto lib/webp-convert.ts (build notes)

Worktree `E:\GitRepositories\aheed-wt-1675`, branch `feature/1675-consolidate-webp-convert`, from `origin/staging` (`14abf843`). Closes #1675.

## What changed and why

- `lib/webp-convert.ts`:
  - Parameterized `convertToWebp(source: Blob, maxEdgePx: number = MAX_IMAGE_EDGE_PX): Promise<Blob>` allowing custom downscale limits while defaulting to the canonical 1200px.
- Six staff image uploaders:
  - `components/staff/BundleImageUploader.tsx`: removed private `toWebp` and unused imports (`fitWithinEdge`, `IMAGE_QUALITY`), imported and called `convertToWebp`.
  - `components/staff/CampaignBannerUploader.tsx`: removed private `toWebp` and unused imports, imported and called `convertToWebp`.
  - `components/staff/ProductImageManager.tsx`: removed private `toWebp` and unused imports, imported and called `convertToWebp`.
  - `components/staff/PromotionForm.tsx`: removed private `toWebp` and unused imports, replaced all three AI banner / upload calls with `convertToWebp`.
  - `components/staff/VendorLogoUploader.tsx`: removed private `toWebp` and unused imports, imported and called `convertToWebp`.
  - `components/staff/WhatsappQrUploader.tsx`: removed private `toWebp` and unused imports, imported and called `convertToWebp`.
- `components/staff/VendorMarkUploader.tsx`:
  - Retained as a deliberate and documented exception: it produces 5 PNG files (`MARK_FILES`) with custom vendor cream background fill and square containment, rather than converting arbitrary photos to WebP.
- Guard test `tests/webp-converters.test.ts`:
  - AST / syntax traversal across `app/`, `components/`, `features/`, and `lib/` enforcing that `.toBlob(` and `createImageBitmap(` do not exist outside `lib/webp-convert.ts` and `components/staff/VendorMarkUploader.tsx`.

## Decisions taken during the build

- **`VendorMarkUploader` remains separate.** It generates PNG icons and social cards (`MARK_CONTENT_TYPE = "image/png"`), not WebP. Trying to force it into `convertToWebp` would violate separation of concerns and require adding PNG and background fill options to a WebP utility.
- **AST traversal for guard test.** Using TypeScript AST parsing rather than regex prevents false positives from comments, documentation text (e.g. `docs.ts`), and string literals.

## Deviations from the spec

- None.

## Known-shaky areas

- None. Both unit tests and static AST analysis run deterministically and fast (<8s).
