---
id: product-library-picker-plan
title: "Image Hub — pick from library on the product page (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Adds a Choose from library picker to /staff/products/<id> that lists approved Image Hub images ranked by relevance to the product's name, brand and category, and assigns the chosen one through the existing #1671 assign path."
tags: [image-hub, images, staff, products, p10]
related: [image-hub-gallery-plan, architecture]
---

# Image Hub — pick from library on the product page (plan)

**Goal:** a staff member editing a product can attach a library image without leaving the page.
The images most likely to fit are already at the top, with no typing. Closes #1678 (part of
#1669).

**Built together with the hub slice #1677** (`sriahead/merqify-image-hub`,
`specs/2026-11-20-ranked-search/`). That slice adds `sort=relevance` to the hub's search. The owner
asked for both slices to be done together (2026-11-20).

**Scope (this slice):**
- **Hub client:** `lib/image-hub/client.ts`'s `searchAssets` passes a new `sort` param. `HubAsset`
  gains an optional `relevance`.
- **Product context:** a pure helper, `lib/image-hub/product-context.ts`, builds the product's
  context query. It starts from the product name, then adds:
  - the brand name, unless the name already contains it
  - the category name
  The result is capped at 200 characters on a word boundary, which is the hub's `q` limit.
- **Product page:** `app/(admin)/staff/products/[id]/page.tsx` computes that query from the
  product, brand and category lists it already loads. It passes it to `ProductForm`, along with
  whether the library is configured.
- **Picker component:** a new client component, `components/staff/ProductLibraryPicker.tsx`, sits
  in the product page's Images section:
  - A **Choose from library** button opens a panel.
  - The panel has a search box prefilled with the context query, and a grid of **approved**
    library images in relevance order, with **Load more**.
  - When nothing matches, a **Show all approved images** fallback lists the library newest first.
  - Choosing an image offers **Main image / Additional image**, then **Assign**.
- **Shared assign module:** the assign sequence moves out of `ImageLibraryClient.tsx`'s
  `AssignPanel` into `components/staff/library-assign.ts`, and both components use it. The
  sequence is: assign action, then on `needs_conversion` browser WebP conversion, ticket, PUT, and
  finalize. This is **reuse, not a second copy**. Hub usage recording and release are therefore
  exactly #1671's.
- **Library page:** `/staff/image-library` also switches to `sort=relevance` when its search box
  has text, so both surfaces rank the same way. With an empty box it stays newest first.

**Design choices and why:**
- **Context computed on the server page, not in a new action:** the page already holds the
  product, brands and categories (vendor-scoped). The picker then needs only the existing
  `searchLibraryAction`, extended with `sort`. No new server action, and no new RBAC surface.
- **Approved images only:** only approved images can be assigned (`approvedAsset` refuses the
  rest). Showing pending ones would offer a choice that then fails.
- **Hidden when the library isn't configured:** the product page is a busy editing surface. A
  "not set up" notice belongs on the library page, which already has one.
- **Graceful order of deploys:** an older hub ignores `sort`, so the picker still works, newest
  first, if the store deploys before the hub. The hub ships first anyway.

**Deliberately excluded:**
- A picker on the category page. It would follow the same pattern; file it if wanted.
- Ranking the library page's *product* search in its Assign dialog. That searches the store
  database, not the hub.
- AI generation and external sources (phases 2–3), and importing existing images (#1674).
- Consolidating the other WebP converters (#1675).

**Open items carried forward:** the production order is:
1. #1671 is promoted, with the hub keys set on the production store Workers.
2. Hub #1677 is promoted to hub production.
3. This slice is promoted.

This slice is still safe if step 2 lags, because an older hub ignores `sort`.
