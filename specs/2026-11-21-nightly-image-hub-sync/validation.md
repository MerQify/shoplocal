# Nightly Image Hub sync for both production cells (validation)

> **Testing strategy (lean 80/20).** The workflow cannot run from a feature branch: a
> `schedule`/`workflow_dispatch` workflow runs only once it is on `main`. Pre-merge proof therefore
> has three parts:
>
> 1. Unit tests for the two pure helpers.
> 2. A text test of the workflow.
> 3. Real runs of the changed script against **staging** storage and the **staging** hub,
>    including a deliberately broken storage key, which proves the "fails loudly" change end to end.
>
> The workflow's own live run is a post-promotion step and needs the owner's secrets (last
> section). Validation records it as **owed, not failed**.

## Before any DB-touching step

Run from the worktree root. Check that the process environment does not override the env file,
**one variable at a time**:

```bash
for v in DIRECT_URL DATABASE_URL; do if printenv "$v" >/dev/null 2>&1; then echo "$v IS SET"; else echo "$v unset"; fi; done
```

Both must print `unset`. If either is set, stop. The script reads only `--env-file`, but CLAUDE.md
requires this check before live-database work.

**Staging only.** Every script run below uses `secrets/merqify-staging.vars` or
`secrets/afc-staging.vars`. **Never** run a production vars file during validation.

## Validation steps

| Req | Testing area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run tests/image-hub-sync-workflow.test.ts` passes. Also open `.github/workflows/image-hub-sync.yml` and confirm by eye: one cron, `"17 2 * * *"`; `workflow_dispatch` inputs `cell` (choice `all`/`afc`/`merqify`, default `all`), `limit` (string, default `""`), `dry_run` (boolean, default `false`). |
| R2  | Unit + read | Same test. In the file, confirm by eye: `runs-on: ubuntu-latest`, `environment: production`, `fail-fast: false`, a `concurrency` group that includes the matrix cell with `cancel-in-progress: false`, and a matrix expression that yields `["afc","merqify"]` when `inputs.cell` is empty or `all`, `["afc"]` for `afc`, and `["merqify"]` for `merqify`. |
| R3  | Read | The file uses `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22` and `cache: npm`, then `npm ci`, then `npx prisma generate`, all before the script step. |
| R4  | Unit + read | Same test, for the eight `afc` secret names. By eye, compare the env-file block against the R4 table row by row for **both** cells: every value is double-quoted, `umask 077` is present, the file path is `$RUNNER_TEMP/<cell>.vars`, and a clean-up step with `if: always()` removes it. |
| R5  | Unit + local shell | Same test, for the absence of `set -x` and secret echoes. Then exercise the check-step logic locally: copy the step's shell body into `$TMP/check.sh`, export the eight key variables it reads with one left empty (dummy values only, no real secrets), and run `bash $TMP/check.sh; echo "exit=$?"`. Pass: a non-zero exit, output naming exactly the empty key, and none of the dummy values printed. Repeat with all eight set: exit 0. If the step reads values differently (for example through `env:`), reproduce that faithfully and say so in the results. |
| R6  | Read | The script step runs `npx tsx scripts/import-images-to-hub.ts --env-file "$RUNNER_TEMP/<cell>.vars"`. It appends `--apply` unless `inputs.dry_run` is `true`; on `schedule`, `inputs.dry_run` is empty, so apply. It appends `--limit` only for a non-empty `inputs.limit`. Nothing (`continue-on-error`, `|| true`) masks the exit code. |
| R7  | Unit | `npx vitest run tests/import-images-to-hub.test.ts`: the `classifyStorageResponse` cases pass. |
| R7  | Integration (staging) | **Broken key:** `cp secrets/merqify-staging.vars "$TMP/broken.vars"`, then change only `S3_SECRET_KEY` in the copy to `invalid`. Find rows that would be attempted: `npx tsx scripts/import-images-to-hub.ts --env-file secrets/merqify-staging.vars --limit 3` (a dry run) must list at least one product or category row. If it lists none, record R7/R9 integration as **not exercised**, not passed. Then run `npx tsx scripts/import-images-to-hub.ts --env-file "$TMP/broken.vars" --limit 3 --apply; echo "exit=$?"`. Pass: at least one line starts `[FAILED]` and names a storage key; none reads `[WARN] Storage object missing` for those keys; `Failed:` is ≥ 1; `exit=1`. Re-run the same dry run with the real file: the same rows are still listed, so nothing was written. Delete `$TMP/broken.vars` afterwards. |
| R8  | Integration (staging) | **Bad hub key:** copy `secrets/merqify-staging.vars` to `$TMP/badhub.vars` and change only `IMAGE_HUB_API_KEY` to `mih_stg_invalid`. Run with `--limit 1 --apply; echo "exit=$?"`. Pass: a `[FAILED]` line carrying the hub's error code, `Failed: 1`, `exit=1`, and the same row still listed by a later dry run with the real file. Delete `$TMP/badhub.vars`. `recordUsage`'s failure branch is checked by reading the diff: it increments the failure count, logs `[FAILED]` and skips the `hubUsageId` update. |
| R9  | Unit + integration | The `importExitCode` cases pass in `tests/import-images-to-hub.test.ts`. **Healthy apply on staging:** `npx tsx scripts/import-images-to-hub.ts --env-file secrets/merqify-staging.vars --limit 2 --apply; echo "exit=$?"`. Pass: the summary has a `Failed: 0` line and `exit=0`, and each processed row reads `[IMPORTED]`, `[DUPLICATE]` or `[WARN] Storage object missing`. Repeat with `secrets/afc-staging.vars` (that file uses `AFC_DIRECT_URL`): same pass condition. Either run may find zero rows (`Total items evaluated: 0`); record that and the exit code. |
| R10 | Integration (staging) | `npx tsx scripts/import-images-to-hub.ts --env-file secrets/merqify-staging.vars --limit 3; echo "exit=$?"` prints `DRY RUN (no mutations)`, `[DRY-RUN]` rows, and `exit=0`. `git diff origin/staging -- scripts/import-images-to-hub.ts` shows `mapProductImageProvenance` unchanged, and no hub or Prisma call outside an `apply` branch. |
| R11 | Unit | `npx vitest run tests/import-images-to-hub.test.ts` passes and contains every case named in R11. |
| R12 | Unit | `npx vitest run tests/image-hub-sync-workflow.test.ts` passes and asserts every item named in R12. |
| R13 | Read | `grep -n "nightly Image Hub sync" docs/developer-portal/env-setup.md` finds the section and its sanity-check sub-section: numbered steps, expected results, a `Last run:` line, all eight secret names, and the statement that they are separate from Worker secrets. `grep -n "image-hub-sync" docs/developer-portal/sdd/operator-runbook.md` finds the workflow entry with its schedule. `npm run kms:assemble:internal` passes, and a Next build in `kms/site-internal` passes (code-quote any `<placeholder>`). |
| R14 | Read | `git diff origin/staging -- CHANGELOG.md` shows an entry that names `#1705`. |
| R15 | Gates | `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run kms:check-generated` each exit 0. `npx vitest run --maxWorkers=4` runs alone, not beside a build, and exits 0. CI `gates` on the PR is green; CI is ground truth. |

## Post-promotion (owed: needs the owner's GitHub secrets and the workflow on `main`)

Record each step's result in the `#1705` issue and in the env-setup sanity-check `Last run:` line.

1. The owner adds the secrets in `plan.md`'s "Owner prerequisites" table to the GitHub
   `production` environment.
2. Confirm the existing `S3_BUCKET` is Merqify's: `gh secret list --env production` shows names
   only. Run `npx tsx scripts/import-images-to-hub.ts --env-file secrets/merqify-production.vars --limit 1`
   from the owner's machine, which is a dry run. The owner confirms that the GitHub value matches
   the file's `S3_BUCKET` (`shoplocal-images-production`).
3. Dispatch a dry run:
   `gh workflow run image-hub-sync.yml -f cell=all -f dry_run=true -f limit=5`. Both matrix jobs
   pass. Each log shows the expected `Database:` host, `Hub URL:`, and `DRY RUN`.
4. Dispatch a real run with `-f cell=all -f limit=5`. Both jobs pass, and each shows `Failed: 0`.
5. After the next scheduled night, `gh run list --workflow image-hub-sync.yml` shows a `schedule`
   run that succeeded. Note its actual start time against 02:17 UTC.
6. `/staff/image-library` on `www.aheedfoodcentre.co.uk` lists the store's images.
