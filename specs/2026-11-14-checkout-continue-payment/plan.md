---
id: 2026-11-14-checkout-continue-payment-plan
title: "Checkout: Continue to payment after leaving Stripe (plan)"
audience: [dev]
type: spec
status: approved
version: "1.1.0"
updated: 2026-11-14
visibility: internal
summary: "Replaces the 'Cancel this order?' page Stripe's cancel_url lands on with 'Your payment wasn't finished': reopen the order's own Stripe session, or cancel and restore the basket, with Stripe's verified status deciding. Cancel checks for a payment first and restores once. No schema change."
tags: [checkout, payments, stripe, storefront]
related: [2026-11-13-abandoned-checkouts-plan]
---

# Checkout: Continue to payment after leaving Stripe (plan)

Closes **#1589**. Found on AFC staging on 2026-11-14 (orders `AHE-20261114-FY66D8` and
`AHE-20261114-WMGED3`). The issue body is the approved Gate 1 proposal. The owner approved the
scope on 2026-11-14 and added seven safeguards (verified Stripe status over order age, paid
over a stale local status, retryable provider errors, payment in another tab, repeated clicks,
basket-restore fidelity, no regression). Version 1.1.0 of this plan carries them.

**Goal:** a shopper who leaves the Stripe payment page without paying can always finish paying
for the same order, or get their items back in the basket. They never land on an empty basket
with an unpaid order they cannot reach. A paid order is never cancelled by this flow.

## What is wrong today (verified 2026-11-14 against `staging` at `8855790a`)

- `placeOrder` empties the cart when it creates the order (`lib/repositories/orders.ts`, cart
  `deleteMany` inside the order transaction).
- Stripe's `cancel_url` is `/checkout/<order>/cancel?t=<token>` (`lib/payments.ts`,
  `createStripePaymentService`). That page
  (`app/(storefront)/checkout/[orderNumber]/cancel/page.tsx`) asks "Cancel this order?". It offers
  a red **Cancel this order** button, which posts `cancelOrder` (`features/checkout/cancel-order.ts`),
  and a link **No — keep it and go to my basket** to `/cart`.
- Following that link leaves the order `PENDING_PAYMENT`, and the basket is empty. The member page
  `/account/orders/<order>` shows "Awaiting payment" with no control to pay. The Stripe session can
  still be paid until its `expires_at`, but no page links to it. The payment sweep later releases
  the order.
- **Two latent defects in `cancelOrder` that this slice fixes, because the owner's safeguards
  require it:**
  - It cancels without asking Stripe. A shopper who paid in another tab, whose webhook has not
    arrived yet, can cancel a paid order.
  - It restores the basket whenever the order it READ was `PENDING_PAYMENT`, and ignores the boolean
    `getOrderCancelService().cancelUnpaid` returns. `releaseOrder` is a compare-and-set, so a double
    submit cancels once but adds the items to the basket twice.
- `RetrievedSession` (`lib/payments.ts`) has no `url` field, so nothing can reopen a session.
- The order's own Stripe session id is already stored (`Payment.providerReference`), read by
  `findOrderPaymentState` and used by `lib/payment-check-service.ts`. `checkOrderPayment`
  (`lib/payment-check.ts`) confirms an order when Stripe says `paid`, and never cancels anything.

## Two clocks, kept apart

- **The business rule:** `CHECKOUT_SESSION_TTL_MS` (35 minutes from the order's `createdAt`).
  `placeOrder` uses it to set the Stripe session's `expires_at`. It is a *prediction* of when the
  session ends.
- **The truth:** Stripe's own session `status` (`open`, `complete`, `expired`) and `payment_status`.
  Only these decide whether a shopper can still pay, or has paid.

This slice uses the business rule for **wording only**. When the order is older than the TTL, the
page says the link "may have expired", but it still offers **Continue to payment**. The page shows
the definite "has expired" state only after the action has asked Stripe and Stripe answered
`expired`. A clock skew or a delayed Stripe expiry can therefore never hide a payable session. A
stale "may have expired" hint costs the shopper at most one click, which returns the definite answer.

## Scope (this slice)

**1. `RetrievedSession` gains `url: string | null`.** The Stripe adapter maps Stripe's `url`
field (`session.url ?? null`). The stub returns `url: null`, so with no Stripe key there is never a
session to reopen. `lib/payments.ts` also exports
`isPastCheckoutSessionTtl(createdAt: Date, now: Date): boolean`, true when
`now >= createdAt + CHECKOUT_SESSION_TTL_MS`. Its name says "past the TTL", not "expired", on
purpose.

**2. A pure decision module, `lib/resume-payment.ts`.** It has the same shape as
`lib/payment-check.ts`: type-only imports, plain-object deps, no database, no Stripe.
`resumeOrderPayment(deps, order)` has one dep, `retrieveSession`, and resolves, first match wins:

| Outcome | When |
|---|---|
| `not-pending` | `status !== "PENDING_PAYMENT"` (Stripe not called) |
| `no-session` | `providerReference === null` (Stripe not called) |
| `provider-error` | `retrieveSession` throws |
| `complete` | `paymentStatus === "paid"` or `status === "complete"` |
| `open` with `url` | `status === "open"` and `url` starts with `https://` |
| `expired` | `status === "expired"` |
| `unavailable` | anything else (including `open` with a null or non-`https://` URL, i.e. the stub) |

`paid` is tested before `open`/`expired`, so a verified payment always wins.

**3. A facade, `lib/resume-payment-service.ts`.** `getResumePaymentService().resume(orderNumber)`
loads `findOrderPaymentState(getPrisma(), await getCurrentVendorId(), orderNumber)`. It returns
`not-found` for no row, and otherwise calls `resumeOrderPayment` with
`getPaymentService().retrieveSession`. It is built fresh per call.

**4. A server action, `features/checkout/resume-payment.ts`, `resumePayment(formData)`.** It
re-proves access with `getOrderRepository().getByOrderNumber(orderNumber, viewerUserId, t || null)`
and refuses to `/orders/lookup?orderNumber=…`. It makes no write.

| Outcome | Redirect |
|---|---|
| `open` | the Stripe session `url` |
| `complete`, `not-pending` | `/checkout/<order><tq>` (the confirmation page, which confirms a paid order via `PaymentStatusCheck`) |
| `expired` | `/checkout/<order>/cancel?payment=expired<ta>` |
| `no-session` | `/checkout/<order>/cancel?payment=none<ta>` |
| `provider-error`, `unavailable`, `not-found` | `/checkout/<order>/cancel?payment=unavailable<ta>` |

A provider failure is never reported as expired.

**5. `cancelOrder` checks Stripe before it cancels, and restores at most once.** It keeps its
authorization. After access is proved and before `cancelUnpaid`, it calls
`getPaymentCheckService().check(orderNumber)`, the existing single-order check. That check confirms
the order if Stripe says `paid`:

| Check result | Action |
|---|---|
| `confirmed`, `not-pending`, `refused` | no cancel, no restore; redirect `/checkout/<order><tq>` |
| `provider-error` | no cancel, no restore; redirect `/checkout/<order>/cancel?payment=unavailable<ta>` |
| `not-found` | no cancel, no restore; redirect `/cart` |
| `no-session`, `not-paid` | call `cancelUnpaid`; restore and show the notice **only if it returned `true`**; if it returned `false`, redirect plain `/cart` with no restore |

`refused` means Stripe said `paid` but the stored binding disagreed. That is a payment anomaly
already persisted for staff, and cancelling would bury it. With the stub adapter, `check` returns
`not-paid` (the stub is always unpaid), so local cancellation still works.

**6. Pending-state submit buttons.** A small client component,
`components/checkout/PendingSubmitButton.tsx`, uses `useFormStatus` to disable itself and show
the pending text while its form is submitting. The server rules above make a repeat harmless. The
disabled button stops the repeat in the first place.

**7. A presentational component, `components/checkout/UnfinishedPaymentChoices.tsx`.** It is a
server component (no `"use client"`). Props are `orderNumber`, `token`, `state`
(`"open" | "past-ttl" | "expired" | "none"`) and `notice` (`"unavailable" | null`). Each choice is
its own `<form>` with hidden `orderNumber` and `t`, and a `PendingSubmitButton`.

- `open`: **Continue to payment** (primary, `resumePayment`) and **Change my order** (secondary,
  `cancelOrder`). One line says changing cancels the order, charges nothing and puts the items back
  in the basket.
- `past-ttl`: the same two buttons, plus "This payment link may have expired. If it has, we'll tell
  you when you continue."
- `expired`: "This payment link has expired — nothing was charged." and only **Put my items back in
  the basket** (`cancelOrder`).
- `none`: "There's no payment page to return to for this order — nothing was charged." and only
  **Put my items back in the basket**.
- `notice === "unavailable"` adds a `role="status"` line: "We couldn't reach the payment service
  just now. Nothing has changed — please try again." The buttons stay, so the shopper can retry.

**8. The cancel page becomes "Your payment wasn't finished".** It keeps its authorization, its
refusal redirect, and its redirect to `/checkout/<order><tq>` once the order is not
`PENDING_PAYMENT`. `state` is `expired` for `?payment=expired`, `none` for `?payment=none`,
otherwise `past-ttl` when `isPastCheckoutSessionTtl(order.createdAt, new Date())`, otherwise `open`.
`notice` is `unavailable` only for `?payment=unavailable`. Any other `payment` value is ignored. The
page also renders the existing `PaymentStatusCheck`. That client component POSTs `checkMyPayment`
once on mount and refreshes when it confirms, so an order paid in another tab moves to the
confirmation page by itself. The GET render still makes no write and no Stripe call. The old link
and the red button are removed.

A crafted `?payment=expired` only hides the Continue button. Both actions re-ask Stripe, so the
parameter cannot cause a wrong cancel.

**9. The member order page shows the same choices.** `/account/orders/<order>` renders
`UnfinishedPaymentChoices` (token `null`, notice `null`, state `past-ttl` or `open` by the clock) and
`PaymentStatusCheck` (token `null`) when, and only when, `order.status === "PENDING_PAYMENT"`. Both
go above the progress tracker. Action failures land on the cancel page, which explains every state
and works for members too.

**10. Basket restore fidelity (unchanged mechanism, now asserted).** Restoring still goes through
`restoredLines` and `addItems` (`#957`, `#1135`):
- each line's quantity is requested as ordered, and its `customNote` is carried back. The note is
  the only per-line option a product line has: `CartItem` has no variant or option column;
- a line whose product is gone or out of stock is reported `unavailable`, and a line with less stock
  is clamped and reported `partial`, on the existing `/cart` notice;
- prices are not copied. `CartItem` stores no price, so the basket and the next checkout show and
  charge the product's current price, recomputed server-side by `placeOrder`. A changed price is
  therefore visible before the shopper pays again, and nothing is charged at the old or new price
  without a fresh checkout.

**11. Shopper help.** `docs/shopper-help/shopping-guide.md` gains one bullet describing the choices.

## Why these choices

- **Reopen the same session, never create a new one.** Two sessions for one order is the binding
  mismatch `#429`/`#454` guard against.
- **Ask Stripe in the POST, not the GET.** Stripe's `cancel_url` is a GET, and prefetchers follow
  GETs (`#428`). The existing `PaymentStatusCheck` already does the "ask on mount via POST" job.
- **Cancel reuses `getPaymentCheckService().check`** rather than a second Stripe-reading path. It
  confirms through the same compare-and-set as the webhook and the sweep, and it cannot release
  anything.
- **No cancel when Stripe is unreachable.** Cancelling without knowing risks cancelling a paid
  order. If Stripe stays down, the scheduled sweep remains the release path, as today.
- **Restore only after this call's own cancel.** `cancelUnpaid`'s boolean is the compare-and-set
  result, the one fact that tells a repeat from the first click.
- **Only `https://` URLs are followed.**

## Deliberately excluded

- **Expiring the Stripe session when the shopper cancels.** It would close the window in which a
  shopper can pay into an already-cancelled order. But Stripe then sends `checkout.session.expired`,
  and the webhook's `fail` could race this action's `cancelUnpaid`: the webhook could win, which
  would skip the basket restore, and the order would read as an abandoned checkout (`#1554`). That
  window exists today and is unchanged. It needs its own analysis, filed as a follow-up issue at
  Build.
- **A new Stripe session for an existing order**, or extending an expired one.
- **Keeping the basket filled while paying** (invites duplicate orders).
- **Schema changes.** None.
- **Telling the shopper that a price changed** since the order. The current price is shown in the
  basket and at checkout, but no "was £X" line is added.
- **Guest choices outside the cancel page** (`/orders/lookup`, emails), the **account order list**,
  and the **confirmation page's** pending copy.
- **The member page's Reorder and Save as list buttons** on a pending order. They are today's
  behaviour.
- **The webhook, the sweep, `releaseOrder`/`cancelUnpaidOrder`, `addCartItems`, `restoredLines`,
  `checkOrderPayment` and `getPaymentCheckService`.** They are reused, not modified.
- **Rate limiting the two actions.** They need the 122-bit token or the owning session, as today.

## Open items carried forward

- **#113** — live Stripe keys. The live checks run against Stripe test mode under `npm run preview`.
- **#1580** is merged to `staging` (`09201e02`), so the issue's coordination note is satisfied.
- **Follow-up issue (to file at Build):** expire the Stripe session on shopper cancel, with the
  webhook race analysed.
