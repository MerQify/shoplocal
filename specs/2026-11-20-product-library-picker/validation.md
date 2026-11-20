# Image Hub — pick from library on the product page (validation)

> **Testing Strategy (Lean 80/20 Model)**
> Unit tests cover the context-query helper and the client's query string. Component tests, with
> the actions mocked, cover the picker's behaviour and the library page's sort switch. The existing
> `image-library-client` test proves the assign sequence survived its move into a shared module.
> Live validation on staging proves the ranking end to end against hub staging, plus one assign
> and remove. No production data is touched.

## Setup for the live rows

- Use `https://aheed-staging.merqify.com`, signed in as `demo-admin@merqify.com` (and
  `demo-staff@merqify.com` for R16). The password is `DEMO_ACCOUNT_PASSWORD` in
  `secrets/merqify-staging.vars`.
- Hub #1677 must be deployed to hub staging first: its R11 passes.
- Browser preferred. Without one, drive the actions with the `Next-Action` header, as described
  in `docs/developer-portal/local-dev-playbook.md`.

## Validation Steps

| Req | How to verify |
|---|---|
| R1 | `npx vitest run lib/image-hub/client.test.ts`: the `sort=relevance` / no-`sort` cases pass. `grep -n "relevance" lib/image-hub/client.ts` shows the `sort` param and the `relevance?: number` field. |
| R2 | `npx vitest run lib/image-hub-service.test.ts` passes, including the `sort` pass-through case. `npx vitest run tests/rbac-gate-matrix.test.ts` passes. |
| R3 | `npx vitest run lib/image-hub/product-context.test.ts`: cases (a)–(d) exist and pass. |
| R4 | Read `app/(admin)/staff/products/[id]/page.tsx`: `imageLibrary` is built from `isImageLibraryConfigured()` and `productContextQuery`, using the already-loaded `brands` and `categories`. `git diff origin/staging -- 'app/(admin)/staff/products/[id]/page.tsx'` adds no `getPrisma`, repository or other new data fetch apart from `isImageLibraryConfigured`. |
| R5 | `tests/product-library-picker.test.tsx`'s "no picker when not configured" case passes. Read `ProductForm.tsx`: the picker is inside the `product &&` Images section, behind `imageLibrary?.configured`. |
| R6 | The R9 test cases for (a), (b), (d), (e) and (f) pass. Read the component: thumbnails use `/api/admin/image-library/${id}/content` (c). |
| R7 | The R9 Assign case passes. Read the component: `aria-pressed` on the selected card, Main is the default, and the success and failure texts match. |
| R8 | `grep -n "convertToWebp\|finalizeProductAssignAction" components/staff/ImageLibraryClient.tsx` → no output. `grep -n "assignLibraryAsset" components/staff/ImageLibraryClient.tsx components/staff/ProductLibraryPicker.tsx` → a hit in each. `npx vitest run tests/image-library-client.test.tsx` passes. |
| R9 | `npx vitest run tests/product-library-picker.test.tsx` passes, with a test for each bullet in R9. |
| R10 | `npx vitest run tests/image-library-client.test.tsx`: the relevance-when-query and no-sort-when-empty cases pass. |
| R11 | `grep -n -i "library" docs/staff-playbook/staff-tabs-guide.md` shows the two sentences. Trace each one to a control: the picker button (R6), and the sort switch (R10). `npx vitest run tests/staff-nav-parity.test.ts` passes. |
| R12 | `git diff origin/staging -- CHANGELOG.md` shows the #1678 entry. |
| R13 | `curl -sS https://aheed-staging.merqify.com/api/health` → `commit` is the merge, `db.ok: true`. `MSYS_NO_PATHCONV=1 curl -sS -i https://aheed-staging.merqify.com/staff/products/x` → `307`, with `location` containing `/login`. |
| R14 | As the admin: upload `R14 exact <product name>` (WebP) and `R14 category <category name>`, then approve both. Open a product in that category that has that exact name, and click **Choose from library**. The first card is the exact-name image, and it is listed before the category image. (By action: `searchLibraryAction({q: <contextQuery>, status:"APPROVED", sort:"relevance"})` returns the exact-name asset first, with a higher `relevance`.) |
| R15 | Choose the exact-name image, keep **Main image**, and click **Assign** on a product with no image. You see `Assigned to …`, and the Images section shows it. The storefront `/products/<slug>` `<img>` src starts with the CDN base and contains `products/`. Remove it on the product page. Then `GET /v1/assets/<id>` (hub staging key, tenant `aheed-food-centre`) shows `usages: []`. Reject both R14 images. |
| R16 | As `demo-staff`: the product page shows **Choose from library**. Assigning and then removing on a no-image product succeeds (same checks as R15). |
| R17 | `npm run lint && npm run typecheck && npm run format:check && npx vitest run --maxWorkers=4 && npm run build` all exit 0. The PR's CI `gates` check is green. |

## Results (2026-11-20)

Validated in the **same session and on the same model that built it (Opus 5.5)**, at the owner's
choice, so this is **not independent**.

- **Pre-flight:** lint, typecheck and format:check pass. `npx vitest run --maxWorkers=4` gives 493
  files and 7144 tests passed (4 files, 8 tests skipped, as on staging). `build` passes, and
  check-client-syntax parses 185 client files.
- **R1–R12 (local): pass.**
  - R1–R3, R6, R7, R9, R10: targeted runs, 8 files and 222 tests, including every `#1678` case,
    `rbac-gate-matrix` and `staff-nav-parity`.
  - R4: the page diff adds only `isImageLibraryConfigured()` and `productContextQuery` over the
    already-loaded `brands` and `categories`. No new data fetch.
  - R5: the picker sits inside the `product &&` Images section, behind `imageLibrary?.configured`.
  - R8: the grep for `convertToWebp` and `finalizeProductAssignAction` in `ImageLibraryClient.tsx`
    finds nothing, and `assignLibraryAsset` appears in both components.
  - R10: amended to cover the server page's first page, which `librarySearchSort` already did.
  - R11: two guide sentences, each traced to the picker button (R6) and the sort switch (R10).
  - R12: CHANGELOG entry present.
- **Callers of the changed search functions:**
  - `searchLibraryAction` is called by `ImageLibraryClient` and `ProductLibraryPicker`.
  - `searchImageLibrary` is called by the library page and that action.
  - `searchAssets` is called by the service and by `scripts/verify-image-hub.ts`, without a sort.
  - `sort` is optional everywhere, so no caller changes behaviour unasked.
- **Rendered output (step 5): unverified locally.** The picker renders in jsdom, and the tests
  query it by role and label. A real browser render needs a database-backed preview, which is
  blocked by the dev database password (#1599). R14–R16 on staging are the rendered check.
- **R13–R16 (live): unverified.** They need hub #1677 on hub staging and this branch on staging.
  They run at Ship.
- **R17's CI half: unverified** until the PR runs.
