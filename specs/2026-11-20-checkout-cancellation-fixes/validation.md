# Checkout and cancellation fixes (validation)

> **Testing Strategy (Lean 80/20 Model)**
> Most of this is pure logic (minimum table, wording table, escaping, request shapes), covered by
> unit tests with the payment service and fetch mocked. Three things need a real system:
> - the refusal leaving no rows, which runs against a real Postgres (PGlite or dev Neon, per the
>   existing `placeOrder` tests);
> - the migration;
> - the staff form plus the email on staging.
>
> Stripe's live behaviour is not exercised here. The sub-30p refusal no longer reaches Stripe, and
> `expireSession` is checked against test mode on staging.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | The new `lib/payments` tests pass. Stripe `minimumAmount("GBP")` returns 30, `("gbp")` returns 30, `("eur")` and `("usd")` return 50, `("jpy")` returns `null`, and the stub returns `null` for `gbp`. |
| R2  | Integration | A `placeOrder` test for a 29p basket against a real Postgres, with GBP and a Stripe-like service whose minimum is 30, throws `CheckoutError` with code `BELOW_PAYMENT_MINIMUM` and message `Card payments need a total of at least £0.30.`. Afterwards no `Order` row exists for that cart, the product's stock is unchanged, the cart still has its line, and the mocked `createPayment` was called 0 times. |
| R3  | Integration | The same test file: a 30p basket is not refused by R2. It proceeds to `createPayment`, which is called once. |
| R4  | Unit | A test of the checkout action or page mapping shows `BELOW_PAYMENT_MINIMUM` rendered through the same error element as `BELOW_MINIMUM`, by role or test id. |
| R5  | Unit | A `placeOrder` test with `createPayment` throwing `PaymentProviderError("Stripe session creation failed: 400 {…amount_too_small…}")`: `console.error` (spied) receives a first argument starting `[payments] createPayment failed for order `; the `ErrorEvent` recorder (spied or real) receives a message starting `[payments] createPayment failed` and containing `amount_too_small`; and the thrown error is `PAYMENT_PROVIDER_FAILED` with its existing text. `npx vitest run tests/repository-purity.test.ts tests/repository-client-injection.test.ts` passes. |
| R6  | Unit | The same setup with the `ErrorEvent` recorder rejecting: the thrown error is still `PAYMENT_PROVIDER_FAILED`. |
| R7  | Unit | With `fetch` mocked, Stripe `expireSession("cs_test_a/b")` calls `POST https://api.stripe.com/v1/checkout/sessions/cs_test_a%2Fb/expire` with `Authorization: Bearer <key>` and `Stripe-Version: 2025-09-30.clover`. A 404 response makes it reject with `PaymentProviderError` (status 404). The stub resolves `undefined` and calls no `fetch`. |
| R8  | Unit | `cancelOrder` tests with services mocked. (a) On the `not-paid` branch with `cancelUnpaid` truthy and a provider reference `cs_1`, `expireSession` is called once with `cs_1`. (b) Same with `expireSession` rejecting: the redirect destination equals case (a)'s, and the cart restore still ran. (c) On `confirmed`, `provider-error`, and `not-paid` with `cancelUnpaid` returning null, `expireSession` is not called. **Live:** on staging (Stripe test mode), start a checkout, return via Stripe's back link, and cancel. Then in the Stripe test dashboard that session's status is `expired`. |
| R9  | Unit | `grep -nE "^export (const\|let\|function [^a]\|class)" features/checkout/cancel-order.ts` prints nothing, and `npx vitest run` covers it with the existing `use server` export test if present. |
| R10 | Integration | `ls prisma/migrations \| tail -1` is the new folder. Its `migration.sql` header explains the hand-authoring, and `grep -nE "DROP\|trgm" <that file>` prints nothing. `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <dev shadow>` prints an empty migration (or, without a shadow database, `npx prisma validate` exits 0 and the SQL's column and enum names match `schema.prisma` by eye). CI's migrate step on staging applies it. |
| R11 | Unit | A render test of the staff order page's cancel form, or its extracted component, shows both radio groups with the exact option labels, each radio `required`, the textarea with `name="customerMessage"`, `maxLength=1000` and no `required`. The textarea is hidden until `Write my own message` is chosen. The "not shown to the customer" sentence is present. |
| R12 | Unit | `cancelOrderStaff` tests. A missing or invalid radio value means `cancelConfirmed` is not called. A 1001-character message is refused. Valid input passes the reason, both enums and the trimmed message (or `null` when the choice is not `CUSTOM` or the text is blank) to the persisted event. A repository-level test asserts the created `OrderStatusEvent` row has those three columns set and `note` equal to the internal reason. |
| R13 | Unit | One test per table row in a `next-step` test file, asserting the exact string. Also a `grep`-style assertion that none of the strings contains a vendor or product name, using the existing copy-guard test if it covers this file. |
| R14 | Unit + E2E | Unit: `buildCustomerEmail` for CANCELLED with `CUSTOMER_REQUEST`/`REFUNDED` contains R13's first-row text, and with no choices contains `CANCELLED_NEXT_STEP`; `OrderProgressTracker` rendered with the same inputs shows the same texts. **Live (staging):** as a store admin, cancel a confirmed test order choosing Customer asked + Refunded in full. The email received and `/account/orders/<n>` both show the first-row text, and the internal reason appears in neither. |
| R15 | Unit | `buildCustomerEmail` with a custom message `<a href="x">y</a> & "q"` produces HTML containing `&lt;a href=&quot;x&quot;&gt;y&lt;/a&gt; &amp; &quot;q&quot;` and no `<a href="x">`. The text part contains the message verbatim. `grep -n dangerouslySetInnerHTML components/orders/OrderProgressTracker.tsx` prints nothing. |
| R16 | Unit | With `fetch` mocked, the Telegram channel's `send` posts a JSON body whose parsed value has `link_preview_options` deep-equal to `{ "is_disabled": true }`, plus `chat_id` and `text`. **Live:** the next staging Telegram alert shows no preview card. |
| R17 | Docs | `grep -n "Who asked\|Refunded in full\|not shown to the customer" docs/staff-playbook/*.md` finds the new sentences in the guide that documents `/staff/orders`. Each matches an R11 control. |
| R18 | Unit | The tests named in R1–R16 exist and pass: `npx vitest run --maxWorkers=4` on the changed test files. |
| R19 | Docs | `git diff origin/staging -- CHANGELOG.md` shows an entry naming #1690, #1691 and #1693. |
| R20 | Regression | `npm run lint && npm run typecheck && npm run format:check && npx vitest run --maxWorkers=4 && npm run build` all exit 0. CI `gates` on the PR is green. |
