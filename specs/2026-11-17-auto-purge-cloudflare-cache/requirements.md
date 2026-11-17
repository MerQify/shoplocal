# Requirements: Automate Cloudflare Cache Purge on Deployment

Fixes #1644.

## Problem Description
Following a deployment to Staging or Production, Cloudflare edge nodes continue to serve cached responses for previously rendered pages until their edge TTL expires. Additionally, visitors who refresh without bypassing cache see stale assets and pages.

## Functional Requirements
1. **Automated Edge Cache Purge:**
   - On every successful Worker deploy in `.github/workflows/deploy-staging.yml` and `.github/workflows/deploy-production.yml`, run a cache purge step.
   - Target both platform (`merqify.com`) and dedicated vendor zones (`aheedfoodcentre.co.uk`).
2. **Safe Error Handling:**
   - The cache purge step must never fail or halt an otherwise successful deployment if the API token lacks Zone permissions or Cloudflare encounters temporary downtime.
3. **Comprehensive Unit Testing:**
   - Test suite asserting 200 OK responses, error handling, and zone matching.
