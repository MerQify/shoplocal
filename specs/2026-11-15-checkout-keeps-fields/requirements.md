# Checkout keeps what the shopper typed when an order is refused (requirements / acceptance criteria)

Closes `#1613`. When checkout refuses an order, the error is shown and every field the shopper typed
keeps its value. `plan.md` has the cause (React 19's automatic reset after a form `action`).

R1. `components/checkout/CheckoutForm.tsx`'s `<form>` has an `onSubmit` handler. The handler calls
    `preventDefault()` and dispatches `formAction` with that form's `FormData` inside a transition.
    The `action={formAction}` attribute is still present. Checked by reading the component.

R2. A component test renders `CheckoutForm` with `placeOrderAction` mocked to resolve
    `{ error: "Sorry — we don't deliver to SW1A 1AA yet." }`, fills the full name, email, phone,
    street, town and postcode fields, and submits. It asserts that the alert shows that message and
    that each of those six inputs still holds the typed value.

R3. The same test asserts that `placeOrderAction` was called once, with a `FormData` whose
    `recipientName`, `line1`, `city` and `postcode` entries equal the typed values.

R4. **AFC staging, live.** A delivery checkout with postcode `SW1A 1AA` shows
    `Sorry — we don't deliver to SW1A 1AA yet.`, and the full name, email, phone, street, town and
    postcode fields still show what was typed.

R5. `CHANGELOG.md` updated (Gate 4).

R6. `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=4`, `npm run format:check`
    and `npm run kms:validate` all remain green after this slice.
