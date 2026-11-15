---
id: 2026-11-15-worker-cpu-limit-plan
title: "Worker CPU limit raised so cold starts stop failing (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1621. cpu_ms = 300 intermittently killed requests on freshly started isolates (503/524 on AFC staging). Raise it to 30000, the Workers Paid standard, for every environment."
tags: [runtime, cloudflare, go-live]
related: [sdd-workflow]
---

# Worker CPU limit raised so cold starts stop failing (plan)

Issue `#1621`, a go-live blocker (`#1344`). On 2026-11-15 the owner hit Cloudflare **524**
timeouts on AFC staging. A probe then saw random **503**s and a 30 s hang. `wrangler tail
afc-store-staging` showed `exceededCpu` "Worker exceeded CPU time limit" on `/checkout` and
`/categories`.

**Goal:** no request fails because of the Worker CPU ceiling, in any environment.

**Cause.** `wrangler.toml` `[limits] cpu_ms = 300`. Its own history (`10 → 50 → 300`, `#415`)
records why it exists:
- React SSR plus Prisma's WASM instantiation on a **cold** isolate uses real CPU time.
- The bundle has grown since then, so 300 ms is now the trip.

Production has the same limit and code.

**Scope:**
- Set `cpu_ms = 30000`, the Workers Paid standard, and extend the history comment.
- Every `[env.*]` inherits `[limits]`; no environment overrides it.
- Correct the one `env-setup.md` sentence that quoted 300.

**Cost:** Workers bills CPU actually used beyond the 30M ms a month included, not the ceiling.

**Deliberately excluded:** reducing cold-start CPU itself (bundle size, lazy Prisma init). That is
worth a later look, but the ceiling must not be the failure mode at launch.

**Open items carried forward:** none.
