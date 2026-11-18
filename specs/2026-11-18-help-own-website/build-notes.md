# Help content names the store's own website (build notes)

Worktree: `E:\GitRepositories\aheed-wt-1662` (branch `feature/help-own-website`), `node_modules` junctioned to the main checkout. `rmdir` the junction before `git worktree remove`.

## What changed and why

- `components/help/RoleJourneyMaps.tsx`: new optional `storeHost` prop, which overrides the customer starting point. The static text is neutral.
- `app/(storefront)/help/page.tsx`: passes `profile?.canonicalHost`.
- `lib/vendor-readiness-service.ts`: neutral reference value.
- `docs/client-help-centre/*`: Aheed's own website; patch version bumps.
- `tests/role-journey-maps.test.tsx`: two render cases.

## Decisions

- The host comes from vendor data, not the request host. That gives `www.aheedfoodcentre.co.uk` on production even when the page is reached through an origin hostname.
