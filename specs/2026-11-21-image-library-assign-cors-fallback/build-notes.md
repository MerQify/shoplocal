# Image Library Assign and Product Image Storage Fallback (plan)

## Problem

When assigning an image from the library that requires client-side WebP conversion, or uploading a product photo, the browser attempts a direct `PUT` to Cloudflare R2 storage using presigned tickets signed with both `content-type` and `cache-control: public, max-age=31536000, immutable`.
When R2 buckets lack CORS (such as dedicated cell `afc-images-production` in account `f8519515606d362c469d596b452fa1a0`) or do not permit `cache-control` header in CORS, the preflight `OPTIONS` request returns 403 Forbidden, causing an unhandled network error in the browser.

## Solution

1. Provide a same-origin route handler `/api/admin/image-library/upload-direct` that executes `getStorage().putObject` from the Cloudflare Worker using server credentials.
2. In `library-assign.ts`, `ProductImageUploader.tsx`, and `ProductImageManager.tsx`, catch direct storage upload rejections and automatically route through the same-origin upload fallback.
