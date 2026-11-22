---
id: checkout-recovery-plan
title: "Checkout recovery: staff-controlled abandoned-basket recovery (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-22
visibility: internal
summary: Slices B and C of the checkout-recovery brief (#1732, #1733), re-scoped against #1554. Recovery records with a lifecycle, every unpaid-checkout reason listed, availability, single-use customer-locked and free-delivery incentives, email preview, a secure restore link, authorised resends and recovered-order tracking. No automation.
tags: [checkout, recovery, abandoned-checkout, discounts, email, staff-panel]
related: [architecture, sdd-workflow, unpaid-checkout-cancellations-plan]
---

# Checkout recovery: staff-controlled abandoned-basket recovery (plan)

**Goal:** staff can see every checkout a customer didn't pay for, decide who to approach and with
what incentive, preview and send one personalised recovery email, and see whether it worked —
measured before any automation is considered. Closes #1732 (slice B) and #1733 (slice C) of the
owner's brief; slice A (#1730) supplies the reason each order was cancelled.

## What #1554 already ships (kept, extended — not rebuilt)

`/staff/abandoned-checkouts` (store admins): lists the last 30 days of checkouts whose CANCELLED
note starts "Checkout session expired"; per row the customer, date, items, total and whether a
reminder went out; one **Send reminder** per checkout, optionally offering an existing store code;
consent rules in `lib/abandoned-checkout/eligibility.ts` (signed-in, verified email, current
marketing consent, within 7 days; guests never); claim-first duplicate guard on the unique
`AbandonedCheckoutReminder.orderId`; honest marketing copy in `lib/abandoned-checkout/email.ts`
(PECR, CPRs, DMCC Act); the template is editable (`marketing.abandoned_checkout`, #1564).

**The basket snapshot already exists:** the cancelled order keeps its `OrderItem` rows (product,
name, unit price, quantity) and its customer. No new snapshot table is needed. The schema has no
product variants, so there are none to snapshot.

## Scope (this slice)

1. **Which checkouts are listed.** Replace the note-prefix rule with slice A's
   `cancellationOrigin` in `CHECKOUT_CHANGED`, `CHECKOUT_ABANDONED`, `PAYMENT_EXPIRED`,
   `PAYMENT_FAILED`, `PROVIDER_UNAVAILABLE` (never `STAFF`, never `NULL`). Each row shows the reason
   label from `lib/cancellation-origin.ts`.
2. **Recovery record and lifecycle**, independent of order status. New `CheckoutRecovery`
   (one per abandoned order, created on the first staff action, never on a page view) with
   `status` ∈ `PENDING`, `REVIEWED`, `EMAIL_SENT`, `RECOVERED`, `EXPIRED`, `SUPPRESSED`, and an
   append-only `CheckoutRecoveryEvent` log (reviewed, incentive allocated/removed, email sent,
   email resent, restored, recovered, suppressed, unsuppressed), each with actor and time.
   - A listed checkout with no record reads **Pending**.
   - **Expired is derived, not written by a job** (no automation): an unsent checkout past the
     7-day reminder window, or a sent one whose restore link has expired (14 days) without a
     recovery, shows **Expired**.
   - **Suppressed**: staff mark "Don't contact", with an optional reason; reversible.
   - Existing `AbandonedCheckoutReminder` rows are migrated into `CheckoutRecovery`
     (`EMAIL_SENT`) plus an `EMAIL_SENT` event, then the table is dropped.
3. **Current availability** per line on the page and in the preview: available, short (stock lower
   than the basket quantity, for tracked stock), or unavailable (product inactive or deleted), plus
   the current unit price beside the original.
4. **Incentives (staff-allocated only).** Allocating creates a **single-use, customer-locked**
   `DiscountCode` for that recovery: percentage, fixed amount, or **free delivery** (new
   `DiscountKind.FREE_DELIVERY`, worth the order's delivery fee, delivery orders only), with an
   optional minimum spend and an end date. Customer-locked = new `DiscountCode.restrictedToUserId`;
   the checkout refuses it for anyone else. Staff can still offer an existing store code instead,
   as today. Bundles: the preview lists active bundles whose every item is already in the basket
   (information for staff; no bundle deal is created).
5. **Preview before send.** The page renders exactly the email that would be sent, with the
   recipient, subject, incentive and restore link, without sending.
6. **Recovery email** (extends `buildRecoveryEmail`): each line with its product image, quantity and
   **current** price, unavailable lines marked, the current basket total, the incentive, a locked
   sentence "Your payment wasn't completed, so you haven't been charged.", and a button to the
   restore link. Same consent rules; same honest-copy constraints.
7. **Sending.** Manual only. First send as today; a **second send requires an explicit staff
   confirmation** on the form and is recorded as `EMAIL_RESENT`. Concurrency guard: compare-and-set
   on `CheckoutRecovery.emailCount`, so a double click or two admins send once.
8. **Secure restore link** `/recover/<token>`: 32 random bytes, only the SHA-256 hash stored,
   expires 14 days after the send. The GET page shows the basket with current prices and
   availability and a **Restore my basket** button; nothing changes on GET (prefetchers, #428). The
   POST action re-checks the token, puts available lines into the visitor's current basket through
   the existing `restoredLines` (which reports anything unavailable or short), records `RESTORED`,
   and lands on `/cart` with the existing restore notice plus the incentive code to use. Invalid,
   expired or suppressed tokens get one neutral message.
9. **Recovered tracking.** Inside `confirmPayment`'s transaction (the one place every
   paid path passes through: webhook, return-page check, sweep): if the paying customer has a
   recovery in `EMAIL_SENT` whose email went out within the last 14 days, the newest becomes
   `RECOVERED` with `recoveredOrderId` and a `RECOVERED` event. Idempotent with confirm's own
   compare-and-set: a duplicate or delayed webhook confirms nothing and so recovers nothing.
   The page also shows **Bought later: <order>** for any checkout whose customer paid a later
   order, emailed or not.
10. **Staff order management.** `/staff/orders` keeps hiding unpaid checkouts (slice A); its "Show
    unpaid checkouts" line links to `/staff/abandoned-checkouts`. Docs: store-admin guide section
    for the recovery page; shopper guide's basket-reminder line updated.

## Deliberately excluded

- Scheduled or automatic emails, reminders, automatic discounts, campaigns, A/B tests.
- Guest recovery emails (no consent record; owner decision, 2026-11-22).
- Holding stock for a recovery; stock release is unchanged.
- Creating bundle deals from the recovery page.
- A recovery for a `STAFF` cancellation or an unrecorded (`NULL`) reason.

**Designed for later automation:** status, events, incentive and token live on the recovery, not in
the page, and sending is one service function, so a future scheduler or discount strategy calls the
same code.

## Open items carried forward

- Validation needs signed-in staff and customer sessions; staging is where the owner can do that.
- Migration is hand-authored (#895) and contains one intentional `DROP TABLE` after copying
  `AbandonedCheckoutReminder` rows.
