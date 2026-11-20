# Image Hub — pick from library on the product page (requirements / acceptance criteria)

Closes #1678 (part of #1669). Built together with hub #1677 (`sriahead/merqify-image-hub`,
`specs/2026-11-20-ranked-search/`), which adds `sort=relevance` to `GET /v1/assets`.

`/staff/products/<id>` gains a **Choose from library** picker:
- It lists approved Image Hub images ranked by relevance to the product's name, brand and category.
- It assigns the chosen image through #1671's existing assign path.
- `/staff/image-library`'s search also ranks by relevance when its search box has text.

"Staging" means the Merqify cell's staging Worker (`aheed-staging.merqify.com`) after this branch
merges to `staging`. Hub #1677 must already be on hub staging for R14 and R15.

## Hub client

R1. `lib/image-hub/client.ts`:
    - `SearchParams` has `sort?: "newest" | "relevance"`, which `searchAssets` sends as the `sort`
      query parameter only when set.
    - `HubAsset` has `relevance?: number`.
    - `lib/image-hub/client.test.ts` asserts the URL carries `sort=relevance` when given, and no
      `sort` when omitted.
R2. `searchImageLibrary` (in `lib/image-hub-service.ts`) and `searchLibraryAction` (in
    `features/admin/image-library.ts`) accept `sort` and pass it through. Their role gate is
    unchanged (STAFF and ADMIN). `lib/image-hub-service.test.ts` asserts the pass-through.

## Product context

R3. `lib/image-hub/product-context.ts` exports
    `productContextQuery(input: { name: string; brandName?: string | null; categoryName?: string | null }): string`.
    Unit tests in `lib/image-hub/product-context.test.ts` prove:
    - **(a)** It returns `name`, then the brand name, then the category name, joined by single
      spaces, with blank parts left out.
    - **(b)** The brand is left out when the name already contains it, case-insensitive:
      `{name:"Tilda Basmati Rice", brandName:"tilda", categoryName:"Rice"}` →
      `"Tilda Basmati Rice Rice"`.
    - **(c)** Runs of whitespace collapse to one space and the ends are trimmed.
    - **(d)** A result over 200 characters is cut at the last space at or before character 200,
      so no word is split.
R4. `app/(admin)/staff/products/[id]/page.tsx` passes `ProductForm` an
    `imageLibrary: { configured: boolean; contextQuery: string }` prop:
    - `configured` comes from `isImageLibraryConfigured()`.
    - `contextQuery` is `productContextQuery` applied to the product name, the name of the brand
      whose id is `product.brandId` (from the brands list the page already loads), and the name of
      the category whose id is `product.categoryId`.
    - No new database query is added to the page.

## Picker

R5. `components/staff/ProductForm.tsx` renders `<ProductLibraryPicker>` inside the existing Images
    section (edit mode only, beside `ProductImageUploader`) **only when**
    `imageLibrary?.configured` is true. When it is false or absent, no picker markup is rendered.
R6. `components/staff/ProductLibraryPicker.tsx` (a client component) renders a **Choose from
    library** button. Clicking it opens a panel containing:
    - **(a)** A search input whose initial value is `contextQuery`.
    - **(b)** A results grid filled by calling
      `searchLibraryAction({ q, status: "APPROVED", sort: "relevance" })`. It runs once when the
      panel opens, and again on each search submit. Results keep the order the hub returns.
    - **(c)** Thumbnails served from `/api/admin/image-library/<id>/content`, with each image's
      title and its alt text.
    - **(d)** A **Load more** button, present only when `nextCursor` is non-null. It appends the
      next page, passing the same `q`, `status`, `sort` and the cursor.
    - **(e)** When a search returns no items, the text `No approved library images match "<q>".`
      and a **Show all approved images** button. That button searches with `status: "APPROVED"`,
      no `q` and no `sort` (newest first).
    - **(f)** A hub failure (`ok: false`) shows its `message` in a `role="alert"` element.
R7. Selecting an image marks it selected (`aria-pressed="true"`) and shows a Main image /
    Additional image choice (default Main), plus an **Assign** button. **Assign** calls the shared
    module from R8 with the product as the target. Then:
    - On success it shows `Assigned to <product name>.` and closes the panel.
    - On failure it shows the error in `role="alert"`, and the panel stays open.
R8. `components/staff/library-assign.ts` exports `assignLibraryAsset(assetId, target, mode, onProgress)`.
    It holds the sequence currently inline in `ImageLibraryClient.tsx`'s `AssignPanel`:
    1. the assign action
    2. on `needs_conversion`: fetch the content route, `convertToWebp`, request the ticket, PUT
    3. the finalize action
    `AssignPanel` calls it, and no longer contains the sequence. After the change,
    `grep -n "convertToWebp\|finalizeProductAssignAction" components/staff/ImageLibraryClient.tsx`
    finds nothing, and the existing `tests/image-library-client.test.tsx` passes.
R9. `tests/product-library-picker.test.tsx` (with the actions mocked) proves:
    - the input's initial value is `contextQuery`
    - the first search is called with `{ q: contextQuery, status: "APPROVED", sort: "relevance" }`
    - items render in the returned order
    - the empty state and its fallback call (no `q`, no `sort`)
    - Load more appends using the cursor
    - Assign calls `assignLibraryAsset` with `{ kind: "product", id, name }` and the chosen mode
    - `ProductForm` renders no picker when `configured` is false

## Library page

R10. In `components/staff/ImageLibraryClient.tsx`, a search with a non-empty trimmed query sends
     `sort: "relevance"`, and a search with an empty query sends no `sort`. A test in
     `tests/image-library-client.test.tsx` asserts both.

## Docs

R11. `docs/staff-playbook/staff-tabs-guide.md`:
     - **Catalogue — `/staff/products`:** says that a product's page can pick an approved image
       from the library, with the closest matches to the product listed first.
     - **Image library — `/staff/image-library`:** says that searching lists the best matches
       first.
     Each sentence traces to the controls in R6 and R10.
R12. `CHANGELOG.md` `[Unreleased]` has an entry for #1678 (Gate 4).

## Live (staging)

R13. Quick checks: staging `/api/health` serves the merge commit with `db.ok: true`, and
     `/staff/products/<any id>` without a session returns 307 to `/login`.
R14. Live ranking, as the demo store admin on staging, with hub #1677 on hub staging:
     1. Upload and approve two images: one titled with a product's exact name, and one titled with
        only its category name.
     2. On that product's page, **Choose from library** lists the exact-name image first and the
        category image after it.
R15. Assign from the picker: assign the first image as **Main image** on a product that has no
     image.
     - The product page then shows it.
     - The storefront product page's image URL starts with the CDN base and contains `products/`.
     - Removing it on the product page leaves the hub asset's `usages` as `[]`.
     - The test images are rejected or left as the hub's allowed test residue, and the product is
       restored to having no image.
R16. Signed in as the demo staff user (STAFF), the picker is visible and can assign, matching
     #1671's product-assign roles.

## Gates

R17. `npm run lint`, `typecheck`, `format:check`, `npx vitest run --maxWorkers=4` and `build` are
     green. CI `gates` is green on the PR.
