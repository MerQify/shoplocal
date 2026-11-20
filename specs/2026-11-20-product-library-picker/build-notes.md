# Image Hub — pick from library on the product page (build notes)

**Where it was built:**
- Worktree `E:\GitRepositories\aheed-wt-1671` (a real `node_modules`, no junction), branch
  `feature/1678-product-library-picker`.
- Branched from `origin/staging` at `35b4efbc`, with `origin/docs/1671-post-ship` merged in under
  the carry-forward rule. That branch's #1671 docs, CHANGELOG entry and roadmap row ride this PR.
- Built in the same session as hub #1677 (`merqify-image-hub`, branch
  `feature/1677-ranked-search`).

## What changed and why

- **Hub client and service:**
  - `lib/image-hub/client.ts` gains the `HubSearchSort` type, `SearchParams.sort` and
    `HubAsset.relevance`.
  - `searchImageLibrary` and `searchLibraryAction` pass `sort` through (R1, R2).
- **`lib/image-hub/product-context.ts`:** the `productContextQuery` helper (R3).
- **`lib/image-hub/search-sort.ts`:** `librarySearchSort(q)`, which returns `relevance` for a
  non-empty query and `undefined` otherwise. It is used by:
  - the library page's first page (server side, `app/(admin)/staff/image-library/page.tsx`)
  - its Load more (`ImageLibraryClient`)
  This is R10.
- **`components/staff/library-assign.ts`** (R8): `assignLibraryAsset` and `libraryContentUrl`.
  They were moved out of `ImageLibraryClient.tsx`, whose `AssignPanel` now calls them. The
  `convertAndUpload`, `Target` and `contentUrl` locals are gone from that file.
- **`components/staff/ProductLibraryPicker.tsx`** (R6, R7): the picker itself.
- **Wiring:**
  - `ProductForm` gains an optional `imageLibrary` prop and renders the picker below the
    uploader only when `configured` (R5).
  - The product page builds the prop from `isImageLibraryConfigured()` and its already-loaded
    brands and categories (R4).
- **Tests:**
  - `tests/product-library-picker.test.tsx` (R9, plus the ProductForm gate).
  - `lib/image-hub/product-context.test.ts`.
  - New cases in `client.test.ts`, `image-hub-service.test.ts` and `image-library-client.test.tsx`.
  - Full suite at build: 493 files and 7144 tests passed. `build` is green, as are `lint`,
    `typecheck`, `format:check`, `kms:validate` and `kms:check-generated`.
- **Docs:** two sentences in `docs/staff-playbook/staff-tabs-guide.md` (Catalogue and Image
  library), and a CHANGELOG entry (Gate 4).

## Decisions taken during the build

- **`librarySearchSort` lives in its own module, not in `client.ts`.** It is used by a client
  component. A value import from `client.ts` would pull the hub client's request path into the
  browser bundle, which `ImageLibraryClient`'s header comment forbids.
- **The library page's *first* page also uses relevance.** R10 names only the client's searches,
  but the first page is fetched by the server page. Leaving it newest-first would rank page 1
  differently from pages 2+ and break the keyset cursor: the hub refuses a `newest` cursor with
  `sort=relevance`. So the server page uses the same helper.
- **The picker's status line uses the library page's tokens** (`text-danger`, `text-accent` for
  warn, `text-action` for ok), so the two surfaces look the same.
- **After assigning, the picker closes and keeps its success line visible** beside the
  **Choose from library** button. The assign actions' `revalidatePath` refreshes the Images
  section above.
- **A failed hub search clears the grid**, rather than leaving stale results under the alert.

## Deviations from the spec

- **R10's scope widened slightly, as described above:** the server page's first search uses
  relevance too. This is required for correct paging, not a scope addition.

## Known-shaky areas

- **R14–R16 (live) need hub #1677 on hub staging first.** Without it the picker still works, but
  newest first: the hub strips the unknown `sort`.
- **The browser WebP conversion path** (`needs_conversion`) is exercised only by mocks here. It
  is #1671's code, moved but not changed. In the browser it has still never been seen to work,
  because #1671's R22f used `sharp`. R15 with a non-WebP or large image would be its first real
  browser run.
- **`img` alt text in the picker** is `asset.alt ?? asset.title`, the same as the library page.
  Images without alt text read their title twice to a screen reader (image alt plus caption).
  This is minor and matches the existing page.
