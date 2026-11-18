# Deploy cache purge and deployment skew (requirements / acceptance criteria)

Closes `#1664`. See `plan.md`.

R1. Each deploy purge step passes its own env (`staging`, `afc-staging`, `production`, `afc-production`). The script purges exactly that env's routed hosts, by hostname, and never sends `purge_everything`.
R2. A zone-lookup or purge failure prints a GitHub `::warning::` annotation under Actions and exits 0.
R3. After a successful purge, a host whose `/help` is still a `HIT` older than the purge produces a warning. `MISS`, `EXPIRED`, `DYNAMIC`, a fresh `HIT`, or an unreachable host do not.
R4. All four error boundaries reload the page once for a deployment-skew error. They do not reload again within 30 s, do not reload when sessionStorage throws, and never reload for any other error.
R5. `CHANGELOG.md` updated (Gate 4).
R6. `lint`, `typecheck`, `test`, `format:check` green.
