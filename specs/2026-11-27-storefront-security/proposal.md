# Storefront security controls

Tracking issue [#1769](https://github.com/sriahead/merqify/issues/1769). Gate 1 design approved.

## Authentication

Preserve the current five-attempt rolling-minute limit per vendor and source. Reserve capacity atomically in PostgreSQL and exercise it with parallel requests against an isolated database. Add short-lived account-aware backoff for credential attempts using a tenant-scoped keyed identifier, with the same response for existing and unknown accounts. Verify expiry, tenant isolation and contention behaviour.

## Browser policy

The production script policy permits inline execution. Inventory inline scripts on public, checkout and staff pages. Trial a strict script policy in report-only mode in staging. Check hydration, caches, payment redirects and supported Safari versions. Enforce only after the deployed HTML and its policy agree across cached and dynamic responses.

## Verification before closure

Record the deployed revision and effective edge headers. Verify privileged MFA, customer and tenant isolation, payment event binding and duplicate handling, cookie scope and private caching in staging. Record evidence or file separate fixes for failed checks. These controls require verification before treating the review as closed.
