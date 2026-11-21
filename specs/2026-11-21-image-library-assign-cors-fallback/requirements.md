# Image Library Assign and Product Image Storage Fallback (requirements)

Fixes image assignment failures when assigning non-WebP/converted images from the Image Hub or uploading product images when storage direct presigned PUT is blocked by Cloudflare R2 CORS or missing bucket CORS rules.

## Requirements

R1. `app/api/admin/image-library/upload-direct/route.ts` provides a same-origin route handler for staff/admin uploads of WebP image bytes directly into store object storage.
    - Gated by `requireVendorRole("STAFF", "ADMIN")`.
    - Validates file is WebP and <= `MAX_IMAGE_BYTES` (2 MB).
    - For product uploads, verifies that `key` matches `isProductImageKey(key, product.id)` and that `product` belongs to the authenticated vendor.
    - For category uploads, verifies `auth.via === "ADMIN" || auth.via === "platform-admin"`, and verifies category exists in vendor catalogue.
    - Writes the bytes via `getStorage().putObject(key, bytes, IMAGE_CONTENT_TYPE)`.
    - Returns `{ ok: true, key }` on success, or 400/401/403/404 on failure.

R2. `components/staff/library-assign.ts` attempts direct presigned storage upload first; if storage rejects or preflight fails (e.g. CORS block), it falls back seamlessly to `/api/admin/image-library/upload-direct`.

R3. `components/staff/ProductImageUploader.tsx` and `components/staff/ProductImageManager.tsx` similarly implement the same-origin fallback to ensure product image management works across all single-tenant and multi-tenant cells regardless of R2 CORS settings.

R4. Unit tests in `tests/image-library-upload-direct.test.ts` verify authorization, key ownership validation, and storage write.
