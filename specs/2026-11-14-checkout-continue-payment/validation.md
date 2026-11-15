# Checkout: Continue to payment after leaving Stripe (validation)

> **Testing Strategy (Lean 80/20 Model)**
> Provide enough testing to give confidence without creating unnecessary or duplicate tests. Avoid testing the same behaviour multiple times at different levels unless doing so provides additional confidence.
>
> **The Main Principle:**
> - **Build:** Did we build the component correctly?
> - **Validate:** Does the feature work correctly in the real system?
> - **Release:** Is the complete system safe, reliable, and ready for users?

## Testing Areas

This slice touches **payments**, **order cancellation** and a **customer-facing UI**. It gets:
- unit tests for the resume decision table, both actions' redirect and call-count tables, and the
  port mapping;
- component tests for the choices and the pending button;
- a regression guard (unchanged files, unchanged existing tests);
- a live run under `npm run preview` against Stripe **test** mode.

`npm run dev` cannot load the Prisma WASM engine and must not be used for any live row.

## Setup for the live rows (R28–R35)

1. **Database target.** Test each variable on its own:
   `for v in DIRECT_URL DATABASE_URL; do if printenv "$v" >/dev/null 2>&1; then echo "$v SET host=$(printenv "$v" | sed -E 's#.*@([^:/?]+).*#\1#')"; else echo "$v unset"; fi; done`.
   If either is set to a host other than the dev host in `.dev.vars`, stop.
2. **Stripe test key.** `grep -c '^STRIPE_SECRET_KEY="sk_test' .dev.vars` prints `1`. If not, R28,
   R31–R34 are UNVERIFIED, never passed.
3. Kill any earlier `node`/`workerd` preview chain, then `npm run build` and `npm run preview`.
4. Do not run `stripe listen`. Webhooks must not reach the local preview, so R31 can show the
   no-webhook path.
5. **DB reads** use a read-only Node script against the dev `DIRECT_URL` (`npx tsx` with
   `@prisma/client`, bare specifier). For an order number, select `status`,
   `payment { providerReference }`, the count of `Payment` rows, and `statusEvents { status }`. For
   the shopper's cart, select its `CartItem { productId, quantity, customNote }`.
6. **Stripe reads/writes** use test-mode `curl` with the `.dev.vars` key:
   `curl -s https://api.stripe.com/v1/checkout/sessions/<cs_id> -u "$KEY:"` (read), and
   `curl -s -X POST https://api.stripe.com/v1/checkout/sessions/<cs_id>/expire -u "$KEY:"` (R34
   setup only). In Git Bash, keep the URL as the only path-like argument (CLAUDE.md, path
   rewriting).

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run --maxWorkers=4 tests/payments.test.ts` passes. It asserts the Stripe adapter maps a response `url` to `url`, an absent `url` to `null`, and the stub returns `url: null`. Read `lib/payments.ts`: `RetrievedSession` declares `url: string \| null`. |
| R2  | Unit | `grep -n "export function isPastCheckoutSessionTtl" lib/payments.ts` prints one line. A passing test asserts the TTL − 1 ms / TTL / TTL + 1 ms results. |
| R3  | Unit | `grep -nE '^import ' lib/resume-payment.ts` prints only `import type` lines. |
| R4  | Unit | `npx vitest run --maxWorkers=4 tests/resume-payment.test.ts` passes. Read it: one case per row a–g (g includes `url: null` and an `http://` URL); a and b assert zero `retrieveSession` calls; c's mock throws; one case asserts the argument equals `providerReference`; one case has `status: "expired", paymentStatus: "paid"` → `complete`. |
| R5  | Unit | The facade test passes with mocks for `@/lib/repositories/orders`, `@/lib/tenant`, `@/lib/payments` and `@/lib/db`: `null` → `{ kind: "not-found" }`; a row reaches the decision, and its `retrieveSession` reaches `getPaymentService().retrieveSession`. Read the file: no module-scope client. |
| R6  | Unit | `head -1 features/checkout/resume-payment.ts` prints `"use server";`. `grep -n "^export" features/checkout/resume-payment.ts` prints exactly one `export async function resumePayment(` line. |
| R7  | Unit | Action test: `getByOrderNumber` → `null` makes `resumePayment` throw Next's redirect to `/orders/lookup?orderNumber=<order>`, and the `resume` mock has zero calls. |
| R8  | Unit | Action test covers every R8 outcome for guest `tok-1` and member `""`, asserting the exact string, e.g. `no-session` + guest → `/checkout/AHE-1/cancel?payment=none&t=tok-1`, `provider-error` + member → `/checkout/AHE-1/cancel?payment=unavailable`, `open` → the URL verbatim. Read the file: no `try` around `redirect(`, and no import of any write path (`getOrderCancelService`, cart repository). |
| R9  | Unit | Cancel-action test: access refused → redirect `/cart`, `check` and `cancelUnpaid` mocks have zero calls. A read order with status `CONFIRMED` → same. |
| R10 | Unit | Cancel-action test (e.g. `tests/cancel-order-action.test.ts`) covers all five R10 rows. For each it asserts the redirect string, the `cancelUnpaid` call count (0 or 1), the `addItems` call count (0 or 1), and, where both run, that `check` was called before `cancelUnpaid` (`mock.invocationCallOrder`). |
| R11 | Unit | Same file: the reason argument equals `"Shopper cancelled payment at checkout"`. For a two-line order (one line `quantity: 3, customNote: "ripe ones"`), `addItems` receives lines with those quantities and that note. |
| R12 | Unit | `grep -n "^export" features/checkout/cancel-order.ts` prints only `export async function` lines. |
| R13 | Unit | Pending-button test passes: `pending: false` → button enabled, no `aria-disabled`; `pending: true` → `disabled` and `aria-disabled="true"`. `head -1` of the file is `"use client";`. |
| R14 | Unit | `grep -c '"use client"' components/checkout/UnfinishedPaymentChoices.tsx` prints `0`. Component test asserts hidden `orderNumber`/`t` in every form (`t` is `""` for `token: null`) and one submit button per form. |
| R15 | Unit | Component test: `open` and `past-ttl` each render two forms, in the order **Continue to payment** then **Change my order**, with the mocked `resumePayment` and `cancelOrder` as actions, plus the cancellation explanation. "This payment link may have expired" appears for `past-ttl` only. |
| R16 | Unit | Component test: `expired` and `none` each render their sentence, exactly one form with action `cancelOrder` and button **Put my items back in the basket**, and `queryByText("Continue to payment")` is `null`. |
| R17 | Unit | Component test: `notice: "unavailable"` with `state: "open"` → one `role="status"` containing both phrases, and both buttons still present. `notice: null` → `queryByRole("status")` is `null`. |
| R18 | Unit | `npx vitest run --maxWorkers=4` on the component test file passes. Read the component: no vendor name ("Aheed", "SriMart") and no product word in its copy. |
| R19 | Unit | Read the page: the `metadata` title and the `<h1>` text are "Your payment wasn't finished". |
| R20 | Unit / E2E | Read the page: the `state` and `notice` derivation matches R20 exactly, and no branch maps age to `"expired"`. Live: `?payment=bogus` renders like no parameter. |
| R21 | Unit | Read the page: `<PaymentStatusCheck` with those props is rendered. Live: R31 exercises it. |
| R22 | Regression | `grep -n "keep it and go to my basket" "app/(storefront)/checkout/[orderNumber]/cancel/page.tsx"` prints nothing, and `grep -n '"/cart"'` on the same file prints nothing. Read the JSX (not comments): no `<button>` labelled "Cancel this order" (the label may sit on its own line, so a grep is not enough). |
| R23 | Regression | Live: `/checkout/<a CONFIRMED or CANCELLED order>/cancel?t=<its token>` → `/checkout/<order>?t=…`. `/checkout/<guest order>/cancel` with no token → `/orders/lookup?orderNumber=<order>`. The R28 page shows the order number and total. |
| R24 | Regression | Read the page's imports: from `@/lib/payments` only `isPastCheckoutSessionTtl`; from `@/lib/orders-service` only `getOrderRepository`; `grep -nE "resume-payment-service\|payment-check-service"` on the page prints nothing. |
| R25 | Unit / E2E | Read the page: both components sit inside one `order.status === "PENDING_PAYMENT"` condition before `<OrderProgressTracker`. Live: R33 shows them; a `CONFIRMED` member order's page shows no **Continue to payment**. |
| R26 | Regression | `git diff --stat origin/staging -- app/api/webhooks/stripe/route.ts lib/payment-sweep.ts lib/payment-sweep-service.ts lib/payment-check.ts lib/payment-check-service.ts lib/restore-lines.ts lib/repositories/cart.ts lib/repositories/orders.ts features/checkout/place-order.ts features/checkout/check-my-payment.ts prisma/schema.prisma` prints nothing. `git diff --name-only --diff-filter=A origin/staging -- prisma/migrations` prints nothing. |
| R27 | Regression | `git diff --stat origin/staging --` on the ten listed test files prints nothing. `npx vitest run --maxWorkers=4` on those files plus `tests/payments.test.ts` passes. `git diff origin/staging -- tests/payments.test.ts` shows only added lines, plus `url` added to existing `retrieveSession` expectations. |
| R28 | E2E | Signed out: add an item, check out as a guest, reach `checkout.stripe.com`, and note the `cs_test_…` id in the URL. Use Stripe's back link → `/checkout/<order>/cancel?t=…`, heading "Your payment wasn't finished", both buttons. Press **Continue to payment** → `checkout.stripe.com` with the same `cs_test_…`. DB: `providerReference` equals it, 1 `Payment` row, status `PENDING_PAYMENT`. |
| R29 | E2E | New guest order with two lines, one at quantity ≥ 2 and one carrying a basket note (added before checkout). Leave Stripe via its back link, and press **Change my order** → `/cart` lists the order's items. DB: order `CANCELLED`, and each `CartItem` quantity equals the order line quantity, with the note restored. |
| R30 | E2E | New guest order, back to the cancel page. Open devtools, duplicate the **Change my order** form submission (copy the request as fetch and run it twice, or submit, go Back and resubmit). DB: each `CartItem.quantity` equals the ordered quantity (not doubled); `statusEvents` holds exactly one `CANCELLED`. |
| R31 | E2E | New guest order. Keep the cancel page open in tab A. In tab B, open the same session (`Continue to payment`) and pay with test card `4242 4242 4242 4242`. Confirm no webhook reached preview: DB status still `PENDING_PAYMENT` right after paying. In tab A, press **Change my order** (the page was rendered before the payment) → lands on `/checkout/<order>?t=…` showing "Thanks — your order is confirmed" (refresh once if it shows "Confirming your payment…"). DB: `CONFIRMED`, no `CANCELLED` status event. Repeat once with a fresh order, reloading tab A instead of pressing the button → it ends on the confirmation page by itself. |
| R32 | E2E | Place a guest order with the real test key and reach its cancel page. Stop preview, set `STRIPE_SECRET_KEY="sk_test_invalid"` in `.dev.vars`, and restart preview. Reload the cancel page. **Continue to payment** → `?payment=unavailable` with the `role="status"` notice and both buttons present. **Change my order** → the same, and DB status stays `PENDING_PAYMENT`. **Restore the real key in `.dev.vars` afterwards** and confirm with step 2's grep. |
| R33 | E2E | Sign in as a dev demo shopper, place an order, and leave Stripe via its back link. Open `/account/orders/<order>` → both buttons above the progress tracker. **Continue to payment** → `checkout.stripe.com` with the order's stored `cs_test_…` (DB read). |
| R34 | E2E | New guest order. Expire its session in Stripe test mode with setup step 6's `expire` call, then read it back (`"status": "expired"`). DB still `PENDING_PAYMENT`. On the cancel page, press **Continue to payment** → `?payment=expired`, with the expired sentence and only **Put my items back in the basket**. Press it → `/cart` with the items; DB `CANCELLED`. |
| R35 | Security | On a cancel page, change the **Continue to payment** form's hidden `t` to `wrong` in devtools and submit → `/orders/lookup?orderNumber=<order>`; the network panel shows no response redirecting to `checkout.stripe.com`. |
| R36 | Docs | `grep -n "Continue to payment" docs/shopper-help/shopping-guide.md` includes a line that also names **Change my order**, the basket, and "nothing was charged" for an expired link. |
| R37 | Process | `build-notes.md` names the follow-up issue number; `gh issue view <N>` shows it open with the expire-on-cancel subject. |
| R38 | Gate 4 | `git diff origin/staging -- CHANGELOG.md` shows an entry naming #1589. |
| R39 | Gate 3 | `npm run lint`, `npm run typecheck` and `npm run format:check` each exit 0; `npx vitest run --maxWorkers=4`, run alone, exits 0 with no failed files. CI on the PR is the ground truth. |
