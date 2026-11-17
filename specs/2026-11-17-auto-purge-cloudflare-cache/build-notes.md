# Build Notes: Automate Cloudflare Cache Purge on Deployment

Fixes #1644.

- **Post-Deploy Edge Purge:** Created `scripts/purge-cloudflare-cache.ts` resolving active Cloudflare zones and triggering `POST /zones/{zone_id}/purge_cache` with `{"purge_everything": true}`.
- **CI Workflow Integration:** Added cache purge steps to `deploy` and `deploy-afc` in `.github/workflows/deploy-staging.yml` and `.github/workflows/deploy-production.yml`.
- **Unit Testing:** Added `tests/purge-cloudflare-cache.test.ts` (3 tests, all green).
- **Graceful Failure Contract:** Script catches API and network failures and logs diagnostics without non-zero exit codes.
