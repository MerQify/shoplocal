# Allergen notice stopgap (build notes)

Worktree: `E:\GitRepositories\aheed-wt-1656` (branch `feature/allergen-notice-1656`), with
`node_modules` junctioned to the main checkout — `rmdir` the junction before `git worktree remove`.
`npm run db:generate` here regenerated the main checkout's Prisma client too (shared
`node_modules`); harmless, since the extra field is only selected by this branch's code.

## What changed and why

- Schema + hand-authored migration (one boolean, default false).
- `lib/repositories/vendor.ts` — selected, mapped (`?? false`), and accepted by
  `updateVendorStorefrontConfig`.
- Catalogue-settings form owns the checkbox: it is the form already holding the food-related
  settings (labels, HMC), and every other form omits the field, so saving them leaves it alone.
- `components/product/AllergenNotice.tsx` — server-renderable, no client state; contact values
  validated with the footer's own `isDiallablePhone`/`isEmailAddress`/`telHref`.
- Placement: under Add to cart (product), under the cart contents when the cart has lines, under the
  checkout heading.

## Decisions taken during the build

- Explicit setting rather than inferring from dietary labels (owner's choice): those labels are
  documented as never gating the storefront, and a legal signpost must not vanish because a label
  was switched off.
- No per-vendor data migration to switch it on for Aheed — that would name a tenant in a migration.

## Deviations from the spec

None.

## Known-shaky areas

- Product page and checkout gating are covered by review and the staging check, not a render test
  (both pages have heavy dependency graphs); `/cart` carries the render test.
- After deploy, the owner must tick the setting on both AFC environments; until then nothing shows.
