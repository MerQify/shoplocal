# Checkout keeps what the shopper typed when an order is refused (build notes)

Written at the end of Build, before the Clear. This is the one artifact the Clear bets on: the
validating context is fresh and has only the spec, the artifact, and this file.

The worktree is `E:\GitRepositories\aheed-wt-1605` (reused from `#1605`), on branch
`feature/1613-checkout-keeps-fields`, cut from `origin/staging` at `6d4a5194`. The owner asked for
this fix directly ("yes add and fix this", 2026-11-15) after the `#1605` live check showed the
fields clearing.

## What changed and why

- `components/checkout/CheckoutForm.tsx`:
  - A new `submitKeepingFields` `onSubmit` handler calls `preventDefault()`, builds
    `new FormData(event.currentTarget)` and dispatches `formAction(formData)` inside a new
    `useTransition` (`startSubmitTransition`).
  - `action={formAction}` is kept.
  - React 19 runs its automatic form reset only after a form-`action` submission, so a manual
    dispatch leaves the uncontrolled fields untouched.
- `tests/checkout-keeps-fields.test.tsx` (new) covers R2 and R3. **Proved to catch the bug:** with
  `onSubmit` removed, it fails with `recipientName: expected '' to be 'Validation 1613'`.

## Decisions taken during the build

- **A separate transition.** I used a new `useTransition` for submit rather than reusing
  `startMethodTransition`, which belongs to the delivery/collection switch. Sharing it would tie one
  `isPending` to two unrelated actions.
- **No server-side echo of values.** Rejected as unnecessary once the reset no longer happens; see
  `plan.md`.

## Deviations from the spec

None.

## Known-shaky areas

- **The success path.** It redirects from inside the server action (`redirect()` in
  `placeOrderAction`), now dispatched through a transition. That is the standard `useActionState`
  dispatch path, but only R4 and a real order prove the redirect on staging. Check that
  `Continue to payment` with an in-area postcode still reaches Stripe.
- **No-JavaScript fallback.** It relies on the kept `action` attribute and was not exercised here.
