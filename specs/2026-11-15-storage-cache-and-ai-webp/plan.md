---
id: 2026-11-15-storage-cache-and-ai-webp-plan
title: "R2 storage immutable cache header and AI image WebP pipeline (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1630. Emits Cache-Control: public, max-age=31536000, immutable on R2 object uploads and converts AI-generated images to WebP format."
tags: [performance, caching, storage, images, webp]
related: [sdd-workflow]
---

# Plan — R2 storage immutable cache header and AI image WebP pipeline

Closes **#1630**.

## Problem & Approach

1. **Storage Cache Control**:
   `lib/storage.ts` provides `putObject` and `presignPut` for S3/R2 storage interactions. Currently, neither includes `cache-control` headers. When R2 serves objects through its custom domain (`images-staging.aheedfoodcentre.co.uk`), it emits no `Cache-Control` header, causing Cloudflare and browsers to bypass caching (`cf-cache-status: DYNAMIC`).
   - We will update `lib/storage.ts` to include `"cache-control": "public, max-age=31536000, immutable"` in both `putObject` and `presignPut`.
2. **AI Image Format Conversion**:
   Workers AI (`@cf/black-forest-labs/flux-1-schnell`) outputs raw PNG bytes. In Cloudflare Workers V8 isolates, native C++ image encoding libraries (such as `libvips` in `sharp`) cannot run. However, the browser environment natively provides `createImageBitmap` and `HTMLCanvasElement.toBlob(..., "image/webp", 0.82)`.
   - In P6b2, the project standardized on client-side WebP conversion (`toWebp`) for all manual photo uploads.
   - We extend this proven pattern to AI-generated images: when AI returns banner candidates in `PromotionForm.tsx`, the client converts the image blob via `toWebp` and uploads the resulting `.webp` directly via presigned PUT.
   - This drops promotional hero banners from ~400 KB PNG down to ~35 KB WebP (90% bandwidth reduction).

## Implementation Steps

1. **Storage Service (`lib/storage.ts`)**:
   - Update `putObject`: add `"cache-control": "public, max-age=31536000, immutable"` to headers.
   - Update `presignPut`: add `"cache-control": "public, max-age=31536000, immutable"` to headers before signing.
2. **AI Banner Generation API (`app/api/admin/promotions/banner-generate/route.ts`)**:
   - Return generated image binary/base64 so the client can convert it to WebP before R2 storage, or support direct WebP conversion workflow.
3. **Staff Promotion Form (`components/staff/PromotionForm.tsx`)**:
   - When AI generates banner images, convert to WebP via `toWebp` and upload via `requestPromotionBannerUpload`.
4. **Unit Tests**:
   - Add tests verifying `cache-control` headers in `putObject` and `presignPut`.
5. **KMS & SDD Validation**:
   - Re-index with `npm run kms:build-index`.
   - Update `CHANGELOG.md`.
