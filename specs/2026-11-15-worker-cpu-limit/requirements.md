# Worker CPU limit raised so cold starts stop failing (requirements / acceptance criteria)

Closes `#1621`. Raise the Worker CPU ceiling from 300 ms to 30000 ms so freshly started isolates
stop returning 503/524. `plan.md` has the cause.

R1. `wrangler.toml` `[limits]` has `cpu_ms = 30000`, and no `[env.*.limits]` section overrides it.

R2. The `deploy-staging` run for the merge commit succeeds, which proves Cloudflare accepted the
    limit for both the Merqify and AFC staging Workers.

R3. **AFC staging, live.** 300 sequential requests across `/`, `/categories`, `/checkout`, `/cart`,
    `/help` and a product page return no 503 and no 524. During them, `wrangler tail
    afc-store-staging` shows no `exceededCpu` event.

R4. `CHANGELOG.md` updated (Gate 4).

R5. `npm run lint`, `npm run format:check` and `npm run kms:validate` exit 0. CI is green.
