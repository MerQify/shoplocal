# Checkout and cancellation fixes (requirements / acceptance criteria)

Closes #1690, #1691 and #1693. These fix what the owner's first live-mode orders on AFC production
showed on 2026-11-20:
- a sub-30p basket failing with a misleading error;
- Stripe's real error never logged;
- a cancelled order's Checkout Session left payable;
- a cancellation email with one fixed wording;
- Telegram alerts with a large preview card.

`plan.md` has the narrative.

## Provider minimum (#1690)

R1. `PaymentService` (`lib/payments.ts`) has a `minimumAmount(currency: string): number | null`
    method.
    - **Stripe service:** returns 30 for `gbp`, 50 for `eur` and 50 for `usd`, case-insensitive, in
      minor units. It returns `null` for any other currency.
    - **Stub service:** returns `null` for every currency.

R2. `placeOrder` (`lib/repositories/orders.ts`) throws
    `CheckoutError("BELOW_PAYMENT_MINIMUM", <message>)` when the order total in pence is below a
    non-null `minimumAmount(<order currency>)`.
    - **Where it runs:** inside the order transaction, so the transaction rolls back. After the
      throw, no `Order`, `OrderItem`, `Payment` or `OrderStatusEvent` row exists for that attempt,
      no stock is decremented, the cart is unchanged, and `createPayment` is never called.
    - **The message:** exactly `Card payments need a total of at least £0.30.` for GBP. For another
      currency in the table, the same sentence with that currency's amount formatted for that
      currency.

R3. A total **equal** to the minimum (30p in GBP) is not refused by R2.

R4. The checkout page shows R2's message to the shopper in the same place and style as the other
    `CheckoutError` messages (for example `BELOW_MINIMUM`).

## Provider error logging (#1690)

R5. When `createPayment` throws inside `placeOrder`'s payment step, the thrown error's message is
    passed to `console.error`, with a line starting `[payments] createPayment failed for order
    <orderNumber>:`, and persisted as an `ErrorEvent`.
    - The persisted row's `message` starts with `[payments] createPayment failed` and contains the
      thrown message.
    - The existing compensation is unchanged: `releaseOrder`, the cart restore, and the
      `PAYMENT_PROVIDER_FAILED` `CheckoutError` with its existing text.
    - The code that persists the row respects `tests/repository-purity.test.ts` and
      `tests/repository-client-injection.test.ts`. Both stay green without allowlists.

R6. If persisting R5's `ErrorEvent` itself fails, `placeOrder` still throws
    `PAYMENT_PROVIDER_FAILED`, never a different error.

## Expire the session when a shopper cancels (#1690)

R7. `PaymentService` has an `expireSession(sessionId: string): Promise<void>` method.
    - **Stripe service:** sends `POST https://api.stripe.com/v1/checkout/sessions/<id>/expire`
      (id URL-encoded) with the same `Authorization` and `Stripe-Version` headers as
      `retrieveSession`. On a non-2xx response it throws `PaymentProviderError` carrying the status
      and body.
    - **Stub service:** resolves without doing anything.

R8. In `features/checkout/cancel-order.ts`, when this call's `cancelUnpaid` cancelled the order (the
    branch that currently restores the cart) and the order's payment has a stored provider
    reference, `expireSession(<that reference>)` is called once.
    - A throw from it is caught and logged with `console.error`, with a line starting `[payments]
      expireSession failed for order <orderNumber>:`.
    - It never changes the redirect destination and never prevents the cart restore.
    - It is not called on any other branch: confirmed, not-pending, refused, provider-error,
      not-found, or a repeat cancel.

R9. The file `features/checkout/cancel-order.ts` still exports only async functions (CLAUDE.md
    Server Actions rule).

## Cancellation choices and wording (#1691)

R10. A migration adds to `OrderStatusEvent`:
    - two enums, `CancellationReason` (`CUSTOMER_REQUEST`, `STORE_UNABLE`, `OTHER`) and
      `CancellationMessage` (`REFUNDED`, `NOT_REFUNDED`, `CUSTOM`);
    - three nullable columns, `cancellationReason CancellationReason?`,
      `cancellationMessage CancellationMessage?` and `customerMessage String?`.

    Requirements on the migration:
    - It is hand-authored. Its header says why it was not generated, per CLAUDE.md's Schema rules.
    - It contains only `CREATE TYPE` and `ALTER TABLE "OrderStatusEvent" ADD COLUMN` statements:
      no `DROP`, and nothing touching the `pg_trgm` indexes.
    - `prisma/schema.prisma` matches it, so `prisma migrate diff` from the migrations to the schema
      reports no difference.

R11. The staff cancel form on `/staff/orders/[orderNumber]` keeps its existing required internal
    `reason` text field and its existing behaviour. It adds:
    - a required radio group **"Who asked for this?"** with options `Customer asked`,
      `We couldn't fulfil it` and `Other`;
    - a required radio group **"What should we tell the customer?"** with options
      `Refunded in full`, `Not refunded yet` and `Write my own message`;
    - a `textarea` named `customerMessage`, `maxLength` 1000, not `required`, labelled
      `Message to the customer`. It is shown only while `Write my own message` is selected.

    The form states in visible text that the internal reason is not shown to the customer.

R12. `cancelOrderStaff` (`features/orders/cancel-order-staff.ts`) re-validates on the server.
    - It refuses, cancelling nothing, when either radio value is missing or not one of its enum
      values, or when `customerMessage` is longer than 1000 characters after trimming.
    - On success, the CANCELLED `OrderStatusEvent` that `cancelConfirmedOrder` creates stores both
      enum values, and `customerMessage` trimmed. `customerMessage` is stored only when the message
      choice is `CUSTOM` and the trimmed text is non-empty; otherwise it is `null`. `note` still
      stores the internal reason.

R13. One pure function in `lib/order-notifications/next-step.ts`, used by both
    `buildCustomerEmail` and `OrderProgressTracker`, returns the CANCELLED "what happens next"
    text from `(cancellationReason, cancellationMessage, customerMessage)`, exactly:

    | Reason | Message | Text |
    |---|---|---|
    | `CUSTOMER_REQUEST` | `REFUNDED` | `As you asked, we've cancelled this order. Your payment has been refunded in full; it can take a few days to reach your account. Any points or discount code you used have been put back on your account.` |
    | `CUSTOMER_REQUEST` | `NOT_REFUNDED` | `As you asked, we've cancelled this order, and any points or discount code you used have been put back on your account. We'll refund your payment and let you know when it's done.` |
    | `STORE_UNABLE` or `OTHER` | `REFUNDED` | `We're sorry — we've had to cancel this order. Your payment has been refunded in full; it can take a few days to reach your account. Any points or discount code you used have been put back on your account.` |
    | `STORE_UNABLE` or `OTHER` | `NOT_REFUNDED` | the existing `CANCELLED_NEXT_STEP` text, unchanged |
    | any | `CUSTOM`, with a non-empty `customerMessage` | the `customerMessage` text |
    | any | `CUSTOM`, with an empty or null `customerMessage` | `This order has been cancelled. If you have any questions about it, including any payment, please reply to this email.` |
    | null | null | the existing `CANCELLED_NEXT_STEP` text, unchanged |

    No text names a vendor or a product (CLAUDE.md, user-facing copy).

R14. The cancellation email sent by `cancelOrderStaff` (`notifyOrderEvent(…, "CANCELLED")`) and the
    customer-facing order pages that render `OrderProgressTracker` for a cancelled order show
    R13's text for that order's latest CANCELLED event.
    - The pages are `/account/orders/[orderNumber]`, `/checkout/[orderNumber]` and
      `/orders/lookup`.
    - The internal `note` still never reaches either surface.

R14a. The default `order.cancelled` email template (`lib/email/templates/registry.ts`) has a
    neutral intro, `Order **{{orderNumber}}** has been cancelled.`, and a neutral preheader,
    `Here's what this means for your order and payment.` Neither contains "sorry" or "had to". The
    R13 text below them carries the apology or the "as you asked". A store's saved template
    override (#1564) is still used in place of the default. Added at validation on 2026-11-20:
    the original intro ("We're sorry, we've had to cancel order …") contradicted the
    customer-asked wording.

R15. A custom message is rendered as text. In the email's HTML, `<`, `>`, `&` and `"` in it are
    escaped, so `<a href="x">y</a>` appears literally and creates no link. In the plain-text part it
    appears verbatim. On the order pages it is rendered as a React text node, never through
    `dangerouslySetInnerHTML`.

## Telegram (#1693)

R16. The Telegram channel's `sendMessage` request body (`lib/order-alert/channels.ts`) contains
    `"link_preview_options":{"is_disabled":true}`, alongside the existing `chat_id` and `text`.

## Docs, changelog and gates

R17. The staff guide that documents `/staff/orders` describes:
    - the two new choices and the custom message;
    - that the internal reason is not shown to the customer;
    - that "Refunded in full" does not issue a refund (refund in Stripe first).

    Every sentence traces to a real control.

R18. Unit or integration tests cover:
    - R1 and R3 (minimum table and boundary), and R2 (refusal leaves no rows and calls no
      `createPayment`);
    - R5 and R6 (log and persist, and failure of the persist);
    - R7 (request shape and error), and R8 (called on the cancelling branch, not on others, and a
      failure is swallowed);
    - R12 (validation and stored values), R13 (every row of the table), and R15 (escaping);
    - R16 (request body).

R19. `CHANGELOG.md` updated (Gate 4).

R20. `lint`, `typecheck`, `test`, `format:check` and `build` all remain green after this slice.
