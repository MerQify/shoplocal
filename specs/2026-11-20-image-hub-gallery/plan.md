---
id: image-hub-gallery-plan
title: "Image Hub phase 1b — store gallery client (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Phase 1b of the Merqify Image Hub (#1671): a /staff image library that searches, previews, uploads, reviews and assigns hub images to products and categories, copying the bytes into the store's own bucket."
tags: [image-hub, images, staff, storage, p10]
related: [architecture, roadmap]
---

# Image Hub phase 1b — store gallery client (plan)

**Goal:** a store's staff can use the shared Merqify Image Hub from the store's own admin panel.
They can search it, preview, upload, review (admins only), and assign an approved image to a
product or a category. An assigned image becomes an ordinary store image in the store's own
bucket, with the hub keeping a record of where it is used. Shipping this proves the consumer
model of #1669: the store holds only `IMAGE_HUB_URL` and its own key, and never any hub
credential.

## Background

- **The hub is a separate service, repo, Cloudflare account and Neon project**
  (`sriahead/merqify-image-hub`). Phase 1a (#1670) reached hub production on 2026-11-20 (hub PR
  #4).
- **Its contract is the hub repo's `openapi.yaml`.** Every request carries
  `Authorization: Bearer <key>`, `X-Image-Hub-Tenant: <slug>`, and `X-Image-Hub-Actor: <id>`.
- **Consumer keys were issued on 2026-11-20**, all for application `shoplocal` with scopes
  read, write and review, one key per store Worker per environment:

  | Key | Tenants | Written to |
  |---|---|---|
  | `mih_stg_D1G0…` | aheed-food-centre, srimart | `merqify-staging`, `staging` |
  | `mih_stg_7IUh…` | aheed-food-centre | `afc-staging` |
  | `mih_prd_mrSz…` | aheed-food-centre, srimart | `merqify-production`, `production` |
  | `mih_prd_6TcD…` | aheed-food-centre | `afc-production` |

  Each key sits in the ignored `secrets/*.vars` file of the Worker named. Because both cells use
  one application, Aheed has **one** library across both cells.
- **The tenant slug is the store's `Vendor.slug`** (`aheed-food-centre`, `srimart`).

## Scope (this slice)

1. **Config.**
   - `lib/config.ts` gains `getImageHubEnv()` over two optional keys, `IMAGE_HUB_URL` and
     `IMAGE_HUB_API_KEY`. The library counts as configured only when both are set.
   - `scripts/configure-env.mjs` lists both as optional Worker secrets.
   - `secrets/example.vars` and `.env.example` document them.
   - An unconfigured store shows a "not set up" notice on the library page and nothing else
     changes.
2. **Hub client, `lib/image-hub/`.**
   - A typed wrapper over the hub's routes: search, get, content, upload, approve, reject, record
     usage and delete usage.
   - Every function takes the hub config, tenant slug and actor id as parameters. It reads no
     request context and no `lib/config`, the same discipline `lib/repositories/*` follows.
   - A hub error envelope becomes a typed `{ ok: false, code, message }`. A network failure
     becomes `code: "unreachable"`.
   - A request-scoped facade, `lib/image-hub-service.ts`, resolves the role, the vendor's slug
     (tenant) and the user id (actor).
3. **`/staff/image-library` page.**
   - Registered once in `components/staff/nav-items.ts`: Catalogue group, tier `staff`, icon
     `image-up`.
   - Container `PageContainer width="wide"`. A refusal renders `PanelRefusal`.
   - Documented in `docs/staff-playbook/staff-tabs-guide.md`.
   - **Search:** text and status filter, 24 per page, "Load more" by the hub's cursor.
   - **Each card shows:** the thumbnail, title, status, licence, and attribution when present.
4. **Same-origin content route,** `GET /api/admin/image-library/[id]/content`, for staff and
   admins. It streams the hub's `/v1/assets/{id}/content` bytes and is used for two things:
   - **Thumbnails and previews.** These deliberately do not use presigned hub URLs, because the
     store's CSP would then need the hub bucket's host in `img-src`. Each thumbnail costs one hub
     call either way.
   - **Browser-side conversion during assign** (item 7). No CORS is needed on the private hub
     bucket.
5. **Upload (staff and admins).**
   - The browser converts the file with the store's existing WebP routine. It is extracted from
     `components/staff/ProductImageUploader.tsx` into one shared module that both components
     import.
   - It posts multipart to `POST /api/admin/image-library/upload`. That route re-checks role,
     WebP type and the 2 MB store cap (`MAX_IMAGE_BYTES`), then forwards to the hub.
   - Staff pick the licence (`OWNER_SUPPLIED` or `SUPPLIER_PERMISSION`) and must tick the
     rights confirmation.
   - The result is `PENDING_REVIEW`. A hub exact-duplicate refusal (409) shows "already in the
     library".
6. **Review (store admins only).** Approve, and reject with a required reason. Staff see neither
   control, and the server refuses them (403) if called directly. A platform admin passes, as
   with every `requireVendorRole("ADMIN")` gate. Hub licence-attribution refusals are shown
   verbatim.
7. **Assign** (approved assets only; the server re-reads the status). There are two targets:
   - **Product, primary or additional, for staff and admins.** This matches the existing
     product-image actions' tier.
   - **Category, for admins only.** This matches the existing category image routes, which are
     `requireVendorRole("ADMIN")`. It creates a `CategoryAsset` (style `photo`, selected), which
     sets `Category.imageKey` through the existing `createCategoryAsset`.

   How the bytes are copied depends on the asset:
   - **Server copy.** When the asset is WebP and within `MAX_IMAGE_BYTES`, the server fetches the
     bytes and `putObject`s them under a new store key: `buildProductImageKey` or
     `buildCategoryImageKey`. The hub's key is never reused.
   - **Browser conversion.** Otherwise the server answers "needs conversion". The browser loads
     the bytes through the content route (item 4) and converts with the shared WebP routine. It
     uploads through a presigned-PUT ticket, then calls a finalize step. Products use the
     existing `requestImageUpload`. Categories get a new admin-only `requestCategoryImageUpload`,
     because no category upload ticket existed (category images were AI-generated or selected,
     never uploaded). That step
     applies the same `headObject` checks as `attachProductImage`/`addProductImage`.
   - **Order:** bytes are written before the row (as `attachProductImage` does). Then the hub
     usage is recorded (`kind` `PRODUCT` or `CATEGORY`, `externalId` = the store's product or
     category id).
   - **Ids:** the returned usage id and the asset id are stored on the row.
   - **Usage failure:** if recording the usage fails, the image stays assigned, `hubUsageId`
     stays null, and the staff member sees a warning. A missing usage record is recoverable; a
     broken product page is not.
8. **Source mapping.** A hub-assigned product image's `ProductImageSource` is mapped, not newly
   enumerated:

   | Hub source | Store source |
   |---|---|
   | `UPLOAD` | `UNKNOWN` |
   | `AI_GENERATED` | `AI_GENERATED` |
   | `OPEN_FOOD_FACTS` | `OPEN_FOOD_FACTS` |
   | anything else | `UNKNOWN` |

   `UPLOAD` maps to `UNKNOWN`, not `STAFF_UPLOAD`: a library image can be reused across products,
   so it is not evidence of *this* product's pack (#900's `PHOTO_EVIDENCE_SOURCES`). `UNKNOWN`
   keeps the existing "confirm real photo" toggle available to staff.
9. **Schema.**
   - Nullable `hubAssetId` and `hubUsageId` (`TEXT`) on `ProductImage` and `CategoryAsset`.
   - The migration is hand-authored because `migrate dev --create-only` refuses on dev (#895). It
     carries no other statement.
10. **Unassign.**
    - `removeProductImage` and the category-asset delete path delete the hub usage when the row
      carries a `hubUsageId`.
    - Assigning a new **primary** replaces the existing primary row in place
      (`setPrimaryProductImage` updates it). If that row carried a `hubUsageId`, its usage is
      deleted too.
    - Hub failures here never block the store-side change. They are logged with the asset and
      usage ids.
11. **Read-only check script.** `scripts/verify-image-hub.ts --env-file <file>` calls the hub's
    health and a one-item search with that file's store key. It prints the outcome without
    printing the key, and writes nothing.
12. **Documentation.**
    - **Carried forward from phase 1a (listed on #1671):**
      - `docs/model-handoff.md`: the hub as a separate service, and where its secrets live.
      - `docs/developer-portal/env-setup.md`: the two store variables, and that
        `secrets/image-hub-*.vars` belong to the hub operator.
      - `specs/roadmap.md`: rows for phases 1a, 1b and 1c.
      - `docs/developer-portal/local-dev-playbook.md`: Git Bash curl error 43 on
        `-w '%{http_code}'`, and that a migrate command is never a status check.
    - **Audit backfill:** the 22 slice rows and 12 promotion rows `npm run sdd:audit` reports
      missing on 2026-11-20. These go in a separate commit so the slice diff stays readable.

## Deliberately excluded

- **Importing existing store images into the hub** moves to **#1674 (phase 1c)**. The hub's
  public upload records every image as `UPLOAD` with an owner or supplier licence, so
  `AI_GENERATED` and `OPEN_FOOD_FACTS` images would be mislabelled. The store also keeps no
  original URL or attribution for them.
- **AI generation (phase 2), licensed search (phase 3), scheduled discovery (phase 4), and
  pre-generated WebP sizes (phase 5)** are later #1669 phases.
- **Editing asset metadata, deleting assets, and keyword management from the store.** The hub
  supports them, but 1b does not need them to assign images. Staff cannot delete a library image
  from the store.
- **Bundle and campaign images.** Only products and categories are assignment targets, per
  #1671.
- **Pushing the new secrets to the production Workers.**
  - Staging: `npm run configure-env -- staging --file secrets/merqify-staging.vars`, and the same
    for `afc-staging`, after merge. That is part of validation.
  - Production: an owner command at promotion.

## Open items carried forward

- **#1599: the dev Neon password is rejected,** so `npm run preview` cannot read the database.
  Every database-touching requirement is therefore validated **on staging after the `staging`
  merge**, not locally, unless #1599 is fixed first. `validation.md` names each such row.
- **Neon dev and scratch branches expire around 2026-11-28.**
- **#1674 depends on this slice's `hubAssetId` columns.**
