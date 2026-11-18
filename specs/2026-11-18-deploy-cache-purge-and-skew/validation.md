# Deploy cache purge and deployment skew (validation)

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit + Review | `tests/purge-cloudflare-cache.test.ts` (hosts per env, `hosts` body). Both workflows show `--env` on all four steps. |
| R2  | Unit | Same file: annotation and refused-purge cases. |
| R3  | Unit | Same file: stale-HIT case. |
| R4  | Unit + Review | `tests/stale-deployment.test.ts`; `git grep reloadIfStaleDeployment app` lists all four boundaries. |
| R5  | Review | `CHANGELOG.md` has a `#1664` entry. |
| R6  | CI | PR checks green. |
| —   | E2E (post-merge) | The staging deploy log shows `✓ Purged …` for `aheed-staging`, `srimart-staging` and `staging.aheedfoodcentre.co.uk`, with no purge warning on the run summary. |
