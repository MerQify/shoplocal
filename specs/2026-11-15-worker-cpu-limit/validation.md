# Worker CPU limit raised so cold starts stop failing (validation)

> **Testing Strategy (Lean 80/20 Model)** — a config value, so a static check plus one live load
> check on the environment that showed the failure.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Static | `grep -n "cpu_ms" wrangler.toml` prints `cpu_ms = 30000` once. `grep -n "limits\]" wrangler.toml` prints only the top-level `[limits]`. |
| R2  | CI | `gh run list --workflow deploy-staging.yml` shows **success** for the merge commit. |
| R3  | E2E (live) | With `wrangler tail afc-store-staging --format json` running, send 300 sequential GETs across the listed pages. **Pass:** zero responses with status 503 or 524, and zero tail events with outcome `exceededCpu`. |
| R4  | Static | `git diff --name-only origin/staging...HEAD \| grep -x CHANGELOG.md` prints `CHANGELOG.md`. |
| R5  | Gates | lint, format:check and kms:validate exit 0. PR checks are green. |
