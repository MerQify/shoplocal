# Nightly Image Hub sync for both production cells (requirements / acceptance criteria)

Closes `#1705` (part of `#1669`). A new scheduled GitHub Actions workflow runs
`scripts/import-images-to-hub.ts` nightly against the AFC and Merqify production cells, so images
created by any code path reach the Merqify Image Hub. The script is changed so a broken run exits
non-zero. On-the-fly sync is out of scope (owner decision 2026-11-21). The reasoning is in
`plan.md`.

Terms used below:

- **"The workflow"** is `.github/workflows/image-hub-sync.yml`.
- **"The script"** is `scripts/import-images-to-hub.ts`.
- **A cell** is `afc` or `merqify`.

## Workflow

R1. The workflow exists. It triggers on `schedule` with exactly one cron entry, `"17 2 * * *"`. It
    also triggers on `workflow_dispatch` with three inputs:
    - `cell`: type `choice`, options `all`, `afc`, `merqify`, default `all`;
    - `limit`: type `string`, not required, default `""`;
    - `dry_run`: type `boolean`, default `false`.

R2. Its single job runs on `ubuntu-latest` with `environment: production`. It uses a matrix over
    cells with `fail-fast: false`, and declares a `concurrency` group whose name contains the cell
    and `cancel-in-progress: false`.
    - A scheduled run, or a dispatch with `cell: all`, runs both cells.
    - A dispatch with `cell: afc` runs only `afc`; with `cell: merqify`, only `merqify`.

R3. It checks out the repo with `actions/checkout@v4`, sets up Node 22 with `actions/setup-node@v4`
    (npm cache), and runs `npm ci` then `npx prisma generate` before the script.

R4. For each cell it writes an env file at `$RUNNER_TEMP/<cell>.vars` under `umask 077`, with every
    value double-quoted. The mapping is exactly:

    | Key written | `afc` source secret | `merqify` source secret |
    |---|---|---|
    | `AFC_DIRECT_URL` (afc) / `DIRECT_URL` (merqify) | `AFC_DIRECT_URL` | `DIRECT_URL` |
    | `S3_ENDPOINT` | `AFC_S3_ENDPOINT` | `S3_ENDPOINT` |
    | `S3_BUCKET` | `AFC_S3_BUCKET` | `S3_BUCKET` |
    | `S3_ACCESS_KEY` | `AFC_S3_ACCESS_KEY` | `S3_ACCESS_KEY` |
    | `S3_SECRET_KEY` | `AFC_S3_SECRET_KEY` | `S3_SECRET_KEY` |
    | `S3_REGION` | `AFC_S3_REGION` | `S3_REGION` |
    | `IMAGE_HUB_URL` | `IMAGE_HUB_URL` | `IMAGE_HUB_URL` |
    | `IMAGE_HUB_API_KEY` | `AFC_IMAGE_HUB_API_KEY` | `IMAGE_HUB_API_KEY` |

    A step with `if: always()` deletes that file.

R5. Before the script runs, a step checks that every key in R4 is non-empty for the cell.
    - If any key is empty, the step fails. Its output names each empty key and contains no secret
      value, and the script does not run.
    - The workflow contains no `set -x`, and no `echo`/`printf` of a `${{ secrets.* }}` expression.

R6. The script is invoked as `npx tsx scripts/import-images-to-hub.ts --env-file
    "$RUNNER_TEMP/<cell>.vars"`, with two conditional flags:
    - `--apply` is added unless `dry_run` is `true`. A scheduled run always applies.
    - `--limit <n>` is added only when the `limit` input is non-empty.
    - The job's result is the script's exit code.

## Script

R7. The script exports a pure function, `classifyStorageResponse(status: number)`. It returns:
    - `"ok"` for 200–299;
    - `"missing"` for 404;
    - `"error"` for every other status.

    The storage read uses it as follows:
    - A `"missing"` object logs `[WARN] Storage object missing` and counts as skipped.
    - An `"error"` status, or a thrown `fetch` (network failure), logs a line starting `[FAILED]`
      that contains the storage key, and counts as failed.

    This applies to product images and category assets alike.

R8. In apply mode, each of the following logs a line starting `[FAILED]` and counts as failed:
    - an `importAsset` result with `ok: false`;
    - a `recordUsage` result with `ok: false`.

    A failed row is not updated: `hubAssetId` stays `null` after a failed import, and `hubUsageId`
    stays `null` after a failed usage record.

R9. The script exports a pure function, `importExitCode({ apply, failed })`. It returns 1 when
    `apply` is true and `failed > 0`, and 0 otherwise.
    - In apply mode the summary block prints `Failed:` followed by the failure count, next to the
      existing `Newly imported`, `Duplicate matches` and `Skipped / missing` lines.
    - `main()` returns `importExitCode(...)`, and that becomes the process exit code.

R10. Without `--apply` the script makes no hub call and no database write. That is today's
     behaviour, unchanged. Its mapping (`mapProductImageProvenance`) is unchanged.

## Tests

R11. `tests/import-images-to-hub.test.ts` exists and passes. It covers:
     - `classifyStorageResponse` for 200, 204, 404, 403, 500 and 0;
     - `importExitCode` for all four combinations of `apply` (true/false) and `failed` (0/>0).

R12. `tests/image-hub-sync-workflow.test.ts` exists and passes. It reads the workflow as text and
     asserts:
     - the R1 cron and inputs;
     - `environment: production` and `fail-fast: false`;
     - all eight `afc` source-secret names from R4;
     - the `if: always()` clean-up;
     - the absence of `set -x`, and of `echo`/`printf` followed by `${{ secrets.` on the same line.

## Docs and gates

R13. `docs/developer-portal/env-setup.md` gains a section with:
     - the GitHub `production` environment secrets this workflow reads (the R4 table);
     - a statement that they are separate from Worker secrets;
     - a "Sanity check: nightly Image Hub sync" sub-section with numbered steps, expected
       results, and a `Last run:` line.

     `docs/developer-portal/sdd/operator-runbook.md` lists the workflow with its schedule and
     purpose.

R14. `CHANGELOG.md` has an entry for `#1705` (Gate 4).

R15. `npm run lint`, `npm run typecheck`, `npm run format:check` and
     `npx vitest run --maxWorkers=4` all exit 0. `npm run kms:check-generated` exits 0.
