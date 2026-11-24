# Validation: Platform-Wide List Optimisation & Cloudflare Metadata Architecture

## Validation Matrix

| Criterion | Target | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Natural Collation** | `Item 2` before `Item 10`, case-insensitive | `tests/list-sorting.test.ts` | **Pass** |
| **Category Tree Hierarchy** | Departments A-Z, subcategories A-Z | `tests/list-sorting.test.ts` | **Pass** |
| **Shopper Brand Visibility** | Only brands with active products in visible categories | `tests/shopper-brand-visibility.test.ts` | **Pass** |
| **Metadata Cache & Fallback** | KV hit returns cached data; miss/corrupt falls back to DB | `tests/cloudflare-metadata.test.ts` | **Pass** |
| **Scheduled Refresh Job** | Invoked on `DAILY_CRON = "0 3 * * *"` with token | `tests/scheduler.test.ts`, `tests/refresh-metadata-job.test.ts` | **Pass** |
| **Script Pre-Build** | Pre-builds all 17 vendor caches | `scripts/refresh-metadata-cache.ts` | **Pass** |
| **Staff Products UI** | Active/Archived filters and Move to Active bulk action | `tests/staff-products-query.test.ts` | **Pass** |
| **Static Types** | Whole-codebase TypeScript check | `npm run typecheck` | **Pass** (0 errors) |
