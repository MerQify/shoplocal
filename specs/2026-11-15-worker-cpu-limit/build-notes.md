# Worker CPU limit raised so cold starts stop failing (build notes)

Written at the end of Build, before the Clear. This is the one artifact the Clear bets on: the
validating context is fresh and has only the spec, the artifact, and this file.

The worktree is `E:\GitRepositories\aheed-wt-1605`, on branch `feature/1621-worker-cpu-limit`, cut
from `origin/staging` at `9def2a1d`. The owner approved the fix ("goahaed please", 2026-11-15)
after the diagnosis.

## What changed and why

- **`wrangler.toml`:** `[limits] cpu_ms` went from `300` to `30000`, with one dated line added to
  the existing history comment. The diagnosis evidence came from
  `wrangler tail afc-store-staging --format json` at 16:22Z, which showed two `exceededCpu` / 503
  events on `/checkout` and `/categories` during a probe.
- **`docs/developer-portal/env-setup.md`:** the Nocaped sentence no longer hard-codes 300.

## Decisions taken during the build

- **30000 rather than a smaller step such as 1000.** The comment's own history shows two earlier
  step-ups (to 50, then 300) that each became the trip again. 30000 is the Paid standard, and
  billing is by CPU used, not by the limit.

## Deviations from the spec

None.

## Known-shaky areas

- **No local dry-run.** `wrangler deploy --dry-run` needs `.open-next/worker.js` from a full build,
  so it was not run locally. R2 (the CI deploy) is the proof that Cloudflare accepts the value.
- **Cold-start CPU itself is unchanged.** First requests on a new isolate stay slower (1–2 s); they
  just no longer fail. Reducing that is out of scope (see `plan.md`).
