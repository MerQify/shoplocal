---
id: 2026-11-18-db-read-retry
title: "Retry database reads on a dropped connection (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-18
visibility: internal
summary: "Retries plain SELECTs that fail on a dropped Neon HTTP connection, never writes, and makes the error boundaries' Try again re-fetch (#1666)."
tags: [neon, prisma, reliability, error-boundary, p10]
---

# Retry database reads on a dropped connection (plan)

The owner approved this 2026-11-18 ("yes goahead") after the #1666 proposal.

**Evidence.**

- The owner's intermittent "Something went wrong" on `/staff` rendered the root boundary's copy, so the `(admin)` layout's reads (`getCurrentVendorProfile`, `requireVendorRole`) failed.
- `wrangler tail afc-store-staging` logged `Error: Network connection lost.` twice.
- `/help` on AFC staging returned 500 about 1 in 3 times in one burst.

## Approach

- `lib/db-read-retry.ts` wraps the `PrismaNeonHttp` factory: its adapter's `queryRaw` goes through `runReadWithRetry`. Doing it at the adapter layer leaves the Prisma client type unchanged, so `ReturnType<typeof getPrisma>`, `authDb` and every repository are untouched.
- **Retryable** means a plain `SELECT` (no row lock) **and** a connection-level error. Prisma sends writes as `… RETURNING` through the same `queryRaw`, so the SQL text is the guard.
- Two retries (100 ms, 300 ms), one log line each.
- `getPrismaWs()` is not wrapped (transactions).
- The four error boundaries' Try again uses `retry()` (Next 16.2+, present in 16.3.0), falling back to `reset()`.

## Not in this slice

- Turning on the warm-up (#1491), which is an owner config action in `/staff/platform/db-warmup`.
- Keeping the staff header on a layout failure: the header needs the vendor profile, which is the read that failed, so the root boundary plus a working Try again is the achievable behaviour.
