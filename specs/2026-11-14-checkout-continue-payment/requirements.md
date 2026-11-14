# Checkout: Continue to payment after leaving Stripe (requirements / acceptance criteria)

Closes **#1589**. Stripe's `cancel_url` (`/checkout/<order>/cancel?t=<token>`) currently asks
"Cancel this order?" and offers a link to an empty basket. That link leaves the order unpaid and
unreachable. This slice turns the page into "Your payment wasn't finished". The shopper can reopen
the order's **own** Stripe session (**Continue to payment**), or cancel and get the items back in
the basket (**Change my order** / **Put my items back in the basket**). The member page
`/account/orders/<order>` offers the same choices.

Stripe's verified status, never the order's age, decides "expired" and "paid". `cancelOrder`
asks Stripe before cancelling, never cancels a paid order or cancels when Stripe is unreachable,
and restores the basket at most once. No schema change, no new Stripe session. `plan.md` holds the
reasoning, the outcome tables and the exclusions.

Terms used below:
- **TTL** is `CHECKOUT_SESSION_TTL_MS` in `lib/payments.ts` (35 minutes).
- **`<order>`** is `encodeURIComponent(orderNumber)`.
- **`<tq>`** is `?t=<encodeURIComponent(token)>` when the request carried a non-empty token, else
  empty. **`<ta>`** is the same with `&` in place of `?`.
- **Unchanged file** means `git diff origin/staging -- <file>` prints nothing at the slice's head.

## Payment port (`lib/payments.ts`)

R1. `RetrievedSession` has a field `url: string | null`. The Stripe adapter's `retrieveSession`
    sets it to the response's `url`, or `null` when absent. The stub's `retrieveSession` returns
    `url: null`.
R2. `lib/payments.ts` exports `isPastCheckoutSessionTtl(createdAt: Date, now: Date): boolean`,
    returning `true` exactly when `now.getTime() >= createdAt.getTime() + CHECKOUT_SESSION_TTL_MS`.
    A unit test asserts `false` at TTL − 1 ms, `true` at TTL, and `true` at TTL + 1 ms.

## Resume decision (`lib/resume-payment.ts`)

R3. Every `import` in `lib/resume-payment.ts` is `import type`.
R4. `resumeOrderPayment(deps, order)` takes `deps = { retrieveSession(sessionId) }` (no other
    member) and `order = { orderNumber, status, providerReference: string | null }`. It resolves to
    the first matching row. A unit test covers every row, asserts `retrieveSession` is not called
    for rows a and b, and asserts it receives `order.providerReference` otherwise.

    | # | Condition | Outcome |
    |---|---|---|
    | a | `status !== "PENDING_PAYMENT"` | `{ kind: "not-pending" }` |
    | b | `providerReference === null` | `{ kind: "no-session" }` |
    | c | `retrieveSession` throws | `{ kind: "provider-error" }` |
    | d | `paymentStatus === "paid"` (whatever `status` is, including `"expired"` and `"open"`) or `status === "complete"` | `{ kind: "complete" }` |
    | e | `status === "open"` and `url` starts with `https://` | `{ kind: "open", url }` |
    | f | `status === "expired"` | `{ kind: "expired" }` |
    | g | anything else, including `open` with `url: null` and `open` with an `http://` URL | `{ kind: "unavailable" }` |

    Row d includes a test case where `status: "expired"` and `paymentStatus: "paid"` resolves to
    `complete` (a verified payment wins over expiry).

## Resume facade (`lib/resume-payment-service.ts`)

R5. `getResumePaymentService().resume(orderNumber)` calls
    `findOrderPaymentState(getPrisma(), await getCurrentVendorId(), orderNumber)`. It resolves
    `{ kind: "not-found" }` for `null`, and otherwise returns `resumeOrderPayment` with a
    `retrieveSession` that delegates to `getPaymentService().retrieveSession`. No client is held at
    module scope. A unit test with mocked modules covers both paths.

## Resume action (`features/checkout/resume-payment.ts`)

R6. The file starts with `"use server"` and has exactly one `export`:
    `export async function resumePayment(formData: FormData): Promise<void>`.
R7. It reads `orderNumber` and `t`, and calls `getOrderRepository().getByOrderNumber(orderNumber,
    viewerUserId, t || null)` (`viewerUserId` from the Better Auth session, or `null`). On `null`
    it redirects to `/orders/lookup?orderNumber=<order>` and never calls `getResumePaymentService`.
R8. On access, it calls `getResumePaymentService().resume(orderNumber)` exactly once, writes nothing,
    and redirects as below. A unit test asserts each row's exact target, for a guest with
    `t = "tok-1"` and for a member with `t = ""`. `redirect()` is not inside a `try` block.

    | Outcome | Redirect target |
    |---|---|
    | `open` | the outcome's `url`, verbatim |
    | `complete`, `not-pending` | `/checkout/<order><tq>` |
    | `expired` | `/checkout/<order>/cancel?payment=expired<ta>` |
    | `no-session` | `/checkout/<order>/cancel?payment=none<ta>` |
    | `provider-error`, `unavailable`, `not-found` | `/checkout/<order>/cancel?payment=unavailable<ta>` |

## Cancel action (`features/checkout/cancel-order.ts`)

R9. `cancelOrder` keeps its access check (`getByOrderNumber` with the cart identity's user id and
    `t || null`). When access fails or the read order is not `PENDING_PAYMENT`, it redirects to plain
    `/cart` and calls neither `getPaymentCheckService().check` nor `cancelUnpaid`, as today.
R10. Otherwise it calls `getPaymentCheckService().check(orderNumber)` exactly once, **before**
     any call to `cancelUnpaid`, and acts on the result as below. A unit test (modules mocked)
     covers every row and asserts call counts on `cancelUnpaid` and on the cart `addItems`.

     | `check` result | `cancelUnpaid` called | basket restore | redirect |
     |---|---|---|---|
     | `confirmed`, `not-pending`, `refused` | no | no | `/checkout/<order><tq>` |
     | `provider-error` | no | no | `/checkout/<order>/cancel?payment=unavailable<ta>` |
     | `not-found` | no | no | `/cart` |
     | `no-session` or `not-paid`, and `cancelUnpaid` returns `true` | once | once, via `restoredLines` | `buildRestoreNoticeUrl("cancelled", lines)` |
     | `no-session` or `not-paid`, and `cancelUnpaid` returns `false` | once | no | `/cart` |

R11. The `cancelUnpaid` reason string stays `"Shopper cancelled payment at checkout"`. The items
     passed to `restoredLines` are the order's items with `productId`, `productName`, `quantity` and
     `customNote` unchanged. A unit test asserts this for a two-line order where one line has a
     `customNote` and quantity 3.
R12. The file still exports only async functions (CLAUDE.md, Server Actions): `grep -n "^export"`
     lists only `export async function` lines.

## Submit buttons and the choices component

R13. `components/checkout/PendingSubmitButton.tsx` starts with `"use client"`, renders a
     `<button type="submit">`, and sets `disabled` and `aria-disabled="true"` while `useFormStatus()`
     reports `pending`. A component test with `useFormStatus` mocked asserts both states.
R14. `components/checkout/UnfinishedPaymentChoices.tsx` has no `"use client"` directive and takes
     props `orderNumber: string`, `token: string | null`,
     `state: "open" | "past-ttl" | "expired" | "none"`, `notice: "unavailable" | null`. Every
     `<form>` it renders contains hidden inputs `orderNumber` (the order number) and `t` (the token,
     or `""` for `null`) and exactly one `PendingSubmitButton`.
R15. For `state` `open` and `past-ttl`, it renders exactly two forms: first **Continue to payment**
     with action `resumePayment`, then **Change my order** with action `cancelOrder`, plus text
     saying that changing the order cancels it, charges nothing and puts the items back in the
     basket. `past-ttl` additionally renders "This payment link may have expired"; `open` does not.
R16. For `state` `expired`, it renders "This payment link has expired — nothing was charged." For
     `none`, it renders "There's no payment page to return to for this order — nothing was charged."
     In both, it renders exactly one form, action `cancelOrder`, button **Put my items back in the
     basket**, and no **Continue to payment**.
R17. For `notice: "unavailable"`, it renders one `role="status"` element containing "We couldn't
     reach the payment service just now" and "Nothing has changed". The buttons for the given
     `state` are still rendered. For `notice: null`, it renders no `role="status"` element.
R18. R14–R17 are asserted by a component test (`*.test.tsx`, Testing Library) that identifies form
     actions by mocking `@/features/checkout/resume-payment` and `@/features/checkout/cancel-order`.
     The component's copy names no vendor and no product.

## Cancel page (`app/(storefront)/checkout/[orderNumber]/cancel/page.tsx`)

R19. `metadata.title` and the `<h1>` are both "Your payment wasn't finished".
R20. The page passes `UnfinishedPaymentChoices` `orderNumber = order.orderNumber`,
     `token = t ?? null`, `notice = payment === "unavailable" ? "unavailable" : null`, and `state`:
     `"expired"` when `payment === "expired"`; else `"none"` when `payment === "none"`; else
     `"past-ttl"` when `isPastCheckoutSessionTtl(order.createdAt, new Date())`; else `"open"`.
     (`payment` is the `payment` search parameter. Any other value is treated as absent.) The order's
     age alone never produces `"expired"`.
R21. The page renders `<PaymentStatusCheck orderNumber={order.orderNumber} token={t ?? null} />`
     while the order is `PENDING_PAYMENT`.
R22. The JSX no longer renders the "No — keep it and go to my basket" link, any link to `/cart`, or
     a button labelled "Cancel this order".
R23. Unchanged: a viewer without access is redirected to `/orders/lookup?orderNumber=<order>`; an
     order not `PENDING_PAYMENT` is redirected to `/checkout/<order><tq>`; the order number and
     `formatPrice(order.totalPence)` are shown.
R24. The page itself makes no write and no provider call. Its only import from `@/lib/payments` is
     `isPastCheckoutSessionTtl`, and it imports nothing from `@/lib/resume-payment-service`,
     `@/lib/payment-check-service` or `@/lib/orders-service` other than `getOrderRepository`.

## Member order page (`app/(storefront)/account/orders/[orderNumber]/page.tsx`)

R25. When, and only when, `order.status === "PENDING_PAYMENT"`, the page renders
     `UnfinishedPaymentChoices` (`token = null`, `notice = null`, `state` `"past-ttl"` when
     `isPastCheckoutSessionTtl(order.createdAt, new Date())` else `"open"`) and
     `<PaymentStatusCheck orderNumber={order.orderNumber} token={null} />`, both before
     `<OrderProgressTracker`.

## No regression

R26. These files are unchanged: `app/api/webhooks/stripe/route.ts`, `lib/payment-sweep.ts`,
     `lib/payment-sweep-service.ts`, `lib/payment-check.ts`, `lib/payment-check-service.ts`,
     `lib/restore-lines.ts`, `lib/repositories/cart.ts`, `lib/repositories/orders.ts`,
     `features/checkout/place-order.ts`, `features/checkout/check-my-payment.ts`, and
     `prisma/schema.prisma`. No file is added under `prisma/migrations/`.
R27. These existing test files are unchanged, and pass: `tests/stripe-webhook.test.ts`,
     `tests/stripe-webhook-payment-failed.test.ts`, `tests/webhook-refusal-persistence.test.ts`,
     `tests/payment-sweep.test.ts`, `tests/payment-check.test.ts`,
     `tests/payment-check-service.test.ts`, `tests/payment-check-actions.test.ts`,
     `tests/cart-bulk-add-report.test.ts`, `tests/cart-notes.test.ts`, `tests/restore-notice.test.tsx`.
     `tests/payments.test.ts` changes only by additions plus `url` in the existing `toEqual`
     expectation(s) for `retrieveSession`.

## Live behaviour (`npm run preview`, Stripe test key in `.dev.vars`)

R28. **Continue, guest.** A guest who checks out, reaches Stripe Checkout and uses Stripe's back
     link lands on the cancel page with the new heading and both buttons. **Continue to payment**
     opens `checkout.stripe.com` for the session id stored in the order's
     `Payment.providerReference`. The order still has exactly one `Payment` row and is
     `PENDING_PAYMENT`.
R29. **Change, guest.** **Change my order** leaves the order `CANCELLED` and lands on `/cart` with the
     order's items at their ordered quantities, and with any item note restored.
R30. **Repeat click.** Submitting **Change my order** twice for the same order (two quick submits,
     or a resubmission of the same form after the first completed) leaves each item in the basket at
     its ordered quantity, not doubled. The order's status history has one cancellation entry.
R31. **Paid elsewhere.** For an order paid in Stripe test mode in another tab while the webhook is not
     delivered (no `stripe listen` running): reloading the cancel page ends on the confirmation page
     showing the order confirmed (via `PaymentStatusCheck`), and pressing **Change my order** on a
     copy of the page opened before the payment does not cancel it. The DB status is `CONFIRMED`.
R32. **Stripe unreachable.** With `STRIPE_SECRET_KEY` in `.dev.vars` set to an invalid test key
     (`sk_test_invalid`), restarting preview, **Continue to payment** lands on the cancel page with the
     `role="status"` retry notice and both buttons still present, and **Change my order** does the
     same and leaves the order `PENDING_PAYMENT`.
R33. **Member.** A signed-in shopper with a `PENDING_PAYMENT` order sees both buttons on
     `/account/orders/<order>` above the progress tracker, and **Continue to payment** opens that
     order's stored Stripe session.
R34. **Expired, verified.** For a `PENDING_PAYMENT` order whose Stripe session Stripe reports
     `expired`, **Continue to payment** lands on `?payment=expired`, which shows the expired sentence
     and only **Put my items back in the basket**. Pressing it cancels the order and restores the
     items.
R35. **Wrong token.** Submitting **Continue to payment** with the hidden `t` changed to `wrong`
     lands on `/orders/lookup?orderNumber=<order>` with no redirect to `checkout.stripe.com`.

## Docs, changelog, gates

R36. `docs/shopper-help/shopping-guide.md` has a bullet naming **Continue to payment** and **Change my
     order**, saying the items go back in the basket, and saying nothing was charged if the payment
     link has expired.
R37. A follow-up issue exists for "expire the Stripe session on shopper cancel" (plan.md, Deliberately
     excluded), and its number is recorded in `build-notes.md`.
R38. `CHANGELOG.md` updated (Gate 4).
R39. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice.
