# Nightly Image Hub sync for both production cells (build notes)

Issue `#1705`. Worktree `E:\GitRepositories\aheed-wt-1705` (a **real** `node_modules` from
`npm ci`, not a junction, so removing the worktree cannot empty the main checkout's). Branch
`feature/1705-nightly-hub-sync`, cut from `origin/staging` at `82f11869`. Commits:

- `baff32a1`: spec.
- `4ca4a86f`: implementation, tests and docs.
- A KMS regeneration commit.
- The build-notes commit: these notes and the CHANGELOG entry.

Gates run locally in the worktree after the implementation:

- `lint`, `typecheck` and `format:check` all exited 0.
- `npx vitest run --maxWorkers=4` (alone): 503 files and 7254 tests passed, 4 files skipped.
- `kms:check-generated` passes after the regeneration commit.
- `kms:coverage` reports "baseline matches".
- `kms:assemble:internal` plus `next build` in `kms/site-internal` both exited 0.

**Nothing was run against any database or bucket.** Every staging integration row in
`validation.md` (R7–R10) is still owed. Board: `#1705` is **In Progress**.

## What changed and why

- **`.github/workflows/image-hub-sync.yml` (new).**
  - It has a 02:17 UTC schedule plus `workflow_dispatch` with `cell`, `limit` and `dry_run`.
  - The matrix is built with
    `fromJSON(inputs.cell == 'afc' && '["afc"]' || inputs.cell == 'merqify' && '["merqify"]' || '["afc","merqify"]')`.
    On `schedule`, `inputs.cell` is empty, so both cells run.
  - Settings: `fail-fast: false`; a job-level `concurrency` group `image-hub-sync-${{ matrix.cell }}`
    with `cancel-in-progress: false`; `environment: production` (no required reviewers, checked
    2026-11-21).
  - Steps: checkout, Node 22, `npm ci`, `npx prisma generate`, one materialise step per cell, the
    sync step, then an `if: always()` clean-up.
  - The sync step builds a bash array: `--apply` unless `DRY_RUN == "true"`, and `--limit` only
    for a non-empty `LIMIT`. The inputs arrive through `env:`, not interpolated into the script
    text.
- **`scripts/write-hub-sync-env.sh` (new).**
  - Usage: `bash scripts/write-hub-sync-env.sh <out> KEY:SECRET ...`. Each value comes from env
    var `V_<KEY>`.
  - If any value is empty, it prints
    `Missing GitHub 'production' environment secret(s): <SECRET names>` to stderr, exits 1, and
    writes no file.
  - Otherwise it writes `KEY="value"` lines under `umask 077`.
  - Smoke-tested locally with dummy values only: one empty value gave exit 1, named the empty
    secret, and wrote no file; all values set gave exit 0 and a quoted file.
- **`scripts/import-images-to-hub.ts`.**
  - `getObject` now returns a `StorageRead` union (`ok` with bytes | `missing` | `error` with
    detail) via the exported `classifyStorageResponse(status)`. A thrown fetch becomes `error`.
  - `error` logs `[FAILED] <title> storage read <key>: <detail>` and counts as failed. `missing`,
    or a zero-length body, keeps the old `[WARN] Storage object missing…` and counts as skipped.
  - A failed `importAsset` now increments `failedCount`; it already logged `[FAILED]`.
  - A failed `recordUsage` now logs `[FAILED] usage for <title> (asset <id>): <code> - <message>`
    and increments `failedCount`. Before, it was silently ignored.
  - The summary gains `Failed:` in apply mode. `main()` returns `importExitCode({ apply, failed })`.
  - The same changes apply to the category-asset loop.
  - `mapProductImageProvenance` and the dry-run branches are untouched.
- **Tests.** `tests/import-images-to-hub.test.ts` covers the two pure helpers (R11).
  `tests/image-hub-sync-workflow.test.ts` is a text check of the workflow **and the helper script**
  (R12), modelled on `tests/pricing-review-workflow.test.ts`.
- **Docs.**
  - `docs/developer-portal/env-setup.md`: new "Nightly Image Hub sync (`#1705`)" section after
    the image-library sanity check. It holds the secrets table (both cells), the
    separate-from-Worker statement, and the "Sanity check: nightly Image Hub sync" sub-section
    with "Last run: not yet run…".
  - `docs/developer-portal/sdd/operator-runbook.md`: a "Scheduled workflows that touch production
    data" paragraph at the end of the CI section. The runbook had no list of workflows before.

## Decisions taken during the build

- **One materialise step per cell, each guarded by `if: matrix.cell == '<cell>'`.** The rejected
  alternative was a single step using `matrix.cell == 'afc' && secrets.AFC_X || secrets.X`. That
  expression falls back to the Merqify value whenever the AFC secret is **empty**, so an
  unconfigured AFC job would quietly run against Merqify's database with Merqify's key. A test now
  forbids `secrets.AFC_… ||`. The workflow comment avoids writing that pattern literally, because
  the first draft's comment tripped the test.
- **The secret check lives in a helper script, not inline YAML shell.** This lets validation run
  the real logic locally (R5) instead of copying a step body, and keeps the YAML readable. It sits
  in `scripts/` root next to `bootstrap.sh`, because no `scripts/ci/` exists.
- **The error names the GitHub secret, not the file key.** An empty `AFC_S3_BUCKET` reports
  `AFC_S3_BUCKET`, not `S3_BUCKET`, because the secret is what the operator must fix. That is why
  arguments are `KEY:SECRET` pairs.
- **A zero-length 2xx body counts as missing/skipped, not failed.** This matches the old
  behaviour; the spec does not cover the case.
- **Usage-record failures count as failed.** This follows the spec (R8). Note the asset row is
  already updated with `hubAssetId` at that point, so the next night will **not** retry the usage:
  the row no longer matches `hubAssetId: null`. See Known-shaky areas.

## Deviations from the spec

- **R5's "a step checks… names each empty key".** The check runs inside each cell's materialise
  step, by calling `scripts/write-hub-sync-env.sh`, rather than as a separate step. It names the
  empty **GitHub secret**. R5's intent is met: fail before the script runs, name what is missing,
  never print a value. The secret name is the more useful of the two.
- **validation.md R5 says to "copy the step's shell body into `$TMP/check.sh`".** Run
  `scripts/write-hub-sync-env.sh` directly instead, with dummy `V_<KEY>` variables, for example:
  `V_A=x V_B= bash scripts/write-hub-sync-env.sh "$TMP/t.vars" A:SECRET_A B:SECRET_B; echo $?`.
- **R12's test also reads `scripts/write-hub-sync-env.sh`.** That is where `umask 077` and the
  quoted `printf` now live. R4's `umask 077` requirement is met in the helper, not the YAML.

## Known-shaky areas

1. **Hub key tenant scope (highest risk).** Hub API keys carry a tenant list
   (`merqify-image-hub/scripts/keys.ts`: `--tenant` is repeatable, and an empty list means "(all)").
   The script loops over **every** vendor in a cell's database and calls the hub as
   `tenant: vendor.slug`.
   - If the Merqify production key is scoped only to Aheed, every SriMart (or demo-vendor) import
     fails, and the nightly `merqify` job is **red every night**.
   - The same applies to staging. **R9's healthy staging apply on `merqify-staging.vars` is the
     first real test of this.** Check that its rows include more than one vendor, and that none
     fails with an auth or tenant code.
   - If it fails that way, the fix is owner-side: issue the key for all tenants, or add the
     missing slugs. It is not code. Record it as a finding rather than changing the script.
2. **The workflow has never run.** It cannot run until it is on `main`, so these are unproven:
   the `fromJSON` matrix expression, `inputs.*` being empty on `schedule`, the job-level
   `concurrency` group using `matrix.cell`, and `npx tsx` importing the script on a clean runner.
   The post-promotion dry-run dispatch (validation.md, last section, step 3) is the proof.
3. **A failed usage record is not retried.** After a successful import, the row is updated with
   `hubAssetId` before `recordUsage` runs. If `recordUsage` fails, the run goes red, but the next
   night skips that row, because it is no longer `hubAssetId: null`. So the red run shows up once
   and is not repeated. The image is in the hub but not linked as used. Pre-existing behaviour,
   only now made visible. Tracked in `#1706`.
4. **The existing `S3_*` GitHub secrets are assumed to be Merqify's** (`shoplocal-images-production`).
   This is unverified; GitHub never shows values. It is post-promotion step 2.
5. **The first nightly run may be the bulk import.** If the owner has not yet run the one-off
   production import, the first scheduled run processes every image with no `--limit`. It is safe
   (idempotent) but long. `fill-product-images` runs take minutes, so a few hundred images should
   be well within the 6 h job limit, but this is not measured.
