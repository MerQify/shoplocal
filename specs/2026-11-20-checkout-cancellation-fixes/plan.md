---
id: checkout-cancellation-fixes-plan
title: "Checkout and cancellation fixes from the live-payments go-live (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Refuses baskets under the provider's minimum charge, logs Stripe's real error, expires a cancelled order's Checkout Session, lets staff say why and whether they refunded when cancelling (including a custom message), and turns off Telegram link previews."
tags: [checkout, payments, stripe, orders, email, telegram, p10]
related: [db-read-retry-plan]
---

# Checkout and cancellation fixes from the live-payments go-live (plan)

**Issues:** #1690 (checkout minimum, logging, open session), #1691 (cancellation email), #1693
(Telegram link preview).

**Goal:** fix everything the owner's first live-mode test orders on AFC production (2026-11-20,
#113) showed to be wrong, apart from the intermittent 500 (#1689, parked).

## What the go-live showed

1. **Baskets under 30p fail with a misleading error.** A £0.29 basket returned "We couldn't reach our
   payment provider" three times. Stripe's minimum charge for GBP is £0.30, so Checkout Session
   creation was refused. Each attempt still created an order and then cancelled it.
2. **Stripe's error is invisible.** `placeOrder`'s `catch` cancels the order and throws
   `PAYMENT_PROVIDER_FAILED` without logging the `PaymentProviderError` message, which carries
   Stripe's status and body. Nothing in `wrangler tail` or `ErrorEvent` said why.
3. **A cancelled order's Stripe page stays payable.** When a shopper returns from Stripe and cancels
   (`features/checkout/cancel-order.ts`), the order is released but its Checkout Session stays
   `open`. Order `AHE-20261120-QKYFYM` was cancelled while its live session was still `open` /
   `unpaid`.
4. **The cancellation email is always the same.** `CANCELLED_NEXT_STEP`
   (`lib/order-notifications/next-step.ts`) always says the store had to cancel, and that no payment
   has been returned. The owner cancelled a test order at the customer's request, after refunding it
   in Stripe, and the email said the opposite on both counts.
5. **Telegram alerts carry a large preview card** for the staff link. The card says "Sign in",
   because Telegram's fetcher is not signed in, and shows the logo.

## Scope (this slice)

- **Provider minimum** (#1690). `PaymentService` gains `minimumAmount(currency)`.
  - Stripe returns its published minimum from a small table (`gbp` 30, `eur` 50, `usd` 50, in minor
    units), and `null` for any other currency. The stub returns `null`.
  - `placeOrder` refuses an order whose total is below a non-null minimum, with a new
    `CheckoutError` code. It runs before any `Order` row is committed, so no stock moves and no
    cancelled order is left behind. The shopper sees one plain sentence naming the minimum.
- **Provider error logging** (#1690). When `createPayment` throws, the error's message (Stripe's
  status and body, which hold no secret) goes to `console.error` and is persisted as an `ErrorEvent`.
  The shopper-facing message and the compensation (release, restore cart) are unchanged.
- **Expire on shopper cancel** (#1690). `PaymentService` gains `expireSession(sessionId)`.
  - Stripe calls `POST /v1/checkout/sessions/{id}/expire`. The stub does nothing.
  - `cancelOrder` calls it after its own successful `cancelUnpaid`, when the order has a stored
    session id.
  - It is best-effort: a failure is logged and never blocks the cancel or the redirect. Stripe also
    expires the session on its own at `expires_at`.
  - The live restricted key already has Checkout Sessions: Write.
- **Cancellation choices** (#1691). The staff cancel form on `/staff/orders/[orderNumber]` keeps
  its internal reason (never shown to the customer) and gains:
  - **Who asked** (required radio): customer asked, we couldn't fulfil it, other.
  - **What to tell the customer** (required radio): refunded in full, not refunded yet, or write
    my own message. The last reveals a text box of up to 1,000 characters.
  - All three are stored on the CANCELLED `OrderStatusEvent` in new nullable columns. That needs a
    hand-authored migration (CLAUDE.md: `migrate dev --create-only` refuses on dev).
- **Cancellation wording** (#1691). The CANCELLED "what happens next" text is chosen from the
  stored choices, in one pure function shared by the email and the order progress tracker:
  - five fixed wordings, plus the custom text;
  - a neutral wording when the custom box is left empty;
  - today's wording, unchanged, for any cancellation with no choices recorded (older rows, system
    cancellations).

  Custom text is rendered as escaped plain text, so markup and links in it are inert.
- **Telegram** (#1693). `sendMessage` is sent with `link_preview_options: { is_disabled: true }`.

## Deliberately excluded

- **Refunds from the store.** "Refunded in full" is the staff member's own statement, not checked
  against Stripe. A refund capability is still undecided (ADR-005 territory, #137/#151).
- **Shopper-initiated and system cancellations.** These are `cancelUnpaid`, the payment sweep and
  `failPayment`. Their emails, if any, are unchanged; only staff cancellation of a paid order gets
  the choices.
- **A minimum check in the cart or checkout UI before submit.** The refusal comes from `placeOrder`
  only. A vendor's own minimum order value is a separate, existing feature (`BELOW_MINIMUM`).
- **#1689**, the intermittent 500 on AFC production, parked by the owner.
- **The webhook's handling of a `checkout.session.completed` that arrives for an already-cancelled
  order.** Expiring the session closes the gap this slice saw; the existing binding-refusal path
  (#454) is unchanged.

## Open items carried forward

- None new. #1660 (`async_payment_succeeded`) and #1689 stay open as they were.
