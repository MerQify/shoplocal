---
id: 2026-11-17-auto-purge-cloudflare-cache-plan
title: "Automate Cloudflare Cache Purge on Deployment (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-17
visibility: internal
summary: "Automate purging Cloudflare edge cache post-deploy in staging and production GitHub Actions workflows to guarantee immediate freshness upon visitor refresh."
tags: [ci, deploy, cloudflare, cache-purge]
related: [2026-11-17-fix-master-excel-export-download-plan]
---

# Automate Cloudflare Cache Purge on Deployment (plan)

Fixes #1644. Requirements: `requirements.md`.

## Changes

1. **`scripts/purge-cloudflare-cache.ts`:**
   - Author standalone script to query Cloudflare zones via API (`CLOUDFLARE_API_TOKEN`).
   - Match zones (`merqify.com`, `aheedfoodcentre.co.uk`) and execute `POST /zones/{zone_id}/purge_cache` with `{"purge_everything": true}`.
   - Gracefully handle missing token or lack of Zone Purge permissions without failing deployment.

2. **`.github/workflows/deploy-staging.yml` & `.github/workflows/deploy-production.yml`:**
   - Add post-deploy cache purge step to `deploy` (platform) and `deploy-afc` (dedicated cell) jobs.

3. **`tests/purge-cloudflare-cache.test.ts`:**
   - Unit test coverage for zone listing, successful purge, error degradation, and missing token handling.
