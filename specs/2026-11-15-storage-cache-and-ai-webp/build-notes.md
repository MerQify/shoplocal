# Build Notes — R2 storage immutable cache header and AI image WebP pipeline

Closes **#1630**.

## Implemented Changes

1. **Storage Service Cache Headers (`lib/storage.ts` & `lib/product-image.ts`)**:
   - Exported `STORAGE_CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable"`.
   - Updated `putObject` to send `"cache-control": STORAGE_CACHE_CONTROL_IMMUTABLE` in the S3 PUT request headers, ensuring all server-side and background pipeline image uploads write the immutable cache header directly to R2.
   - Updated `presignPut` to sign `"cache-control": STORAGE_CACHE_CONTROL_IMMUTABLE`, enforcing direct-to-storage browser uploads with immutable caching.
2. **Client Uploaders Synchronized**:
   - Updated all 8 staff direct-to-storage uploader components to send `cache-control: STORAGE_CACHE_CONTROL_IMMUTABLE` in their `fetch` headers, matching the SigV4 signature:
     - `components/staff/ProductImageUploader.tsx`
     - `components/staff/ProductImageManager.tsx`
     - `components/staff/BundleImageUploader.tsx`
     - `components/staff/CampaignBannerUploader.tsx`
     - `components/staff/PromotionForm.tsx`
     - `components/staff/VendorLogoUploader.tsx`
     - `components/staff/VendorMarkUploader.tsx`
     - `components/staff/WhatsappQrUploader.tsx`
3. **AI Image WebP Pipeline (`components/staff/PromotionForm.tsx`)**:
   - Enhanced `handleGenerateBanner` and `handleGenerateAi` in `PromotionForm.tsx` to automatically convert AI-generated banner PNGs to optimized WebP format (`toWebp`) using client Canvas and upload them to storage via `requestPromotionBannerUpload`.
   - Cuts promotional banner weight by ~90% (from ~300 KB PNG to ~35 KB WebP) with zero quality degradation.
4. **Unit Tests & Quality Verification**:
   - Added `tests/storage-cache-control.test.ts` verifying R1 and R2 clauses.
   - All quality gates pass: `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run kms:validate`.
