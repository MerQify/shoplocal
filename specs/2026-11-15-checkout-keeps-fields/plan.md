---
id: 2026-11-15-checkout-keeps-fields-plan
title: "Checkout keeps what the shopper typed when an order is refused (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1613. A refused checkout cleared every typed field because React 19 resets a form after its action completes; submit through onSubmit and a transition so the fields survive."
tags: [checkout, forms, go-live]
related: [sdd-workflow]
---

# Checkout keeps what the shopper typed when an order is refused (plan)

Issue `#1613`, part of the go-live work (`#1344`). It was found while validating `#1605` on AFC
staging (2026-11-15): after "Sorry — we don't deliver to SW1A 1AA yet.", the name, email, phone and
address fields were all empty.

**Goal:** a refused order leaves every typed field as it was, so the shopper fixes one thing and
submits again.

**Cause.** `components/checkout/CheckoutForm.tsx` renders `<form action={formAction}>`, with
`formAction` from `useActionState(placeOrderAction, …)`. In React 19, a function passed to a form's
`action` is followed by an automatic reset of the form's uncontrolled fields once it completes.
That happens on every outcome, including a returned `{ error }`.

**Scope (this slice):**
- `CheckoutForm` gains an `onSubmit` handler:
  - It calls `event.preventDefault()`.
  - It builds `new FormData(event.currentTarget)`.
  - It dispatches `formAction(formData)` inside `startTransition`.
  - A manually dispatched action is not followed by the automatic reset.
- **Kept as they are:**
  - The `action={formAction}` attribute stays, so a browser without JavaScript still posts the
    form.
  - Native `required` validation still runs before `submit` fires.
  - `pending` from `useActionState` still drives the button.
  - A successful order still redirects from inside the server action.
- One component test proves the fields survive a refusal, and that the submitted `FormData` is
  unchanged.

**Deliberately excluded:**
- **Server-side echoing of submitted values** (returning the form back in `CheckoutState`). This is
  not needed once the reset no longer happens.
- **Other forms in the app.** They are left alone unless they show the same defect; none was
  reported.

**Open items carried forward:** none.
