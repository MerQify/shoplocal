# Checkout recovery: staff-controlled abandoned-basket recovery (build notes)

Built in the worktree `E:\GitRepositories\aheed-1730` (its own `npm ci`, not a junction) on
`feature/checkout-recovery`, branched from `origin/staging` at `815f17d0` (slice A merged).

## What changed and why

- **Schema + migration (R1-R3).** `CheckoutRecoveryStatus`, `CheckoutRecoveryEventKind`,
  `CheckoutRecovery` (unique `orderId`; relations named `RecoveryOfOrder` / `RecoveryResultOrder`
  because `Order` is referenced twice), `CheckoutRecoveryEvent`; `DiscountKind.FREE_DELIVERY`;
  `DiscountCode.restrictedToUserId` (Cascade) and back-relations on User/Vendor/Order.
  `prisma/migrations/20261122140000_checkout_recovery/` is Prisma's `migrate diff` DDL, reordered:
  create tables → copy `AbandonedCheckoutReminder` rows (`INSERT … SELECT`, recovery keeps the
  reminder's id; event id via `gen_random_uuid()`) → `DROP TABLE`. The three explicit
  `DROP CONSTRAINT` lines were removed (the table's FKs go with it), so the file has exactly one
  `DROP`.
- **Rules (pure).** `lib/abandoned-checkout/recovery.ts`: `RECOVERABLE_ORIGINS`, derived
  `effectiveRecoveryStatus` (EXPIRED never written), `lineAvailability` (TRACKED stock only),
  `qualifyingBundles`, `checkIncentive`. `lib/abandoned-checkout/token.ts`: Web Crypto token +
  SHA-256 hex. `eligibility.ts`: `reminderBlock` gains `suppressed`/`recovered`, counts
  `emailCount`, and takes `{ confirmResend }`; `ABANDONED_NOTE_PREFIX` removed.
- **Repository** `lib/repositories/abandoned-checkouts.ts` rewritten: listing by origin with lines
  (product, current `basePrice`, stock, first image) and the recovery; `ensureRecovery` (upsert,
  first staff action only); `transitionRecovery`, `allocateRecoveryIncentive`,
  `removeRecoveryIncentive`, `claimRecoverySend`, `recordRecoveryRestored` all on the WebSocket
  client inside `$transaction` (every `updateMany` per CLAUDE.md); `markRecoveredInTransaction` for
  `confirmPayment`.
- **Discounts (R12-R14).** `evaluateCode`: customer lock checked after start/expiry/usage (guest →
  `SIGN_IN_REQUIRED`, other user → `RESTRICTED_TO_ANOTHER_CUSTOMER`); `FREE_DELIVERY` = delivery fee
  capped by min-payable headroom, `DELIVERY_ONLY` when the fee is 0; the minimum spend applies
  first. Repo select passes `restrictedToUserId`. Kind labels in `DiscountCodesPanel`,
  `PromotionForm`, discount-templates export; widened unions in five files.
- **Email.** Layout item rows take an optional `imageUrl` (rendered only when `https://`, so every
  other email is unchanged). `buildRecoveryEmail`: current prices, "No longer available" note,
  locked `NOT_CHARGED_SENTENCE` paragraph, button → restore link, `codeBenefit` "free delivery".
- **Send/preview** `lib/abandoned-checkout/remind.ts`: `recoveryEmailFor` is the single builder;
  `previewRecoveryEmail` (no claim, placeholder link) and `sendRecoveryEmail` (eligibility → code →
  `ensureRecovery` → fresh token → CAS claim → send).
- **Service** `lib/abandoned-checkouts-service.ts`: page view (`toView`), the five staff actions,
  `findRecoverableByToken` (malformed/unknown/other vendor/expired/suppressed/recovered → null),
  `recordRestore`. Store codes exclude other customers' personal codes.
- **Staff UI.** `app/(admin)/staff/abandoned-checkouts/`: server-rendered list with plain forms;
  actions redirect back with `?msg`/`?err`; preview is a GET (`?preview=&code=`) rendered in a
  `sandbox=""` iframe. `/staff/orders` "Show unpaid checkouts" line links here.
- **Restore.** `app/(storefront)/recover/[token]/page.tsx` (read-only, `noindex`) +
  `features/checkout/restore-recovery.ts` (re-proves the token, `restoredLines` into the visitor's
  cart, records RESTORED, redirects `/cart?restored=recovered[&lines…]&code=`). New
  `RestoreSource "recovered"`; the cart shows a code reminder only for the code's own shape.
- **Recovered (R22).** `confirmPayment` calls `markRecoveredInTransaction` after earn/referral,
  guarded by `"checkoutRecovery" in tx` for older test doubles.
- **Docs.** Admin guide section rewritten; shopper guide basket-reminder line; staff guide
  notification row; CHANGELOG.
- **Tests.** `tests/abandoned-checkout.test.ts` rewritten (41); new `tests/checkout-recovery.test.ts`
  (38); `tests/page-container.test.ts` registers the recover page. Full suite: 520 files, 7397 tests.

## Decisions taken during the build

- **Staff UI is server forms, not the old client component** (`useActionState`): no client JS,
  shareable preview URL, results via redirect query. Messages are plain text from the service.
- **"Bought later"** counts paid (REVENUE_STATUSES) orders by the same signed-in customer created
  after the abandonment, within the 30-day listing window.
- **Incentive code text** `BACK-` + 8 characters from an unambiguous alphabet; collision would hit
  the `(vendorId, code)` unique and fail the action (not retried — astronomically unlikely).
- **Restore adds to the visitor's current cart** (signed in or not); no sign-in is forced. The
  incentive itself is customer-locked, so a forwarded link restores items but the code still only
  works for its customer.
- **Basket "total" in the email/restore page = goods at today's prices** (available lines only),
  not including delivery, which depends on the slot chosen at checkout.
- `findRecoverableByToken` treats RECOVERED as expired for the link (the job is done).

## Deviations from the spec

- **R18 duplicate-send test** uses a transaction double that models the compare-and-set, not a real
  database; the real CAS is exercised by validation on staging (R25).
- **R20 "GET changes nothing"** is enforced structurally (the page imports only
  `findRecoverableByToken`, a read) rather than by a dedicated test.
- **R5 current price** is the product's `basePrice`; promotions/tiered prices still apply at
  checkout, so the cart can show a lower price than the page — never higher.

## Known-shaky areas

- **Not run against a real database yet.** The migration's `INSERT … SELECT` + `DROP`, the nested
  relation filters (`order: { userId }`, `checkoutRecovery: { is: { tokenHash } }`) and the
  WebSocket transactions are unit-tested with doubles only. Staging (CI-applied migration) is where
  R25 checks them; dev sign-ins are unavailable.
- **Email images** depend on `CDN_BASE_URL` being `https://` on the Worker; otherwise no images.
- **`ALTER TYPE "DiscountKind" ADD VALUE`** inside Prisma's migration transaction is allowed on
  Postgres ≥ 12 as long as the value isn't used in the same transaction (it isn't).
- Admin discount-code create form does not offer FREE_DELIVERY (only recovery incentives use it);
  existing codes list renders it if one appears.
