# Image Hub phase 1b — store gallery client (validation)

> **Testing Strategy (Lean 80/20 Model)**
> Provide enough testing to give confidence without creating unnecessary or duplicate tests. Avoid testing the same behaviour multiple times at different levels unless doing so provides additional confidence.
>
> **The Main Principle:**
> - **Build:** Did we build the component correctly?
> - **Validate:** Does the feature work correctly in the real system?
> - **Release:** Is the complete system safe, reliable, and ready for users?

## Before you start

- **Where to validate.** #1599 (the dev Neon password is rejected) blocks database reads under
  `npm run preview`. Rows marked **Staging** are run after the branch is merged to `staging`
  and `deploy-staging` is green. If #1599 is fixed by then, the same rows may also be run under
  `npm run preview`.
- **Push staging secrets once, after the merge.** This writes the two keys to the staging
  Workers:
  - `npm run configure-env -- staging --file secrets/merqify-staging.vars`
  - `npm run configure-env -- afc-staging --file secrets/afc-staging.vars`

  Check the target account line each prints. Never run it against a production file here.
- **Base URLs.** `S=https://aheed-staging.merqify.com`;
  `H=https://merqify-image-hub-staging.merqify-image-hub.workers.dev`.
- **Git Bash.** Add `--retry 3 --retry-all-errors` to curl, and never use `-w '%{http_code}'`
  (error 43). Read `-i` headers instead. Prefix with `MSYS_NO_PATHCONV=1` when an argument starts
  with `/`.
- **Signing in.** A signed-in admin session for curl: `POST $S/api/auth/sign-in/email` as the
  staging Aheed demo admin, taking the password from `DEMO_ACCOUNT_PASSWORD` in
  `secrets/merqify-staging.vars` without echoing it. Save the cookie jar to the scratchpad. Use
  the demo staff account the same way for STAFF rows.
- **Reading a key without printing it.** `K=$(grep '^IMAGE_HUB_API_KEY=' secrets/merqify-staging.vars | cut -d'"' -f2)`.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run lib/config.test.ts --maxWorkers=4` passes, and the file contains test cases for: both unset → `configured: false`; only one set → `configured: false`; both set → `configured: true`; `IMAGE_HUB_URL=http://x` → throws. Read `getImageHubEnv` in `lib/config.ts` and confirm it uses `readEnv` for both keys. |
| R2  | Unit | `grep -n "IMAGE_HUB_URL\|IMAGE_HUB_API_KEY" scripts/configure-env.mjs` shows both inside the `OPTIONAL_WORKER_SECRETS` array (read the array bounds). `grep -nE '^IMAGE_HUB_(URL\|API_KEY)=' secrets/example.vars .env.example` prints 4 lines with empty values. `npm run configure-env -- staging --file secrets/merqify-staging.vars --dry-run` lists both under optional present. |
| R3  | Unit | `ls lib/image-hub/`; read the exports and confirm one function per listed route, each taking config, tenant and actor parameters. `grep -rnE "from \"(next/headers\|next/cache\|@/lib/auth-rbac\|@/lib/tenant\|@/lib/config)\"" lib/image-hub/` prints nothing. |
| R4  | Integration (stubbed) | `npx vitest run lib/image-hub --maxWorkers=4` passes. Read the test file and confirm each R3 function has: a method, path and three-header assertion; a success case; a hub-error case asserting `code` is passed through; plus a search test where `fetch` rejects → `code: "unreachable"`. |
| R5  | Unit | Read `lib/image-hub-service.ts`: the tenant comes from the vendor's `slug`, the actor from `requireVendorRole`'s `user.id`, the config from `getImageHubEnv()`. A unit test with `getImageHubEnv` returning `{ configured: false }` asserts `code: "not_configured"` and zero `fetch` calls. `grep -rnE "from \"@/lib/image-hub/(client\|source)\"" app components features lib \| grep -v "\.test\."`: every line except those in `lib/image-hub-service.ts` is an `import type` (no runtime import calls the hub). The routes' import of `@/lib/image-hub/http` is a pure status mapper and makes no hub call. (Row amended at Build: the original grep also matched type-only imports.) |
| R6  | Unit | `npx vitest run tests/staff-nav-parity.test.ts tests/page-container.test.ts tests/operator-doc-coverage.test.ts --maxWorkers=4` passes. Read the `nav-items.ts` entry for `/staff/image-library` (Catalogue group, `tier: "staff"`, `icon: "image-up"`). Read the page: `requireVendorRole("STAFF", "ADMIN")`, its refusal renders `PanelRefusal`, and the container is `PageContainer width="wide"`. Read the guide section: access line `Staff and store admins`, a review sentence saying store admins only, a category sentence saying store admins only. |
| R7  | **Staging** (or preview with keys removed from both `.env` and `.dev.vars`) | Before running the R2 `configure-env` push, `curl -sS -b <staff jar> $S/staff/image-library` returns 200 with the "not set up" notice text and no `type="file"` input. If the secrets were already pushed, run this row under `npm run preview` with both keys unset in `.env` and `.dev.vars`; this page needs no database read beyond the session. |
| R8  | **Staging** + Unit | Staging has too few assets to page live, so paging is checked by test: (1) open `$S/staff/image-library` signed in as admin; cards show a title, status and licence, and each `img` `src` is `/api/admin/image-library/<uuid>/content`. (2) The `q` search narrows the list (search the R22a title). (3) The status filter "Approved" hides pending cards. (4) "Load more" is driven by `nextCursor`: confirm in a unit or component test with a stubbed page of 24 items plus a cursor (control present) and with `nextCursor: null` (control absent). |
| R9  | **Staging** | `curl -sS -i $S/api/admin/image-library/<id>/content` with no cookie → `401`. With a customer cookie → `403`. With the staff cookie → `200`, a `content-type` matching the asset's, and `cache-control: private, max-age=300`. An unknown uuid → `404`. |
| R10 | Unit | Read both components and confirm they import the conversion function from the same module (`lib/webp-convert.ts`). `grep -n "canvas.toBlob(" components/staff/ProductImageUploader.tsx components/staff/ImageLibrary*.tsx` prints nothing. |
| R11 | Integration (stubbed) + **Staging** | Unit tests for the route handler cover each 400 case (non-WebP, more than 2 MB, bad licence, missing `rightsConfirmed`, empty title), 401, 403, and a hub 409 mapped to 409 with `already in the library`. On staging, R22a covers the success path. |
| R12 | Unit + **Staging** | A unit test calls approve and reject with a stubbed STAFF role: both refuse and `fetch` is never called. Reject with an empty reason is refused. On staging, R22b and R22c. |
| R13 | Unit | Unit tests: assigning a `PENDING_REVIEW` or `REJECTED` asset is refused with no `putObject`; a product of another vendor is refused; assign-to-category as STAFF is refused. |
| R14 | Unit + **Staging** | A unit test with a WebP asset under 2 MB asserts: `putObject` is called with a key matching `buildProductImageKey`'s pattern, which does not contain the hub `storageKey`; and the row write happens after `putObject` (call order). A `putObject` rejection leaves no row write. On staging, R22d (product) and R22g (category). |
| R15 | Unit + **Staging** | A unit test with a JPEG asset asserts the assign call returns "needs conversion" with no `putObject` and no row write. Finalize tests: missing object, non-WebP and over-cap are refused. Unit tests for `requestCategoryImageUpload`: STAFF refused, another vendor's category refused, over-cap refused, and an accepted call returns a key matching `buildCategoryImageKey`'s `categories/<vendorId>/` pattern. On staging, R22f. |
| R16 | Unit + **Staging** | Unit test: a usage is recorded with `kind` and `externalId`, and both ids are stored. A second test makes record-usage fail: the assignment succeeds, `hubUsageId` is null, and the result carries a warning. On staging, R22d's usage check, plus in Neon staging `select "hubAssetId","hubUsageId" from "ProductImage" where "hubAssetId" is not null` shows both set for the assigned image (read-only query with staging `DIRECT_URL`). |
| R17 | Unit | The mapping test covers `UPLOAD`, `AI_GENERATED`, `OPEN_FOOD_FACTS`, `OPENVERSE`, `WIKIMEDIA` and `SUPPLIER` with the stated results. `grep -n "^enum ProductImageSource" -A8 prisma/schema.prisma` shows the same six values as before (`UNKNOWN`, `STAFF_UPLOAD`, `STAFF_CONFIRMED_PHOTO`, `OPEN_FOOD_FACTS`, `AI_GENERATED`, `PLACEHOLDER`). |
| R18 | Unit + **Staging** | Unit tests for `removeProductImage`: with a `hubUsageId`, delete-usage is called; when it fails, the action still returns `ok: true` and logs. Read the category delete path and the assign-as-primary path for the same best-effort call. On staging, R22e. |
| R19 | Unit | `git diff origin/staging --stat -- prisma/migrations` shows one new folder. `grep -nE '^\s*[A-Z]+' <its migration.sql>` shows only `ALTER TABLE` lines and their `ADD COLUMN` clauses (anchored on statement starts, not a bare keyword). The header comment names #895. `grep -nE "hub(Asset\|Usage)Id" prisma/schema.prisma` shows four `String?` fields, two on `ProductImage` and two on `CategoryAsset`. `npx prisma validate` exits 0. |
| R20 | Unit | `grep -rnE "merqify-image-hub-(staging\|production)" app lib components workers \| grep -v "app/(admin)/staff/runbook/docs.ts"` prints nothing (that generated file embeds this spec's text). `grep -rn "IMAGE_HUB_" app lib components workers` names only `IMAGE_HUB_URL` and `IMAGE_HUB_API_KEY`. |
| R21 | System | `npx tsx scripts/verify-image-hub.ts --env-file secrets/merqify-staging.vars` exits 0 and prints `health ok (staging)` and `search ok`, with no `mih_` string in its output: `… 2>&1 \| grep -c mih_` prints `0`. Then with a copy whose key is altered (in the scratchpad) it exits non-zero naming the failing call. Read the script for any non-GET request (there must be none). |
| R22 | **E2E, Staging** | Signed in as the Aheed staging admin unless stated. **a.** Upload a small WebP with a unique title on `/staff/image-library` → the card shows "Pending review". **b.** Signed in as the demo staff account, the same card shows no approve or reject control. **c.** As admin, approve → `curl -sS -H "Authorization: Bearer $K" -H "X-Image-Hub-Tenant: aheed-food-centre" $H/v1/assets/<id>` shows `"status":"APPROVED"`. **d.** Assign it as primary to a test product, then `curl -sS $S/products/<slug>` and find the primary `img` URL: it starts with staging's `CDN_BASE_URL` and contains `products/`. The hub `GET /v1/assets/<id>` lists a usage with `"kind":"PRODUCT"` and that product id. **e.** Remove that image on `/staff/products/<id>` → the hub asset's usages no longer contain it. **f.** `curl -sS -H "Authorization: Bearer $K" -H "X-Image-Hub-Tenant: aheed-food-centre" -F file=@<a .jpg> -F title=JpegCheck -F licence=OWNER_SUPPLIED -F rightsConfirmed=true $H/v1/assets`, approve it on the page, and assign it to a test product → `curl -sSI <the new image URL>` shows `content-type: image/webp`. **g.** Assign an approved asset to a test category → the category's storefront image URL contains `categories/`. **Clean up:** restore the test product's and category's previous images, and remove the test assets' usages. Leave the hub assets themselves (the store has no delete). |
| R23 | Unit | Read each named section. `grep -n "merqify-image-hub" docs/model-handoff.md docs/developer-portal/env-setup.md` shows both. `grep -n "image-hub-gallery\|#1674" specs/roadmap.md` shows rows for 1b and 1c, and a row cites phase 1a / `#1670`. `grep -n "error 43\|status check" docs/developer-portal/local-dev-playbook.md` shows both statements. |
| R24 | Unit | `npm run sdd:audit` output: every `✘` or `·` line names `specs/2026-11-20-image-hub-gallery/` or one of this slice's PRs. `git log --oneline origin/staging..HEAD` shows the audit backfill as its own commit that touches only `specs/roadmap.md` (and `ARTIFACT_INDEX.md` / generated KMS files if regenerated). |
| R25 | Unit | `git diff origin/staging -- CHANGELOG.md` shows an entry naming #1671. |
| R26 | Regression | `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run kms:validate`, `npm run kms:check-generated` exit 0. Run `npx vitest run --maxWorkers=4` alone (no build running) and it passes. `npm run build` exits 0. `npm run kms:assemble:internal && (cd kms/site-internal && npx next build --webpack)`: read the real exit status (`echo $?`), not through a pipe. CI `gates` green on the PR. |
