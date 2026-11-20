---
id: consolidate-webp-convert-plan
title: "Consolidate browser WebP converters onto lib/webp-convert.ts (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Consolidates six duplicate toWebp canvas implementations across staff image uploaders onto lib/webp-convert.ts, keeping VendorMarkUploader separate, and adds an architectural guard test."
tags: [images, webp, staff, p10, architecture]
---

# Consolidate browser WebP converters onto lib/webp-convert.ts (plan)

**Goal:** Eliminate duplicate `toWebp` canvas logic across staff image uploaders by consolidating them onto the canonical `lib/webp-convert.ts` module introduced in #1671, and enforce this consolidation with an automated guard test. Closes #1675.

## Context & Background

During slice #1671 (Image Hub), `lib/webp-convert.ts` was introduced to provide a single, shared browser WebP conversion implementation with EXIF orientation handling (`imageOrientation: "from-image"`) and standard edge downscaling (`fitWithinEdge`, `MAX_IMAGE_EDGE_PX`, `IMAGE_QUALITY`, `IMAGE_CONTENT_TYPE`). It was integrated into `ProductImageUploader.tsx` and the Image Library components.

However, six other staff uploaders still retained their own copy-pasted versions of the decode -> downscale -> `canvas.toBlob` routine:
- `components/staff/BundleImageUploader.tsx`
- `components/staff/CampaignBannerUploader.tsx`
- `components/staff/ProductImageManager.tsx`
- `components/staff/PromotionForm.tsx`
- `components/staff/VendorLogoUploader.tsx`
- `components/staff/WhatsappQrUploader.tsx`

`VendorMarkUploader.tsx` also uses `canvas.toBlob` and `createImageBitmap`, but specifically outputs five PNG assets (`MARK_CONTENT_TYPE = "image/png"`) with vendor cream background filling and square containment for favicon/app mark generation. It is not an arbitrary WebP photo converter and will remain separate as a permitted exception.

## Architecture & Implementation Steps

1. **Parameterize `lib/webp-convert.ts`**:
   - Update `convertToWebp(source: Blob, maxEdgePx: number = MAX_IMAGE_EDGE_PX): Promise<Blob>` to allow optional custom edge bounds while defaulting to `MAX_IMAGE_EDGE_PX`.

2. **Consolidate Uploaders**:
   - In each of the six components:
     - Replace the private `toWebp` function with an import of `convertToWebp` from `@/lib/webp-convert`.
     - Remove obsolete/unused imports (`IMAGE_CONTENT_TYPE`, `IMAGE_QUALITY`, `MAX_IMAGE_EDGE_PX`, `fitWithinEdge`) from `@/lib/product-image` if no longer used by the file.
     - Call `convertToWebp(...)` directly in the upload/generation transitions.

3. **Add Guard Test (`tests/webp-converters.test.ts`)**:
   - Implement an automated scanner following the pattern of `tests/icon-imports.test.ts` and `tests/page-container.test.ts`.
   - Scan `app/`, `components/`, `features/`, `lib/` for `.toBlob(` and `createImageBitmap(`.
   - Enforce that only `lib/webp-convert.ts` and `components/staff/VendorMarkUploader.tsx` are allowed to perform canvas bitmap decoding and blob export.

4. **KMS & Documentation**:
   - Re-index with `npm run kms:build-index` in the worktree.
   - Update `CHANGELOG.md` under `## [Unreleased]`.

5. **Validation**:
   - Run unit tests (`npx vitest run --maxWorkers=4`).
   - Run typecheck, lint, and format checks.
