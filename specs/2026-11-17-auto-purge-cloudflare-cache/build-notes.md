# Build Notes: Automate Cloudflare Cache Purge on Deployment

Fixes #1644.

## What changed and why
- **Post-Deploy Edge Purge:** Created `scripts/purge-cloudflare-cache.ts` resolving active Cloudflare zones and triggering `POST /zones/{zone_id}/purge_cache` with `{"purge_everything": true}`.
- **CI Workflow Integration:** Added automated cache purge steps to `deploy` and `deploy-afc` in `.github/workflows/deploy-staging.yml` and `.github/workflows/deploy-production.yml` so that edge caches are invalidated as soon as Worker uploads complete.
- **Unit Testing:** Added `tests/purge-cloudflare-cache.test.ts` (3 tests, all passing).

## Decisions taken during the build
- **Graceful Failure Contract:** Script catches API/network errors and logs clear diagnostics without throwing or returning non-zero exit codes. This ensures a Cloudflare API hiccup never fails or blocks an otherwise successful Worker deployment.
- **Dynamic Zone Resolution:** Script queries `/zones` using the existing `CLOUDFLARE_API_TOKEN` and matches against platform and vendor domains (`merqify.com`, `aheedfoodcentre.co.uk`), avoiding hardcoded zone IDs in workflow files.

## Deviations from the spec
None.

## Known-shaky areas
None.
