# Checkout keeps what the shopper typed when an order is refused (validation)

> **Testing Strategy (Lean 80/20 Model)** — enough testing for confidence, without duplicates. One
> component test proves the behaviour; one live check confirms it in the real checkout.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit (read) | Read the `<form>` in `components/checkout/CheckoutForm.tsx`. **Pass:** it has an `onSubmit` that calls `preventDefault()` and dispatches `formAction(new FormData(...))` inside `startTransition`, and it still has `action={formAction}`. |
| R2  | Component | `npx vitest run tests/checkout-keeps-fields.test.tsx --maxWorkers=4` passes. Read it: it mocks the refusal, types into the six fields, submits, and asserts the alert text and each field's value. |
| R3  | Component | Same test: `placeOrderAction` is called once, and the `FormData` argument's `recipientName`, `line1`, `city` and `postcode` match the typed values. |
| R4  | E2E (live) | On AFC staging, add a product, open `/checkout`, choose **Delivery**, and fill name `Validation 1613`, email `validation-1613@example.com`, phone `07700900123`, street `1 Test Street`, town `London`, postcode `SW1A 1AA`. Pick a slot, then **Continue to payment**. **Pass:** the refusal message shows and all six fields still hold those values. |
| R5  | Static | `git diff --name-only origin/staging...HEAD \| grep -x CHANGELOG.md` prints `CHANGELOG.md`, and the entry cites `#1613`. |
| R6  | Gates | `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run kms:validate` exit 0. `npx vitest run --maxWorkers=4`, run alone, passes apart from the four live-DB files blocked by `#1599`. CI green on the PR. |
