# Image Hub phase 1b — store gallery client (build notes)

Written at the end of Build (2026-11-20), before the Clear. Worktree:
`E:\GitRepositories\aheed-wt-1671`, branch `feature/1671-image-hub-gallery`, cut from
`origin/staging` at `ff591252`. It has its own real `node_modules`, not a junction. Remove the
worktree with `git worktree remove` only after checking that.

## What changed and why

**State going in (verified 2026-11-20):**
- **Hub phase 1a is in hub production.** It was promoted in hub PR #4 (merge `c73362a4`).
  - The first `wrangler deploy` of the new Worker failed after upload with code 10007 and passed
    on a re-run of the deploy job.
  - The 7 runtime secrets were pushed, and `/v1/health` on production returned
    `{"status":"ok","env":"production"}`.
- **The four store keys** were issued under application `shoplocal` and written into the ignored
  `secrets/*.vars` files:

  | Key prefix | Tenants | Written to |
  |---|---|---|
  | `mih_stg_D1G0` | aheed-food-centre, srimart | `merqify-staging`, `staging` |
  | `mih_stg_7IUh` | aheed-food-centre | `afc-staging` |
  | `mih_prd_mrSz` | aheed-food-centre, srimart | `merqify-production`, `production` |
  | `mih_prd_6TcD` | aheed-food-centre | `afc-production` |

  Each authenticated with a read-only list call. **They are NOT yet pushed to any store Worker**:
  that happens with `configure-env` after merge, as `validation.md`'s "Before you start" says.

**Commits on the branch, in order:**
1. `1ba28747`: the spec.
2. `6049c77e`: R10 amendment.
3. `c180bdff`: code.
4. `0845d6ea`: audit backfill (roadmap only).
5. `40e67d8d`: 1a carry-forward docs and regenerated KMS index.
6. `a6c90edc`: R5/R20 amendment.
7. `a7b7f10e`: client comment fix.
8. This build-notes commit, with CHANGELOG and architecture.md.

**Shape, by layer:**
- **Config.** `lib/config.ts` gains `getImageHubEnv()`, which is configured only when both keys
  are set and throws on a non-https URL. `scripts/configure-env.mjs`, `secrets/example.vars` and
  `.env.example` list both keys.
- **Pure client: `lib/image-hub/`.**
  - `client.ts` has one function per hub route. Each takes `HubCaller { config, tenant, actor,
    fetch? }`, returns a `HubResult`, and never throws.
  - `source.ts` holds the R17 mapping.
  - `http.ts` maps error codes to HTTP statuses for the two routes.
- **Facade: `lib/image-hub-service.ts`.**
  - The only runtime caller of the client. It resolves the role, the tenant
    (`fetchVendorProfile(vendorId).slug`), the actor (`user.id`) and the config.
  - It holds the assign orchestration: re-read the asset, then copy or answer needs-conversion,
    then the row, then the usage. It also holds `releaseHubUsage` and
    `requestCategoryImageUploadTicket`.
- **Server actions: `features/admin/image-library.ts`.** Thin wrappers plus `revalidatePath`, and
  the product and category pickers.
- **Routes: `app/api/admin/image-library/upload/route.ts` and `.../[id]/content/route.ts`.**
  Upload is a route handler, not an action, because server actions cap the body at 1 MB.
- **Repositories.**
  - `setPrimaryProductImage` and `addProductImage` take an optional `ProductImageOrigin` and now
    return `ProductImageWriteResult` (adding `imageId` and `replacedHubRef`).
  - `removeProductImage` returns `hubRef`.
  - New `setProductImageHubUsage`.
  - `createCategoryAsset` accepts `hubAssetId`; `deleteCategoryAsset` returns `hubRef`.
  - New `setCategoryAssetHubUsage`. Service facades were updated to match.
- **Unassign hooks.**
  - `features/admin/product-image.ts`: `removeProductImage` and `attachProductImage` call
    `releaseHubUsage`.
  - `app/api/admin/category-images/assets/route.ts`: the DELETE handler does the same.
- **UI.**
  - `app/(admin)/staff/image-library/page.tsx` (server).
  - `components/staff/ImageLibraryClient.tsx`: the grid, load-more, review, and an assign panel
    with the browser-conversion fallback.
  - `components/staff/ImageLibraryUploader.tsx`.
  - `lib/webp-convert.ts`: the extracted `convertToWebp`, now also used by `ProductImageUploader`.
- **Registration.** `components/staff/nav-items.ts` (Catalogue, tier staff, icon `image-up`), the
  staff guide section, `features/feature-catalogue/catalogue.ts`, and the page-width table in
  `tests/page-container.test.ts`.
- **Schema.** `prisma/schema.prisma` and the hand-authored migration
  `20261120120000_image_hub_asset_refs`, which has `ALTER TABLE ... ADD COLUMN` statements only.
- **Script.** `scripts/verify-image-hub.ts`.
- **Docs.**
  - model-handoff gets an Image Hub section.
  - env-setup gets "Merqify Image Hub consumer keys".
  - local-dev-playbook gets two bullets: curl error 43, and that a migrate command is never a
    status check.
  - architecture §3.3 gets the copy-never-serve decision.
  - The roadmap gets a P10 note, rows for 1a/1b/1c, and 36 backfilled rows.

## Decisions taken during the build

- **Each exported service function calls `requireVendorRole` itself** and passes the result to
  `resolveCaller(auth, roles)`. A helper-internal call was first tried; it is invisible to
  `tests/rbac-gate-matrix.test.ts`, which follows imports only one level.
- **Check order is role, then config.** A refused caller never learns whether the hub is
  configured.
- **The server copy re-checks the actual bytes** (the content-type header and the real length)
  before `putObject`, and falls back to `needs_conversion` if they don't qualify, rather than
  trusting the hub's metadata alone.
- **Category finalize validates the key** against `categories/<vendorId>/<safe-slug>-<8 hex>.webp`.
  The service has its own `isCategoryImageKeyFor` because `lib/category-image.ts` exports no key
  validator.
- **Removing a usage treats a hub `not_found` as already gone** (no log). Other failures are
  logged as `[image-hub] usage not removed` with `assetId` and `usageId`.
- **`verify-image-hub.ts` retries a network error up to 3 times**, never an HTTP error: this
  machine drops TLS connections, and one dropped connection masqueraded as a failed key during
  the build.
- **Picker scope:** the product picker lists up to 10 matches for 2+ characters
  (`listProductsForAdmin`). The category picker lists all of the vendor's categories and is
  admin-only.
- **Alt text on assign** uses the hub asset's `alt`, falling back to the product name (the existing
  repository fallback). There is no alt field in the assign panel.

## Deviations from the spec

- **R10 narrowed (commit `6049c77e`).** Seven other uploaders keep their own `canvas.toBlob`.
  Consolidating them is **#1675**.
- **R5 and R20 validation rows amended (commit `a6c90edc`).**
  - R20 excludes the generated `app/(admin)/staff/runbook/docs.ts`, which embeds this spec's text
    (the #539 trap).
  - R5 accepts `import type` of the hub client outside the service.
- **R18 widened slightly.** A plain staff upload replacing a hub-sourced primary
  (`attachProductImage`) also releases that image's hub usage. Without it, `setPrimaryProductImage`
  clears `hubAssetId` while the hub keeps listing a usage that no longer exists. Same mechanism,
  same best-effort semantics.
- **R24 count.** The spec says 22 slice rows. **24** were added, because two more slices
  (`2026-11-18-db-read-retry`, `2026-11-18-deploy-cache-purge-and-skew`) merged to staging after
  Orient. All 12 promotion rows were added. `npm run sdd:audit` now reports only this slice's own
  gaps.
- **Roadmap row for 1b** says "built, not yet merged" and must be updated at Ship/Document.

## Known-shaky areas

- **Nothing here has run against a real database.** #1599 (dev Neon password rejected) blocks
  `npm run preview`.
  - The repository changes are covered by typecheck and by mocked service tests only:
    `setPrimaryProductImage`/`addProductImage` returning `imageId`, the `select` on `hubAssetId`,
    `setProductImageHubUsage`'s `product: { vendorId }` relation filter, and `createCategoryAsset`
    with `hubAssetId`.
  - The migration has never been applied anywhere.
  - **R16's SQL check and R22a–g are the first real exercise.** Run them on staging after the
    migration lands via `deploy-staging`.
- **`setProductImageHubUsage` and `setCategoryAssetHubUsage` use `getPrisma()` (HTTP)** for a
  `findFirst` then a singular `update` with no nested writes, which CLAUDE.md says is fine. If
  staging throws a transaction error here, this is the place.
- **The browser-conversion path (R15, R22f) is untested in a browser.** `convertToWebp` on bytes
  fetched from the content route, the category ticket, and the PUT to the store bucket all need a
  real staff session on staging. The category PUT relies on the store bucket's CORS allowing PUT
  from the vendor origin, which the product uploader already needs.
- **The content route streams `upstream.body` straight through** a Worker `Response`. This is
  unit-tested with a Node `Response` only, not on workerd.
- **AFC cell:** keys exist for `afc-staging`/`afc-production`, but the validation steps use the
  Merqify cell. The AFC Worker's `Vendor.slug` is assumed to be `aheed-food-centre` (it is a copy
  of the same data); this has not been checked on the AFC database.
- **The upload route reads `request.formData()`** on workerd for files up to 2 MB. The body limit
  is not expected to bite, but it is unverified.
