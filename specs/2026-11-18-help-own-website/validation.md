# Help content names the store's own website (validation)

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run tests/role-journey-maps.test.tsx`: both starting-point cases pass. |
| R2  | Review | `git grep -nE "(aheed\|srimart)\.merqify\.com" -- docs/client-help-centre components/help "app/(storefront)/help" lib/vendor-readiness-service.ts` prints nothing. |
| R3  | Review | `CHANGELOG.md` has a `#1662` entry. |
| R4  | CI | PR checks green. |
| —   | E2E (post-merge) | `staging.aheedfoodcentre.co.uk/help` shows the Aheed staging host and no merqify.com storefront. |
