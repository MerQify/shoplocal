# Halal claim wording (build notes)

Worktree: `E:\GitRepositories\aheed-wt-halal` (branch `fix/halal-claim-wording`), `node_modules`
junctioned to the main checkout — `rmdir` the junction before `git worktree remove`.

## What changed and why

- `app/(landing)/page.tsx` — pill wrapped in the vendor's Halal + HMC settings; "100%" dropped.
- `app/(storefront)/products/[slug]/page.tsx` — the halal reassurance row branches on
  `isHmcCertified`.
- `tests/halal-claims.test.tsx` — renders the homepage for a vendor with neither, Halal only, and
  both settings.

## Decisions taken during the build

- Gated on the existing label settings rather than waiting for the shop-level certificate setting:
  it stops the false claim on SriMart today without removing Aheed's pill before the owner has
  confirmed certification.

## Deviations from the spec

None.

## Known-shaky areas

- The product-page wording is covered by review and the staging check, not a render test.
