# Image Hub phase 1b — store gallery client (requirements / acceptance criteria)

Closes #1671 (phase 1b of #1669). The store gets a `/staff/image-library` page backed by the
Merqify Image Hub (`sriahead/merqify-image-hub`, contract in that repo's `openapi.yaml`):
- search, preview and upload, for staff and store admins
- approve and reject, for store admins only
- assign an approved image to a product (staff and admins) or a category (admins only)

An assigned image is **copied into the store's own bucket under a store key** and recorded as a
usage in the hub. Importing the store's existing images is **#1674**, not this slice.

"Staging" below means the Merqify cell's staging Worker (`aheed-staging.merqify.com` /
`srimart-staging.merqify.com`) after this branch is merged to `staging`. "Hub staging" means
`https://merqify-image-hub-staging.merqify-image-hub.workers.dev`.

## Config

R1. `lib/config.ts` exports `getImageHubEnv()`, which reads `IMAGE_HUB_URL` and `IMAGE_HUB_API_KEY`
    through `readEnv`.
    - It returns `{ configured: true, url, apiKey }` only when both are non-empty. Otherwise it
      returns `{ configured: false }`.
    - A set `IMAGE_HUB_URL` that is not an `https://` URL makes it throw.
    - Unit tests in `lib/config.test.ts` cover: both unset, only one set, both set, and a
      non-https URL.
R2. `scripts/configure-env.mjs`'s `OPTIONAL_WORKER_SECRETS` contains `IMAGE_HUB_URL` and
    `IMAGE_HUB_API_KEY`. `secrets/example.vars` and `.env.example` each contain both keys with
    empty values and a comment.

## Hub client

R3. `lib/image-hub/` exports functions for these hub routes:
    - search (`GET /v1/assets`), get (`GET /v1/assets/{id}`), content (`GET /v1/assets/{id}/content`)
    - upload (`POST /v1/assets`), approve, reject
    - record usage (`POST /v1/assets/{id}/usages`), delete usage (`DELETE /v1/assets/{id}/usages/{usageId}`)

    Every exported function takes the hub config (`url`, `apiKey`), the tenant slug and the actor
    id as parameters. Every request sends `Authorization: Bearer`, `X-Image-Hub-Tenant` and
    `X-Image-Hub-Actor`. No file under `lib/image-hub/` imports `next/headers`, `next/cache`,
    `@/lib/auth-rbac`, `@/lib/tenant` or `@/lib/config`.
R4. A hub error response (`{ "error": { "code", "message" } }`) becomes
    `{ ok: false, code, message }` with the hub's code. A `fetch` rejection becomes
    `{ ok: false, code: "unreachable" }`. Unit tests with a stubbed `fetch` cover, for each R3
    function:
    - the request's method, path and the three headers
    - one success
    - one hub error, plus the unreachable case for search
R5. `lib/image-hub-service.ts` is the only module that calls `lib/image-hub/` with request context.
    - **Tenant:** the current vendor's `Vendor.slug`.
    - **Actor:** the signed-in user's id.
    - **Config:** `getImageHubEnv()`.

    When the hub is unconfigured, every service function returns
    `{ ok: false, code: "not_configured" }` without calling `fetch`.

## Page

R6. `app/(admin)/staff/image-library/page.tsx` exists.
    - It is registered once in `components/staff/nav-items.ts`: Catalogue group, `tier: "staff"`,
      `icon: "image-up"`.
    - Its top-level container is `PageContainer` with `width="wide"`.
    - Its `requireVendorRole("STAFF", "ADMIN")` refusal branch renders `PanelRefusal`.
    - `docs/staff-playbook/staff-tabs-guide.md` has a section for it with the seven required
      parts and the access line `Staff and store admins`.
    - The guide's sentence about review says only store admins approve or reject. The sentence
      about categories says only store admins assign to a category.
R7. With `IMAGE_HUB_URL` or `IMAGE_HUB_API_KEY` unset, `/staff/image-library` returns HTTP 200 to a
    signed-in staff user. It renders a notice that the image library is not set up, and shows no
    search, upload or assign controls.
R8. With the hub configured, the page:
    - lists assets from the hub, 24 per page, with a text search (`q`)
    - has a status filter (all, pending review, approved, rejected)
    - has a "Load more" control that requests the next page with the hub's `nextCursor`, and no
      such control when `nextCursor` is null
    - shows on each card: a thumbnail whose `src` is `/api/admin/image-library/<id>/content`, the
      title, status and licence, and the attribution when it is non-null
R9. `GET /api/admin/image-library/[id]/content`:
    - returns 401 without a session, and 403 for a signed-in customer
    - for staff and store admins, streams the hub's bytes with the hub's `content-type` and
      `Cache-Control: private, max-age=300`
    - returns 404 when the hub answers `not_found`, including for an asset belonging to a tenant
      the vendor's key cannot read

## Upload

R10. `components/staff/ProductImageUploader.tsx` and the library's uploader import the same
     WebP-conversion function from one module, and neither file contains its own `canvas.toBlob(`
     call. (Amended at Build: seven other uploaders, `BundleImageUploader`,
     `CampaignBannerUploader`, `ProductImageManager`, `PromotionForm`, `VendorLogoUploader`,
     `VendorMarkUploader` and `WhatsappQrUploader`, each keep their own copy. Consolidating them
     is outside this slice.)
R11. `POST /api/admin/image-library/upload` (multipart):
     - **Auth:** 401 without a session, 403 for a customer.
     - **Refused with 400** when the file is not `image/webp`, exceeds `MAX_IMAGE_BYTES`
       (2 MB), the licence is not `OWNER_SUPPLIED` or `SUPPLIER_PERMISSION`, `rightsConfirmed`
       is not `true`, or the title is empty.
     - **Otherwise** it forwards to the hub and returns the created asset, whose status is
       `PENDING_REVIEW`. A hub 409 duplicate is returned as 409 with a message containing
       `already in the library`.

## Review

R12. Approve and reject require `requireVendorRole("ADMIN")`:
     - A STAFF member calling either directly gets a refusal and the hub is not called. A unit
       test asserts this with a stubbed role and `fetch`.
     - On the page, a STAFF member sees no approve or reject control. A store admin sees both on
       `PENDING_REVIEW` cards.
     - Reject requires a non-empty reason.
     - A hub refusal's message is shown to the admin unchanged.

## Assign

R13. Assigning re-reads the asset from the hub, and refuses with a message unless its status is
     `APPROVED`.
     - **Assign-to-product** requires STAFF or ADMIN. The product must belong to the current
       vendor, and the mode is `primary` or `additional`.
     - **Assign-to-category** requires ADMIN. The category must belong to the current vendor.
R14. **Server copy** applies when the asset's `contentType` is `image/webp` and its `byteSize` is
     at most `MAX_IMAGE_BYTES`:
     - **Key:** the server writes the bytes with `putObject` under a key from
       `buildProductImageKey` (product) or `buildCategoryImageKey` (category). The stored key
       never equals or contains the hub asset's `storageKey`.
     - **Row:** the server writes the store row only after `putObject` succeeds.
       - Product primary: via `setPrimaryProductImage`.
       - Product additional: via the existing add-image repository path.
       - Category: via `createCategoryAsset` with `style: "photo"` and `isSelected: true`, so
         `Category.imageKey` equals the new key.
R15. **Browser conversion** applies to every other approved asset. The assign call returns a
     "needs conversion" result without writing anything. The client then:
     - loads the bytes from `/api/admin/image-library/<id>/content`
     - converts them with the R10 function
     - uploads through a presigned-PUT ticket: the existing `requestImageUpload` for a product,
       or a new `requestCategoryImageUpload(categoryId, byteLength)` for a category. The new one
       requires ADMIN, refuses a category of another vendor and sizes over `MAX_IMAGE_BYTES`, and
       signs a key from `buildCategoryImageKey`. No such ticket existed before this slice.
     - calls a finalize step, which refuses unless `headObject` shows the key exists,
       `contentType` is `image/webp` and size is at most `MAX_IMAGE_BYTES`; then writes the row
       as R14 does
R16. After the row is written, the store records a hub usage with `kind` `PRODUCT` or `CATEGORY`
     and `externalId` set to the store's product or category id. It stores the asset id and the
     returned usage id in the row's `hubAssetId` and `hubUsageId`.

     If recording the usage fails, the row keeps `hubAssetId`, `hubUsageId` stays null, the
     assignment still succeeds, and the response carries a warning that the page shows.
R17. A product image created or replaced by assign gets its `source` from the mapping below:
     - `UPLOAD` → `UNKNOWN`
     - `AI_GENERATED` → `AI_GENERATED`
     - `OPEN_FOOD_FACTS` → `OPEN_FOOD_FACTS`
     - every other hub source → `UNKNOWN`

     The mapping is a pure exported function with a unit test covering all six hub sources.
     `ProductImageSource` gains no new enum value.

## Unassign

R18. Deleting a hub usage happens best effort in three cases:
     - `removeProductImage` deletes a row carrying a `hubUsageId`
     - the category-asset delete path (`deleteCategoryAsset`'s caller) deletes such a row
     - an assign-as-primary replaces a primary row that carried a `hubUsageId`, deleting the old
       usage

     A hub failure never prevents or rolls back the store change. It is logged with the asset id
     and usage id. Unit tests cover the success call and the failure-still-succeeds case for
     `removeProductImage`.

## Schema

R19. One new migration under `prisma/migrations/` adds nullable `"hubAssetId" TEXT` and
     `"hubUsageId" TEXT` columns to `"ProductImage"` and `"CategoryAsset"`, and nothing else.
     - Its SQL contains only `ALTER TABLE ... ADD COLUMN` statements.
     - Its header comment says it was hand-authored because `migrate dev --create-only` refuses
       on dev (#895).
     - `prisma/schema.prisma` declares the four fields as `String?`.

## Isolation and tooling

R20. No file under `app/`, `lib/`, `components/` or `workers/` contains the string
     `merqify-image-hub-staging` or `merqify-image-hub-production`, so the hub URL comes only from
     config. The only `IMAGE_HUB_*` names under those directories are the two from R1. (Amended at
     Build: the generated `app/(admin)/staff/runbook/docs.ts` is excluded, because
     `kms:build-index` copies this spec's own text into it, the #539 trap.)
R21. `npx tsx scripts/verify-image-hub.ts --env-file <file>` runs two calls with that file's
     `IMAGE_HUB_URL` and `IMAGE_HUB_API_KEY`: `GET /v1/health`, and a `GET /v1/assets?limit=1`
     for tenant `aheed-food-centre`.
     - It exits 0 and prints `health ok (<env>)` and `search ok` when both succeed.
     - It exits non-zero naming the failing call otherwise.
     - It never prints the key value, and makes no write request.

## Live behaviour on staging

R22. On staging (validated after the `staging` merge because of #1599), as a store admin of Aheed:
     - **a.** Uploading a WebP through the page creates a `PENDING_REVIEW` asset visible in the list.
     - **b.** A STAFF-only member sees no approve or reject control.
     - **c.** Approving makes the asset `APPROVED`.
     - **d.** Assigning it as a product's primary image makes the storefront product page's
       primary image URL start with the store's `CDN_BASE_URL` and contain `products/`. The hub
       asset (`GET /v1/assets/{id}`) then lists one usage with `kind: PRODUCT` and that product's
       id.
     - **e.** Removing that image on the product page removes the usage from the hub.
     - **f.** A JPEG asset (uploaded straight to hub staging with the store's staging key,
       licence `OWNER_SUPPLIED`, then approved) assigned to a product ends up as a WebP object
       in the store's bucket (`content-type: image/webp`).
     - **g.** Assigning an approved asset to a category makes that category's storefront image
       URL contain `categories/`.

## Documentation

R23. The 1a carry-forward documentation exists:
     - **`docs/model-handoff.md`:** names `sriahead/merqify-image-hub` as a separate service with
       its own Cloudflare account and Neon project. Says the store is a consumer holding only
       `IMAGE_HUB_URL` and `IMAGE_HUB_API_KEY`.
     - **`docs/developer-portal/env-setup.md`:** a section naming the two store variables. It
       says `secrets/image-hub-{staging,production}.vars` are the hub operator's files and never
       store config, and names `npm run keys` in the hub repo as where store keys come from.
     - **`specs/roadmap.md`:** rows for Image Hub phases 1a, 1b (citing
       `specs/2026-11-20-image-hub-gallery/`) and 1c (`#1674`).
     - **`docs/developer-portal/local-dev-playbook.md`:** states that Git Bash's curl rejects
       `-w '%{http_code}'` with error 43 on this machine. Also states that `prisma migrate` and
       `drizzle-kit migrate` apply migrations and are never a status check.
R24. `npm run sdd:audit` reports no ✘ or pending line except lines naming
     `specs/2026-11-20-image-hub-gallery/` or this slice's own PRs. The 22 slice rows and 12
     promotion rows it reported missing on 2026-11-20 are added in a commit separate from the
     slice's code.

## Gates

R25. `CHANGELOG.md` updated (Gate 4).
R26. `lint`, `typecheck`, `test` (`npx vitest run --maxWorkers=4`), `format:check`,
     `kms:validate`, `kms:check-generated` and `npm run build` all remain green after this slice.
     `npm run kms:assemble:internal` followed by a Next build in `kms/site-internal` exits 0.
