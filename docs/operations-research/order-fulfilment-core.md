---
id: order-fulfilment-core
title: "Order & Fulfilment Operations"
audience: [staff, store-admin, dev, product, shopper]
type: runbook
status: approved
version: "1.3.0"
updated: "2026-11-20"
visibility: internal
summary: "Canonical rules for order status transitions, fulfilment slots, cancellations, and payment exceptions."
tags: ["orders", "fulfilment", "payments", "cancellation", "staff", "admin"]
related: [store-admin-tabs-guide, staff-tabs-guide, shopping-guide]
---

# Order & Fulfilment Operations

This document establishes the canonical rules and procedures for how orders move through the Merqify platform, how fulfilment slots are allocated, and how cancellations and payment exceptions are handled. 

## 1. Fulfilment Slots & Capacity

Customers choose a delivery or collection time slot at checkout. Slots act as a hard constraint to prevent taking more orders than can be physically fulfilled.

*   **Capacity Limit:** Each slot has a `capacity`. Once filled by paid orders (or orders in their unpaid hold window), the slot is no longer offered.
*   **Hold Window:** Unpaid orders (`PENDING_PAYMENT`) hold their slot temporarily. If payment is not completed within the hold window, the slot is released back to the pool.
*   **Booking Cut-off:** A slot that has already started, or starts within the store's booking cut-off (default 60 minutes, set at `/staff/fulfilment`), is not offered at checkout, and placing an order for it is refused with "That time slot can no longer be booked. Please choose another." The cut-off is measured in the store's time zone (#1441).
*   **Express Collection:** Offered only if Click & Collect is enabled in the Storefront settings and the current time falls within an active express window.
*   **Time Zones:** Slot definitions are bound to the store's configured time zone (default `Europe/London`). Changing this setting does not migrate existing orders or slots; it merely changes how future times are interpreted.

**Known Trap (Collection Slots):** Enabling Click & Collect requires setting up weekly collection slots. If the toggle is on but no slots exist, customers selecting Collection will see "No slots available" and will be blocked from checking out.

---

## 2. Order Status Transitions

An order moves through a strict lifecycle. Staff members drive this progression from the Orders queue, which by default only shows active work (`CONFIRMED`, `READY_FOR_COLLECTION`, `OUT_FOR_DELIVERY`).

### Standard Workflows

Orders follow a forward-only path based on the fulfilment method:

*   **Delivery:** `CONFIRMED` → `OUT_FOR_DELIVERY` → `DELIVERED`
*   **Collection:** `CONFIRMED` → `READY_FOR_COLLECTION` → `COLLECTED`

**Audience Actions:**
*   **Shopper:** Can view the current status of their order in their account. Shoppers cannot transition order states themselves once paid.
*   **Staff / Store Admin:** Uses the Staff Queue to advance an order to its next logical state (e.g., marking a `CONFIRMED` delivery as `OUT_FOR_DELIVERY`). The system strictly prevents moving an order backwards or jumping states.

### Status Notifications
Transitioning an order triggers automatic email notifications to the customer (e.g., "Your order is out for delivery"). 

> **References / Related Artifacts:** 
> - Status definitions and transition constraints: [lib/order-status.ts](../../lib/order-status.ts)
> - Order core checkout foundation: [specs/2026-08-10-p3b-checkout-order-core/plan.md](../../specs/2026-08-10-p3b-checkout-order-core/plan.md)
> - Staff status transitions & delivery emails: [specs/2026-08-11-p4b-order-status-transitions/plan.md](../../specs/2026-08-11-p4b-order-status-transitions/plan.md)

---

## 3. Cancellations vs. Refunds

Cancellation and refunding are **distinct, decoupled actions** in the Merqify platform. 

### Staff Cancellations
Staff and Store Admins can cancel a paid order only if the goods are still physically on the premises (i.e., status is `CONFIRMED` or `READY_FOR_COLLECTION`).

When an order is cancelled:
1. **Stock is returned:** The inventory count is incremented.
2. **Loyalty is reversed:** Earned points are revoked, and spent points are returned to the customer's balance.
3. **Discounts are restored:** The redemption count for the used discount code is returned, preserving the customer's concurrency limit without losing the audit trail.
4. **Capacity is freed:** The fulfilment slot capacity is released.

**What the customer is told** (`#1691`): the admin cancelling chooses who asked (customer,
store unable to fulfil, other) and what to say about the money (refunded in full, not refunded
yet, or a message they write). The cancellation email and the customer's order page use the
matching wording; a blank custom message gives a neutral one. The typed reason stays internal.

### Refunds
**Cancelling an order does not automatically refund the customer.** 
Because order amendment and financial refunds are currently outside the platform's capabilities, the `Payment` record stays as `SUCCEEDED`. To return money to a customer, a Store Admin must process the refund manually through the payment provider's dashboard (e.g., Stripe).

*   *Shoppers:* Must contact the store to request a cancellation/refund. They cannot cancel paid orders via the UI.
*   *Revenue Reporting:* Cancelled paid orders are correctly excluded from the `REVENUE_STATUSES` set, meaning they do not count towards the store's revenue metrics.

> **References / Related Artifacts:**
> - Staff cancellation logic & rules: [specs/2026-09-17-p696-staff-cancel-confirmed-order/plan.md](../../specs/2026-09-17-p696-staff-cancel-confirmed-order/plan.md)
> - Revenue tracking constraints: [lib/order-status.ts](../../lib/order-status.ts)

---

## 4. Payment Exceptions & Recovery

Occasionally, a customer's payment may complete with the provider (e.g., Stripe) but fail to reach the Merqify platform (due to a webhook failure or network timeout). These orders get stuck in `PENDING_PAYMENT` and quietly hold stock.

**Store Admin Recovery Workflow:**
1. Navigate to `/staff/payments`.
2. Review the list of recently refused or missed payment events.
3. Click to **reconcile** the payment. The system will query the payment provider to establish the true state of the charge.
4. If the payment succeeded, the system will **recover** the order, transition it to `CONFIRMED`, and place it into the normal fulfilment queue.

> **References / Related Artifacts:**
> - Payment handling and webhooks: [specs/2026-08-10-p3c-stripe-payments/plan.md](../../specs/2026-08-10-p3c-stripe-payments/plan.md)

## 5. Sanity check: checkout and cancellation (`#1690`, `#1691`, `#1693`)

Run after any deploy that touches checkout, cancellation or order alerts. Steps 1-2 run from a dev
machine. Steps 3-6 need a store admin sign-in, a Stripe **test** card on staging, and the staff
Telegram chat.

**Last run:** 2026-11-20, staging `85945d8` (PR #1698).
- Steps 1-2 passed.
- Steps 3-6 are owed to the owner (test-card payment, Telegram).

1. **Health.** `curl -s https://afc-staging-origin.merqify.com/api/health`. Expect `commit` to be the
   deployed merge, `db.ok: true`, and `reference.reachable: true` with at least one source. The same
   on `aheed-staging.merqify.com`.
2. **Cancel form.** As a store admin, open a `CONFIRMED` order at `/staff/orders/<number>`.
   - Expect **Who asked for this?** (Customer asked / We couldn't fulfil it / Other) and **What
     should we tell the customer?** (Refunded in full / Not refunded yet / Write my own message).
   - Expect the note "this reason is not shown to the customer".
   - Choosing **Write my own message** shows a **Message to the customer** box.
3. **Under-minimum basket.** Put one item under 30p in the basket and check out.
   - Expect "Card payments need a total of at least £0.30." on the checkout page.
   - No new order appears under **Account → Orders**.
4. **Cancelled checkout is closed.** Check out an item of 30p or more, then on Stripe's page use the
   back link and confirm **Cancel**. In the Stripe **test** dashboard (Payments → that Checkout
   session), expect status **Expired**, not Open.
5. **Cancellation email.** Pay a test order with a test card. As an admin, cancel it with **Customer
   asked** + **Refunded in full**.
   - The email opens "Order <number> has been cancelled." and its "What happens next" box reads "As
     you asked, we've cancelled this order. Your payment has been refunded in full…".
   - The customer's `/account/orders/<number>` shows the same text.
   - Neither shows the internal reason, and neither says "sorry".
6. **Telegram.** The cancellation in step 5 posts to the staff Telegram chat as plain text with the
   staff link, and **no preview card** under it.

Any other result: note it on the issue and stop before promoting.
