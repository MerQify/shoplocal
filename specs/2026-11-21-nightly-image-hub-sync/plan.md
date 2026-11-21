---
id: nightly-image-hub-sync
title: "Nightly Image Hub sync for both production cells (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-21
visibility: internal
summary: A scheduled GitHub Actions job runs the #1674 import script nightly for the AFC and Merqify production cells, so every store image reaches the Merqify Image Hub; the script learns to fail loudly.
tags: [image-hub, github-actions, scheduled-job, images]
related: [import-store-images]
---

# Nightly Image Hub sync for both production cells (plan)

Issue `#1705`, part of `#1669` (Merqify Image Hub). Owner approval 2026-11-21.

## Goal

Every product and category image a production store holds reaches the Image Hub within a day,
whichever code path created it. The staff gallery (`/staff/image-library`) lists only hub assets.
Today it shows nothing a store made outside the library.

## Why a nightly sweep, and why this shape

Twelve code paths write `ProductImage` / `CategoryAsset` rows without a `hubAssetId`. Examples:

- staff upload (`components/staff/ProductImageManager.tsx`, `features/admin/product-image.ts`);
- product-page generation (`app/api/admin/product-images/generate/route.ts`);
- the backfill job (`app/api/admin/jobs/backfill-images/route.ts`);
- the nightly `fill-product-images.yml`;
- the category image pipeline (`lib/category-image-pipeline.ts`, four places);
- `lib/category-assets-service.ts`;
- the bulk scripts.

`scripts/import-images-to-hub.ts` (`#1674`) already selects only rows with `hubAssetId: null`,
skips placeholders, and the hub de-duplicates identical bytes. Running it on a schedule covers
every current path and any future one, with no change to a request path.

- **Owner decision: no on-the-fly sync.** Pushing to the hub at each write site was rejected as
  overkill. It means about eight call sites and a policy for a hub outage in the middle of an
  upload.
- **GitHub Actions, not a Worker cron.** `@opennextjs/cloudflare` emits a Worker with no
  `scheduled` handler. `fill-product-images.yml` records the same constraint.
- **One workflow, two-entry matrix (`afc`, `merqify`).** The two production cells have different
  databases, buckets (`afc-images-production` vs `shoplocal-images-production`), storage keys and
  hub API keys, and share only `IMAGE_HUB_URL`. `fail-fast: false` keeps one cell's failure from
  cancelling the other.
- **Keep the script's `--env-file` interface.** The workflow materialises an env file from GitHub
  `production` environment secrets, as `fill-product-images.yml` does. This keeps the
  "name the target file" safety the scripts rely on (#119, P5a).
- **Schedule: `17 2 * * *` (02:17 UTC).** GitHub delays scheduled runs, and on-the-hour slots are
  the most congested: `fill-product-images.yml`'s `0 3 * * *` actually ran at about 11:00 UTC on
  2026-11-18/19/20. An off-the-hour minute is the cheapest mitigation. The job is idempotent, so a
  late run only delays an image by a few hours and never corrupts anything. Ordering relative to
  `fill-product-images.yml` does not matter: an image that run creates is picked up by the next
  sync.

## The script change: fail loudly

The workflow is only useful if a broken run turns red. Today's script cannot do that:

- It exits 0 even when imports fail.
- `getObject` turns **every** storage error (403 for a bad key, 5xx, a network failure) into
  `null`, counted as "Skipped / missing". That is the invisible-broken-S3-credentials trap
  `CLAUDE.md` describes, reproduced inside the script.
- A failed `recordUsage` is silently ignored.

The slice therefore:

- Distinguishes a **missing** object (HTTP 404). That is a warning: a row pointing at a deleted
  object would otherwise fail every night forever.
- Treats any other storage failure as **failed**.
- Counts hub import failures and usage-record failures as **failed**.
- Prints a `Failed:` line in apply mode, and exits **1** when that count is above zero.

The exit-code rule and the storage classification become small exported pure functions, so they
are unit-testable without a database.

## Scope (this slice)

- `.github/workflows/image-hub-sync.yml` (new).
- `scripts/import-images-to-hub.ts`: storage classification, a failure count, and the exit code.
- `tests/import-images-to-hub.test.ts` (new): the pure helpers.
- `tests/image-hub-sync-workflow.test.ts` (new): a text check of the workflow, following the
  pattern in `tests/pricing-review-workflow.test.ts`.
- Docs:
  - `docs/developer-portal/env-setup.md`: the GitHub secrets this workflow reads, and a post-ship
    sanity check.
  - `docs/developer-portal/sdd/operator-runbook.md`: the workflow list.
- `CHANGELOG.md`.

## Deliberately excluded

- **On-the-fly hub sync at write sites.** Owner decision 2026-11-21.
- **Staging cells.** Staging is not swept. Staging hub data is test data, and a staging sync can
  be run by hand with the same script.
- **#1669 phase 4** (scheduled licensed discovery), **phase 5** (pre-generated WebP sizes), and
  **#1672** (hub follow-ups).
- **The first bulk import.** The owner runs it by hand (`--apply` against
  `secrets/afc-production.vars` and `secrets/merqify-production.vars`). This job handles the
  trickle afterwards. If it lands first, its first run does the bulk import instead, which is safe
  because the script is idempotent.
- **Retrying failed rows within a run.** A failed row keeps `hubAssetId: null` and is retried the
  next night.
- **Notifications beyond a red run.** GitHub's failed-workflow email to the repo owner is the
  signal. No Telegram or issue is created.

## Owner prerequisites (validation needs them; the build does not)

Add these to the GitHub **`production` environment**. That store is separate from Worker secrets;
setting one does not populate the other.

| Secret | Value source |
|---|---|
| `IMAGE_HUB_URL` | `IMAGE_HUB_URL` in `secrets/merqify-production.vars` (the same in the AFC file) |
| `IMAGE_HUB_API_KEY` | `IMAGE_HUB_API_KEY` in `secrets/merqify-production.vars` |
| `AFC_IMAGE_HUB_API_KEY` | `IMAGE_HUB_API_KEY` in `secrets/afc-production.vars` |
| `AFC_S3_ENDPOINT`, `AFC_S3_BUCKET`, `AFC_S3_ACCESS_KEY`, `AFC_S3_SECRET_KEY`, `AFC_S3_REGION` | The `S3_*` keys in `secrets/afc-production.vars` |

The existing `AFC_DIRECT_URL`, `DIRECT_URL` and `S3_*` environment secrets are reused. Validation
confirms that `S3_BUCKET` is `shoplocal-images-production`. The `production` environment has no
required reviewers (checked 2026-11-21), so a scheduled run does not wait for approval.

A `schedule`/`workflow_dispatch` workflow does nothing until it reaches `main`.

## Open items carried forward

- `#1669` stays open for phases 4 and 5.
- If the delay on GitHub's schedule ever matters, a Cloudflare-side trigger would need an OpenNext
  `scheduled` export. That has not been raised.
