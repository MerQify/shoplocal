# Validation: Serve Master and Stock Excel Exports via Static Assets

Fixes #1642. Requirements: `requirements.md`. Plan: `plan.md`.

## Verification Steps
1. Run `npx vitest run tests/platform-stock-export-rbac.test.ts` to assert that:
   - 401 on unauthenticated requests.
   - 403 on store admin requests.
   - 200 with CSV on valid CSV export requests.
   - 302 redirect to `/templates/aheed-food-centre-master-stock-export.xlsx` on XLSX requests.
2. Verify static assets return 200 OK from Cloudflare edge:
   - `curl -IL https://staging.aheedfoodcentre.co.uk/templates/aheed-food-centre-master-stock-export.xlsx` -> 200 OK.
   - `curl -IL https://staging.aheedfoodcentre.co.uk/templates/aheed-food-centre-stock-export.xlsx` -> 200 OK.
3. Validate typecheck, lint, formatting, and SDD preclear.
