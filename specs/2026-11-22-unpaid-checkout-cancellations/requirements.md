# Unpaid checkout cancellations told apart from real cancellations (requirements / acceptance criteria)

Slice A of the checkout-recovery brief (#1730). Records why every order was cancelled as data,
hides never-paid checkouts from the customer's order history and the default staff list, and words
direct links to them as "Payment not completed". See `plan.md` for the reasoning and the mapping
table; stock reservation and release behaviour do not change.

R1. `prisma/schema.prisma` defines `enum CancellationOrigin { CHECKOUT_CHANGED CHECKOUT_ABANDONED
    PAYMENT_EXPIRED PAYMENT_FAILED PROVIDER_UNAVAILABLE STAFF }` and a nullable
    `cancellationOrigin CancellationOrigin?` field on `OrderStatusEvent`.
R2. One new hand-authored migration under `prisma/migrations/` creates the enum and column, states
    in its header why it was not generated (#895), and contains no `DROP` statement.
R3. That migration backfills `cancellationOrigin` on `OrderStatusEvent` rows with
    `status = 'CANCELLED'` only where `note` exactly equals one of the seven note strings in
    `plan.md`'s table (mapped as that table says), or sets `STAFF` where `cancellationReason IS NOT
    NULL`; every other row keeps `NULL`.
R4. `releaseOrder` in `lib/repositories/orders.ts` takes a required `CancellationOrigin` argument
    and writes it to the CANCELLED event it creates; every caller passes the origin given in
    `plan.md`'s table (cancel action `CHECKOUT_CHANGED`; webhook expired `PAYMENT_EXPIRED`; webhook
    async failure `PAYMENT_FAILED`; sweep expired `PAYMENT_EXPIRED`; sweep unsettled
    `PAYMENT_FAILED`; sweep no session `CHECKOUT_ABANDONED`; placement provider failure
    `PROVIDER_UNAVAILABLE`).
R5. `cancelConfirmedOrder` writes `cancellationOrigin: "STAFF"` on the CANCELLED event it creates.
R6. A single exported Prisma `where` fragment in `lib/repositories/orders.ts` defines an unpaid
    checkout as `status = CANCELLED` with no `Payment` whose status is `SUCCEEDED` or `REFUNDED`;
    R7 and R10 use it, and a unit test proves an order with a `SUCCEEDED` or `REFUNDED` payment
    never matches it.
R7. `listOrdersForUser` excludes unpaid checkouts and still returns `PENDING_PAYMENT`, paid and
    staff-cancelled paid orders; its comment records the reversal of the earlier "deliberately not
    filtered" decision.
R8. For an unpaid checkout, `/account/orders/[orderNumber]`, `/orders/lookup` (result) and
    `/checkout/[orderNumber]` render the status "Payment not completed" and the sentence "Payment
    not completed. You haven't been charged.", and do not render the word "Cancelled".
R9. A paid order cancelled by staff still renders "Cancelled" with its #1691 wording on the same
    three pages.
R10. `/staff/orders` excludes unpaid checkouts by default, including when the CANCELLED status
    filter is selected, and includes them when `?unpaid=1` is present; the page offers a "Show
    unpaid checkouts" control that sets and clears that parameter.
R11. Every cancelled order on `/staff/orders` and `/staff/orders/[orderNumber]` shows its origin
    label: "Changed at checkout", "Payment link expired", "Payment failed", "Checkout abandoned",
    "Payment service unavailable", "Cancelled by store", or "Reason not recorded" when the origin
    is `NULL`.
R12. Stock release stays idempotent: a test cancels the same `PENDING_PAYMENT` order twice through
    `releaseOrder` and asserts one CANCELLED event, one origin and one stock increment.
R13. `docs/staff-playbook/staff-tabs-guide.md` documents the default hiding, the toggle and the
    origin labels; `docs/shopper-help/shopping-guide.md` says unpaid checkouts don't appear in My
    orders and that nothing was charged.
R14. Against `npm run preview` with the dev database, an order placed and then cancelled with
    "Change my order" is absent from `/account/orders`, shows "Payment not completed" at its direct
    link, is absent from `/staff/orders?status=CANCELLED`, and appears labelled "Changed at
    checkout" at `/staff/orders?status=CANCELLED&unpaid=1`.
R15. `CHANGELOG.md` updated (Gate 4).
R16. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice.
