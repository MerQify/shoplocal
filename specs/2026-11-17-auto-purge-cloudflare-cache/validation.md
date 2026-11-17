# Validation: Automate Cloudflare Cache Purge on Deployment

Fixes #1644. Requirements: `requirements.md`. Plan: `plan.md`.

## Verification Steps
1. Run `npx vitest run tests/purge-cloudflare-cache.test.ts` to assert:
   - 200 OK purge execution.
   - Authentication failure handling without throwing.
   - Zone domain matching.
2. Run `npm run typecheck`, `npm run format:check`, `npm run kms:validate`, `npm run kms:check-generated`, and `npm run sdd:preclear`.
