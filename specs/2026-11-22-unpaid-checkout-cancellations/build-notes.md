# Unpaid checkout cancellations told apart from real cancellations (build notes)

Built in the worktree `E:\GitRepositories\aheed-1730` on `feature/1730-unpaid-checkout-cancellations`,
branched from `origin/staging` at `3d13ed4c`. The worktree has its **own** `node_modules` (a real
`npm ci`, not a junction to the main checkout): `prisma generate` writes into `node_modules`, and a
junction had briefly put this branch's client into the main checkout other sessions use. That was
reverted by regenerating the main checkout's client from its own schema.

## What changed and why

- **Schema + migration (R1-R3).** `CancellationOrigin` enum and nullable
  `OrderStatusEvent.cancellationOrigin`. `prisma/migrations/20261122120000_cancellation_origin/`
  is hand-authored (#895); its DDL is Prisma's own `migrate diff` output against the staging
  schema, and the backfill is `UPDATE`s on exact note equality (seven notes) plus
  `cancellationReason IS NOT NULL` → `STAFF`. No `LIKE`, no catch-all.
- **Origin threaded through every release (R4, R5).** `releaseOrder(…, note, origin, binding?)` —
  origin is required, so `typecheck` fails on any caller that omits it (it caught a verify script
  and three tests). Callers: `features/checkout/cancel-order.ts` `CHECKOUT_CHANGED`; webhook
  (`app/api/webhooks/stripe/route.ts`) `PAYMENT_EXPIRED` / `PAYMENT_FAILED`; sweep
  (`lib/payment-sweep.ts`, new `RELEASE_ORIGINS` keyed like `RELEASE_NOTES`) expired / unsettled /
  no session; `placeOrder` provider failure `PROVIDER_UNAVAILABLE`; `cancelConfirmedOrder` writes
  `STAFF`. The service wrappers (`lib/orders-service.ts`, `lib/payment-sweep-service.ts`) pass it on.
- **Vocabulary module.** `lib/cancellation-origin.ts`: the string union (mirrors the Prisma enum, no
  Prisma import, same split as `lib/order-status.ts`), staff labels, and the customer status label
  and sentence.
- **"Never paid" (R6).** `UNPAID_CHECKOUT_WHERE` and `isUnpaidCheckout` in
  `lib/repositories/orders.ts`: `CANCELLED` with no `Payment` in `SUCCEEDED`/`REFUNDED`.
  `OrderSummary`, `OrderListItem` and `GuestLookupOrder` gained `neverPaid`; `OrderListItem` and
  `StaffOrderDetail` gained `cancellationOrigin` (the latest CANCELLED event's).
- **Customer (R7-R9).** `listOrdersForUser` adds `NOT: UNPAID_CHECKOUT_WHERE` (the old "deliberately
  not filtered" comment is replaced, citing #1730; the page's matching comment too).
  `OrderStatusBadge` takes `neverPaid` (neutral tone, "Payment not completed"). The account order
  page and the guest lookup render `UnpaidCheckoutNotice` instead of `OrderProgressTracker` for an
  unpaid checkout; the customer timeline relabels its CANCELLED entry. `/checkout/[orderNumber]`
  shows "Payment not completed" + the notice for an unpaid checkout.
- **Staff (R10, R11).** `StaffOrderFilter.includeUnpaid`; `parseStaffOrdersQuery` reads
  `?unpaid=1` (exactly "1"), `staffOrdersHref` carries it. `/staff/orders` gets a "Show unpaid
  checkouts" checkbox in its GET form and an origin label under each cancelled row;
  `/staff/orders/[orderNumber]` shows the label plus "never paid, nothing was charged" / "this order
  was paid".
- **Docs (R13).** Staff tabs guide (new paragraph + label table), shopper guide (Order History).
- **Tests.** `tests/unpaid-checkout.test.ts` (predicate over every payment status, list `where`,
  staff parser/href, labels, badge/notice markup); origin assertions added to the cancel action,
  sweep, webhook and `orders.test.ts` (provider failure, staff, double release). Full suite at
  build end: 512 files passed, 4 skipped; 7317 tests passed (before the new file was added).

## Decisions taken during the build

- **The checkout confirmation page for a PAID order the store cancelled** used to say "Payment
  wasn't completed … Nothing has been charged", which is false for that order. It now reads "Your
  order was cancelled" and shows the tracker with the #1691 wording, which is what R9 requires.
- **Customer timeline**: rather than hiding the CANCELLED entry, it is relabelled "Payment not
  completed", so the page never shows "Cancelled" for an unpaid checkout (R8).
- **Staff list badge stays "Cancelled"** for unpaid checkouts, with the origin label and "· not
  paid" beneath; staff need the true status, customers need the plain wording.
- **Toggle is a checkbox in the existing GET form** (applies with **Apply**), not a separate link:
  no client JS, and the URL stays shareable like the rest of the filter.

## Deviations from the spec

None. (Two origins beyond the brief's four, `PAYMENT_FAILED` and `PROVIDER_UNAVAILABLE`, were
already in the approved spec.)

## Known-shaky areas

- **Not yet run against a real database.** The migration has not been applied to dev and nothing
  has been exercised under `npm run preview` (R2's status check, R3's backfill counts, R8-R11 and
  R14). Applying it needs `prisma migrate deploy` against dev, which auto mode blocks — validation
  must hand the owner the command, after reading `DIRECT_URL`'s host (print the host only).
- **`NOT: { payment: { is: … } }` with no Payment row** is asserted by a JS model of the predicate
  in the unit test, not by Postgres. R14's journey covers a row WITH a FAILED payment; an order with
  no Payment row (provider unreachable) is the case to spot-check under preview.
- **Existing `/staff/abandoned-checkouts` (#1554)** finds abandoned checkouts by the note prefix
  `"Checkout session expired"` (`lib/abandoned-checkout/eligibility.ts`). This slice did not change
  it; moving it to `cancellationOrigin` (and widening it beyond expired sessions) belongs to slice B
  (#1732), which must be re-scoped against what #1554 already ships.
- `kms/site-internal` Next build not yet run after the doc edits (CLAUDE.md asks for it).
