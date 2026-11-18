---
id: 2026-11-18-deploy-cache-purge-and-skew
title: "Deploy cache purge per host, visible and verified; reload once on deployment skew (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-18
visibility: internal
summary: "Fixes #1644's post-deploy purge (per host, GitHub warning on failure, freshness check) and makes the error boundaries reload once on deployment skew (#1664)."
tags: [ci, deploy, cloudflare, cache, error-boundary, p10]
---

# Deploy cache purge and deployment skew (plan)

Found 2026-11-18. After #1663 deployed, AFC staging kept serving a `/help` cached ~2.6 h earlier. The #1644 purge step had failed on every deploy with `10000: Authentication error`: both deploy tokens (`shoplocal-staging-deploy`, `shoplocal-production-deploy`) lacked Zone → Cache Purge. It only `console.warn`ed, so every run stayed green. The owner added the permission the same day, and a manual per-host purge then succeeded with both tokens.

## Changes

1. `scripts/purge-cloudflare-cache.ts` takes `--env`, reads that env's hosts from `wrangler.toml` (`parseRoutePatterns`, which already excludes SaaS origin hosts) and purges `{ hosts: [...] }` on `merqify.com`. `purge_everything` is gone, so a staging deploy no longer empties production's cache.
2. A failure becomes a `::warning::` annotation under GitHub Actions. The step still exits 0.
3. After purging, each host's `/help` is fetched. A `HIT` whose `Age` predates the purge is a warning.
4. `lib/stale-deployment.ts` plus the four error boundaries: on a deployment-skew error (unrecognised server action, chunk load failure), reload once. A sessionStorage timestamp makes a loop impossible.

## Limits

- Hosts served only through the platform's SaaS fallback, which have no route of their own, are not purged. Today that is none of the trading hosts.
- Server render errors are redacted to a digest in production, so they are never treated as skew. The "Something went wrong" seen on `/staff` on 2026-11-18 was the ROOT boundary's copy, meaning the `(admin)` layout's server render failed. That matches the `Network connection lost.` exceptions in the Worker log and is a separate slice.
- Why AFC staging caches HTML at all, when production does not, is an owner dashboard check (zone Cache Rules).
