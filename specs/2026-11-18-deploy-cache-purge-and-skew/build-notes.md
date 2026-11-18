# Deploy cache purge and deployment skew (build notes)

Worktree: `E:\GitRepositories\aheed-wt-purge` (branch `feature/deploy-cache-purge`), `node_modules` junctioned. `rmdir` the junction before `git worktree remove`.

## What changed

- `scripts/purge-cloudflare-cache.ts`: rewritten (`hostsForEnv`, `findZoneId`, `purgeHosts`, `verifyFresh`, `warn`, `purgeEnvironment`). It imports `parseRoutePatterns` from `verify-worker-routes.ts`; that module's `main` is import-guarded.
- `.github/workflows/deploy-{staging,production}.yml`: `--env` on all four purge steps.
- `lib/stale-deployment.ts`, plus `reloadIfStaleDeployment(error)` in `app/error.tsx`, `app/global-error.tsx`, `app/(storefront)/error.tsx` and `app/(admin)/error.tsx`.
- Tests: `tests/purge-cloudflare-cache.test.ts` rewritten; `tests/stale-deployment.test.ts` added.

## Decisions

- The zone is fixed to `merqify.com`: every routed host, including the Cloudflare for SaaS custom hostnames, is purged through it (verified manually 2026-11-18).
- Hosts before purge: staging → `aheed-staging`/`srimart-staging.merqify.com`; production → `aheed`/`srimart.merqify.com`; afc-staging → `staging.aheedfoodcentre.co.uk`; afc-production → `www.aheedfoodcentre.co.uk`.
