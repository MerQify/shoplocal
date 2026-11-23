# Priority 1 storefront icons

## What changed and why

Functional Lucide variants give favourites, basket access, unavailable items, timed slots, payment reassurance and compact order results silhouettes that match their purpose. Quantity controls share the 16 px icon token. Existing decorative registry entries and the empty basket illustration remain available.

## Decisions taken during the build

The basket trigger’s accessible name starts with Basket at all widths to match the visible label from the small breakpoint. The drawer retains its existing title and close action. Order results use 24 px outline icons with the existing action, accent and danger tones.

## Deviations from the spec

None.

## Known-shaky areas

Browser validation should cover the floating basket alongside the other fixed controls, focus return, and both vendor themes. CheckoutForm.tsx includes pre-existing checkout changes in the local worktree, so only the secure-payment icon hunk belongs to this issue.
