# Halal claim wording (validation)

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run tests/halal-claims.test.tsx` — "absent" cases pass. |
| R2  | Unit | Same file — "both on" case passes. |
| R3  | Review + E2E | Read the product-page branch; on staging, a halal product without HMC shows "Halal". |
| R4  | Review | `git grep -n "100% Certified HMC Halal\|100% Halal Verified" -- app` prints nothing outside comments. |
| R5  | Review | `CHANGELOG.md` has a `#1658` entry. |
| R6  | CI | PR checks green. |
| —   | E2E (post-merge) | `srimart-staging.merqify.com/` no longer contains "HMC". |
