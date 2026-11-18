# Retry database reads on a dropped connection (build notes)

Worktree: `E:\GitRepositories\aheed-wt-1666` (branch `feature/db-read-retry`), `node_modules` junctioned. `rmdir` the junction before `git worktree remove`.

## Changed

- `lib/db-read-retry.ts` (new), `lib/db.ts` (two HTTP factories).
- `app/error.tsx`, `app/global-error.tsx`, `app/(storefront)/error.tsx`, `app/(admin)/error.tsx`: `retry ?? reset`.
- `tests/db-read-retry.test.ts`, `docs/developer-portal/runtime-pitfalls.md`.

## Found during the build

- Neon's HTTP driver throws `Error connecting to database: …` (with `sourceError`) when fetch fails, and `Server error (HTTP status N)` for a non-JSON non-OK response. A JSON error body is a real Postgres error and carries a SQLSTATE `code`.
- Next 16.3's error boundary passes both `reset` and `retry`. The docs recommend `retry` for transient errors because `reset` does not re-fetch.
- The dev database (`ep-dry-morning`) rejected `.env`'s password on 2026-11-18, so the success-path probe ran read-only on AFC staging.
