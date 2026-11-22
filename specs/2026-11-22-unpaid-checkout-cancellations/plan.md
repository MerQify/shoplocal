---
id: unpaid-checkout-cancellations-plan
title: "Unpaid checkout cancellations told apart from real cancellations (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-22
visibility: internal
summary: Slice A of checkout recovery (#1730). Records why every order was cancelled, hides never-paid checkouts from My orders and the default staff list, and words old unpaid links as "Payment not completed".
tags: [orders, checkout, cancellation, payments, staff-panel]
related: [architecture, sdd-workflow]
---

# Unpaid checkout cancellations told apart from real cancellations (plan)

**Goal:** a shopper who presses back from Stripe, changes their basket or simply walks away no
longer sees a "Cancelled" order in **My orders**, and staff can see why every cancelled order was
cancelled. This is slice A of the owner's checkout-recovery brief (#1730); slices B (#1732, basket
snapshot, restore link, staff recovery section) and C (#1733, incentives and recovery email) build
on the reason recorded here.

## Why it happens

`placeOrder` creates the order as `PENDING_PAYMENT` before Stripe so the stock can be held. Every
way out of that state that is not a payment goes through `releaseOrder`
(`lib/repositories/orders.ts`), which sets `CANCELLED` and writes an `OrderStatusEvent` whose only
record of *why* is a free-text `note`. `listOrdersForUser` is deliberately unfiltered (its comment
argues a shopper would wonder where an attempted order went), so every never-paid checkout shows as
a cancelled order. The owner has reversed that call: an unpaid checkout is not an order the
customer cancelled.

## Scope (this slice)

1. **`CancellationOrigin` enum** on `OrderStatusEvent.cancellationOrigin` (nullable), set on every
   CANCELLED event from now on:

   | Origin | Set by | Note written today |
   |---|---|---|
   | `CHECKOUT_CHANGED` | `features/checkout/cancel-order.ts` ("Change my order" / "Put my items back in the basket") | `Shopper cancelled payment at checkout` |
   | `PAYMENT_EXPIRED` | webhook `checkout.session.expired`; sweep, session expired | `Checkout session expired; stock released.` / `Checkout session expired; released by the scheduled payment sweep.` |
   | `PAYMENT_FAILED` | webhook `checkout.session.async_payment_failed`; sweep, session complete but never settled | `Payment failed; stock released.` / `Payment never settled; released by the scheduled payment sweep.` |
   | `CHECKOUT_ABANDONED` | sweep, no payment session was ever created | `No payment session was ever created; released by the scheduled payment sweep.` |
   | `PROVIDER_UNAVAILABLE` | `placeOrder`, payment provider unreachable | `Payment provider unavailable; order cancelled and stock released.` |
   | `STAFF` | `cancelConfirmedOrder` (staff cancel, #1691) | the staff reason |

   **Deviation from the brief:** the brief named four values. Tracing the code found two more
   never-paid exits — async payment failure and the provider being unreachable at placement —
   which fit none of the four without guessing, so they get their own values.
   `releaseOrder` takes the origin as a required parameter, so a future caller cannot omit it.

2. **Backfill, never guessed.** The migration sets `cancellationOrigin` on existing CANCELLED
   events only where the note is exactly one of the strings above, and `STAFF` where
   `cancellationReason IS NOT NULL`. Every other historical CANCELLED event stays `NULL`
   ("reason not recorded").

3. **"Never paid" is a fact, not a reason.** An order is an *unpaid checkout* when its status is
   `CANCELLED` and it has no `Payment` row with status `SUCCEEDED` or `REFUNDED`. This predicate
   works for historical orders whose origin is unknown, and it can never hide an order the customer
   paid for: `releaseOrder` only acts on `PENDING_PAYMENT`, and `cancelConfirmedOrder` leaves the
   payment row alone. One shared Prisma `where` fragment in `lib/repositories/orders.ts` is the
   single definition, used by every query below.

4. **Customer side.**
   - `listOrdersForUser` excludes unpaid checkouts, so **My orders** and its pagination no longer
     show them. `PENDING_PAYMENT` orders stay visible: the shopper may still be paying.
   - Opening an unpaid checkout directly (account order page, guest lookup, the
     `/checkout/[orderNumber]` confirmation page) shows the status **"Payment not completed"** and
     the sentence **"Payment not completed. You haven't been charged."** in place of "Cancelled".
   - A paid order a staff member cancelled keeps today's "Cancelled" label and #1691 wording.

5. **Staff side.**
   - `/staff/orders` hides unpaid checkouts by default, including when the CANCELLED status filter
     is selected. A "Show unpaid checkouts" toggle (`?unpaid=1`) brings them back.
   - Each cancelled order shows its origin as a label in the list and on
     `/staff/orders/[orderNumber]`: "Changed at checkout", "Payment link expired", "Payment
     failed", "Checkout abandoned", "Payment service unavailable", "Cancelled by store", or
     "Reason not recorded" for `NULL`.
   - Documented in `docs/staff-playbook/staff-tabs-guide.md`; the shopper guide
     (`docs/shopper-help/shopping-guide.md`) says unpaid checkouts don't appear in My orders.

## Deliberately excluded

- **Stock hold and release timing.** Unchanged; `releaseOrder`'s compare-and-set, the binding check
  and its idempotency stay exactly as they are. Only an extra column is written.
- **Basket snapshots, restore links, the recovery section, incentives and emails** — slices B
  (#1732) and C (#1733).
- **Reports and revenue.** They already count paid orders; nothing changes there.
- **Emails.** `releaseOrder` sends none today, and this slice adds none.
- **`PENDING_PAYMENT` presentation.** Still "Awaiting payment".

## Open items carried forward

- Production has never traded (CLAUDE.md), so the backfill mainly affects staging and dev data.
- Migration is hand-authored, not generated (`migrate dev --create-only` refuses on dev, #895).
