---
id: pre-launch-application-audit
title: Aheed Food Centre pre-launch application audit
audience: [dev]
type: doc
status: approved
version: "1.0.0"
updated: 2026-11-21
visibility: internal
summary: Security, privacy, and release-readiness findings with remediation evidence, staging checks, and the remaining launch gates for Aheed Food Centre.
tags: [launch, security, privacy, testing, operations]
related: [regression-tests, nfr-baseline, model-handoff]
---

# Aheed Food Centre pre-launch application audit

**Decision on 21 November 2026 — Not ready for production launch.** The original audit
reviewed the storefront and staff application at production commit `0e64e6a`. The local
candidate adds the approved security and customer-data fixes. Staging acceptance and
operational recovery are the next gates. Live trading setup comes last and requires separate
production approval.

## Findings and remediation

| Priority | Finding and impact | Fix and closure evidence |
| --- | --- | --- |
| Critical | The original lockfile returned 3 critical and 14 high entries in the npm production audit. Package matches require runtime and feature reachability review. | Updated Next.js to 16.4.6, Better Auth to 1.7.27, proxy-addr to 2.0.8, and affected tooling. The candidate scan returned **0 critical, 5 high, 9 moderate**. Review the four Prisma CLI-chain entries and the application Zod 3 entry before release. |
| Critical | The go-live checklist still requires the verified catalogue, business and legal information, named store admin, and demo-access removal. | Complete this last. Verify stock, prices, photos, allergens, delivery terms, and legal content. Obtain explicit approval for production changes and verify administrator access and demo removal. [Go-live checklist](https://github.com/MerQify/shoplocal/issues/1344) |
| High | Staff discovered-image imports accepted browser-supplied URLs and provenance and buffered responses before applying the byte cap. This exposed the server to unsafe outbound requests and unbounded responses. | The candidate resolves provider results server-side and checks approved HTTPS hosts, redirects, timeout, streamed size, and file signatures. Staff and batch imports share the downloader. Automated coverage passed. Staging needs a valid import and review with each provider. Code is in `lib/image-discovery/download.ts` and `lib/image-hub-service.ts`. |
| High | Checkout persisted contact and delivery details across visits, exposing previous shopper information on shared devices. | The candidate removes both retired keys on storefront mount and retains validation retries in active form state. The consent banner and privacy notice describe the revised behaviour. Automated storage and checkout regression tests passed. Browser acceptance still applies. |
| High | End-to-end, database-backed, and cross-browser acceptance is required for the release candidate. | Use synthetic accounts, test-mode payment and delivery fixtures, and isolated databases. Verify customer and staff journeys, concurrent allocations, and tenant boundaries. |
| High | Recovery targets, alert delivery, and release-candidate capacity remain unverified. | Restore a sanitised backup in isolation, confirm representative records and media references, demonstrate scheduler and reconciliation recovery and alert delivery, and measure release-candidate performance under agreed conditions. |
| Medium | The live CSP allows inline scripts and eval, and public health failures can disclose raw exception text. | Tighten script policy with staged reporting and return stable public health errors with restricted diagnostic logs. |
| Medium | AI usage checks can overshoot under concurrency or lose accounting after a ledger-write failure. Prompt and output boundaries need staging evidence. | Verify AI input minimisation and output review with synthetic scenarios. Add bounded concurrency or reservations if usage warrants it, and reconcile spend with provider totals. |
| Medium | Some retention sweeps are probabilistic, so quiet tenants can retain eligible records longer. | Use bounded scheduled cleanup and verify consent withdrawal, export, erasure, and backup retention against the published notices. |
| Medium | Delayed Stripe success can rely on the payment sweep. | Check enabled methods in Stripe test mode and measure delayed settlement, confirmation, and notification. |
| Low | WebP guard tests can time out on slower runners. | Reuse the source scan or give it an explicit timeout. The checks passed in isolation. |

The audit found no demonstrated SQL injection, XSS, CSRF, or cross-tenant access in the
reviewed paths. That review did not establish exhaustive route coverage or Git-history
credential coverage. The documented browser syntax checks establish parsing compatibility.
Device behaviour and accessibility require browser acceptance.

## Release candidate evidence

- Clean install and both Prisma client generations passed. OpenNext built the Cloudflare
  Worker. TypeScript, changed-file lint and formatting, and Safari/iOS 15.4 client syntax
  checks passed.
- The broad local run had 7,278 passes, eight database-dependent skips, and one icon-generator
  timeout. The timed-out test passed in isolation. A subsequent targeted acceptance run passed
  255 checks across 21 files, covering authorisation, tenant scoping, checkout retention,
  payments and reconciliation, scheduler and alert routing, data rights, and Image Hub imports.
- The deployed staging baseline served commit `2cace57` in both cells. Both health responses
  reported `ok`. Both storefronts returned HTTP 200 on sign-in, registration, password-recovery
  and privacy routes, and redirected requests for empty checkout, staff image library, and account
  data. Chrome rendered Aheed's sign-in page at a mobile viewport. The deployed commit precedes
  the local remediation and cannot certify it. [Staging deployment](https://github.com/MerQify/shoplocal/actions/runs/44909113121)
- A newly created disposable Neon database received the repository's migrations. The concurrent
  slot booking, slot capacity, and express fulfilment tests passed there, as did all five stock
  safeguard tests. The earlier scratch target lacked a column required by the current schema.
- The real-database data-rights harness passed export shape, credential exclusion, tenant
  isolation, scoped erasure, and last-tenant identity deletion. The harness's exact key list
  was updated to include the existing feedback, marketing consent, and saved-list exports.
  Application export behaviour stayed the same.
- Both staging configuration files specify Stripe test-mode keys and webhook secrets.
  Payment journey sign-off still requires test-mode browser settlement and matching
  webhook, order, stock, and notification evidence on the staged release candidate.

## Staging baseline latency

Ten sequential warm samples per route returned HTTP 200 on each cell, plus one warm-up request
per route. Figures are runner-observed time to first byte in milliseconds. The small sample
describes the deployed baseline and does not establish a production load limit.

| Route | Aheed staging warm p95 | SriMart staging warm p95 |
| --- | ---: | ---: |
| Homepage | 38.37 | 206.71 |
| Search for rice | 37.09 | 357.51 |
| Cart | 376.90 | 278.81 |
| Health | 108.63 | 146.58 |

Aheed's homepage warm-up was 2.11 seconds and SriMart's was 3.17 seconds. Repeat with a
production-sized staging catalogue and report warm and cold latency, mobile LCP, API p95,
database timings, and error rates. The project targets are LCP below 2.5 seconds on 4G and
API p95 below 400 milliseconds under the agreed workload.

One Chrome run per staging homepage at a 390 × 844 viewport, with browser cache disabled,
simulated 4G and 4× CPU slowdown, observed LCP of **5.56 seconds for Aheed** and **8.28 seconds
for SriMart**. Aheed was still interactive when sampled, so its final result may be later.
Both observations exceeded the target. Repeat on the release candidate and identify the
largest element and its resource timing before choosing a fix.

## Isolated database restore drill

PostgreSQL 16 ran in a disposable local container. The source used the application's migrated
schema and synthetic fixtures. A custom-format dump took **0.78 seconds**, and restoration to a
separate empty database took **3.06 seconds**. Before and after queries matched 2,000 products,
2,000 stock rows with quantities intact, a representative order joined to its address, and a
product image joined to its storage reference.

The drill established logical database recovery on synthetic data. It did not exercise a
retained backup, a Neon point-in-time restore, R2 object recovery, or the agreed production
recovery time and recovery point objectives. Scheduler, alert routing, and payment reconciliation
passed automated tests. External notification delivery and Stripe settlement remain staging gates.

## Acceptance and operational sign-off

1. Stage the release candidate and verify its deployed commit. Exercise registration and
   recovery, guest and account checkout, discounts, payments and refunds, concurrent stock
   and slots, tracking, notifications, cross-tenant access, data rights, and AI review with
   synthetic data. Cover Safari/iOS, Android Chrome, desktop Firefox, and keyboard navigation.
2. Restore from a sanitised, recoverable backup to an isolated database. Record elapsed time,
   backup age, restored row counts and representative order, stock and media integrity.
   Confirm scheduler and full alert delivery and, where applicable, delayed Stripe settlement.
3. Use the agreed workload and targets for performance sign-off. Track the environment,
   release commit, evidence, and owner for each result.
4. Complete live trading setup after earlier gates and dependency findings are resolved.

Preserve the current storefront design. Use the real catalogue and verified service details
to make delivery eligibility, fees, allergens, and collection options clear. Verify that
returning shoppers see changes in availability, price, and substitutions before payment.

## Follow-up remediation on 21 November 2026

- The production lockfile audit now reports **0 critical, 0 high, and 9 moderate** advisories.
  The application uses Zod 4. Prisma remains on its existing version with scoped overrides
  for the patched deepmerge-ts and Effect dependencies. Both Prisma clients generated and
  the application type check passed.
- The public health endpoint returns fixed failure codes. Production CSP removes eval
  permission while development keeps the HMR allowance. A paid asynchronous Stripe event
  now enters the same bound, idempotent confirmation path as an immediate card payment.
- A daily scheduler job applies the documented retention cutoffs in bounded batches
  even when a store receives no writes. The AI usage ledger retries a failed write once
  with the same event ID, avoiding double counting if the first insert committed.
  Atomic AI budget enforcement and provider reconciliation remain open.
- Repeat staging traces identified the homepage heading as the largest element in both
  stores. The local candidate streams department and feedback reads separately from the
  hero and overlaps delivery-rule resolution with the promotion read. The content and
  layout stay in the same order. The performance gate requires a repeat run after staging.
