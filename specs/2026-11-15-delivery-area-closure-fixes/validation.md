# Go-live fixes: refuse out-of-area delivery postcodes, stop slot booking on closure days (validation)

> **Testing Strategy (Lean 80/20 Model)**
> Provide enough testing to give confidence without creating unnecessary or duplicate tests. Avoid testing the same behaviour multiple times at different levels unless doing so provides additional confidence.
>
> **The Main Principle:**
> - **Build:** Did we build the component correctly?
> - **Validate:** Does the feature work correctly in the real system?
> - **Release:** Is the complete system safe, reliable, and ready for users?

## Testing Areas

Every feature should have appropriate **Unit** and **Integration** testing, followed by relevant validation testing. Broader testing mainly happens before release. However, testing is risk-based: features involving auth, payments, UI changes, performance-sensitive APIs, databases, or external dependencies require additional relevant testing earlier.

1. **Unit Testing** — every feature; isolated business logic, utilities and components.
2. **Integration Testing** — every feature; the component with its immediate dependencies.
3. **System / End-to-End Testing** — critical user journeys and validation testing.
4. **Regression & Acceptance Testing** — before release, or when changing core flows.
5. **Performance & Resilience Testing** — before release, or for performance-sensitive APIs.
6. **Security & Accessibility Testing** — before release, or earlier for auth, payments or UI changes.

This slice changes checkout (a payment path), so the live rows R7–R9 and R18–R19 are **required**,
not optional.

**Preconditions for the live rows:**
- **Local `npm run preview` is not usable for DB-backed checks** while `#1599` (rejected dev
  database password) is open. The live rows therefore run against **AFC staging**
  (`https://staging.aheedfoodcentre.co.uk`) after the slice is merged to `staging`.
- **Confirm the deploy first:** `curl -s https://staging.aheedfoodcentre.co.uk/api/health` must
  report `commit` equal to the merge commit's short SHA, and `db.ok: true`.
- **R9, R18 and R19 need a staff sign-in** on AFC staging (store admin or platform admin). If none
  is available to the validator, those rows are run by the owner and recorded as owner-run.
- **Never complete a payment in R8.** Leave the Stripe session to expire.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run tests/delivery-eligibility.test.ts --maxWorkers=4` passes. Read the file: a test calls `evaluateDeliveryEligibility({ postcode: "SW1A 1AA", deliveryPrefixes: ["MK"], referenceStatus: "UNVERIFIED", areaCovered: false })` and expects `status: "OUTSIDE_DELIVERY_AREA"`, `deliverable: false`, `verified: false`. |
| R2  | Unit | Same run. Read the file: four tests cover UNVERIFIED+match → `UNVERIFIED`/`deliverable: true`; VALID+match → `DELIVERABLE`/`verified: true`; VALID+no match → `OUTSIDE_DELIVERY_AREA`/`verified: true`; INVALID → `INVALID_POSTCODE`. |
| R3  | Unit | Same run. Read the file: `blocksCheckout(<R1 verdict>)` is expected `true`, and `eligibilityMessage(<R1 verdict>)` is expected to equal `Sorry — we don't deliver to SW1A 1AA yet.` exactly. |
| R4  | Unit | `npx vitest run tests/delivery-refusals.test.ts tests/delivery-refusals-service.test.ts --maxWorkers=4` passes. Read the tests: `refusalRecordFor` yields district `SW1A` for the R1 verdict, and `null` for `INVALID_POSTCODE`, `UNVERIFIED`+deliverable, and `DELIVERABLE`. |
| R5  | Unit | Same run. Read the tests: with `recordDeliveryRefusal` mocked, `recordRefusalIfOutside(<R1 verdict>, "CHECKOUT")` calls it once with district `SW1A` and source `CHECKOUT`; an `INVALID_POSTCODE` verdict produces zero calls. |
| R6  | Unit (read) | Read the header comment and state-model table of `lib/delivery-eligibility.ts` and the header comment of `lib/delivery-refusal.ts`. **Pass:** both state that a well-formed postcode outside the vendor prefixes is refused and counted regardless of reference coverage, and neither still says counting or refusal needs a reference-confirmed postcode. A sentence explaining the old behaviour as history is allowed. |
| R7  | E2E (live) | On AFC staging: add any product to the cart, open `/checkout`, choose **Delivery**, and fill name, email `validation-1605@example.com`, phone `07700900123`, street `1 Test Street`, town `London`, postcode `SW1A 1AA`. Pick any slot, then click **Continue to payment**. **Pass:** the page stays on `/checkout` and shows `Sorry — we don't deliver to SW1A 1AA yet.`; the URL never becomes `checkout.stripe.com`. |
| R8  | E2E (live) | Same form with street `Unit 22 Lloyds Court`, town `Milton Keynes`, postcode `MK9 3EL`, then **Continue to payment**. **Pass:** the browser reaches `checkout.stripe.com` showing an `Order AHE-…` reference. **Do not pay.** Record the order number. |
| R9  | E2E (live, staff) | Signed in as staff on AFC staging, open `/staff/delivery-areas`. **Pass:** the "Districts you turned away" table has a row `SW1A` with count ≥ 1. |
| R10 | Unit | `npx vitest run tests/slot-*.test.ts --maxWorkers=4` passes. Read the new test: weekly slots exist for the weekday; with a closed override for the date, availability returns `[]` for both `DELIVERY` and `COLLECTION`. |
| R11 | Unit | Same run. Read the tests: with override `09:00`–`14:00`, COLLECTION `13:00–15:00` is absent, while `10:00–12:00` and `09:00–14:00` are present. DELIVERY slots are all present. A further test: an override with `closed: false` and a null time removes nothing. |
| R12 | Regression | Same run: every pre-existing test in `tests/slot-*.test.ts` passes. Run `git diff origin/staging...HEAD -- tests/slot-capacity.test.ts tests/slot-cutoff.test.ts tests/slot-booking-cutoff.test.ts tests/slot-grid.test.ts`. **Pass:** it shows only fixture or setup additions (for example an empty override list), with no changed expected values. |
| R13 | Unit | `npx vitest run tests/slot-week-action.test.ts --maxWorkers=4` passes. Read the test: for a requested week with one closed day, that day's entry carries the override label, and the other days carry none. |
| R14 | Unit (component) | `npx vitest run tests/slot-picker-grid.test.tsx --maxWorkers=4` passes. Read the tests: the closed day's column contains `Closed` and the label text, with no `input[type=radio]` in that column; other days keep their radios. In an all-closed week, `No slots available for these dates.` is not rendered. |
| R15 | Unit | `npx vitest run` on the test file that covers `placeOrder` slot checks (the one extended for `#1441`, found with `grep -ln "SLOT_CLOSED" tests`) passes. Read the new test: a closed override for `fulfilmentDate` makes `placeOrder` reject with message `We're closed on that day. Please choose another day.`, and no order create is called. |
| R16 | Unit | Same file. Read the tests: a COLLECTION order whose slot ends after the changed-hours `closeTime` rejects with `That time slot can no longer be booked. Please choose another.`; a DELIVERY order on the same date and slot does not reject for that reason. |
| R17 | Unit / component | Run the tests covering `placeOrderAction` and `SlotPicker` express gating (`grep -ln "isExpress" tests`) with `--maxWorkers=4`; they pass. Read them: the express toggle is absent when today has a closed override, or now is outside today's changed hours. `placeOrderAction` with `isExpress=on` returns the closed message, or `Express collection isn't available right now. Please choose a time slot.`, respectively. |
| R18 | E2E (live, staff) | On AFC staging, as staff, open Staff → Storefront → **Holiday & closure dates**. Add date = today + 3 days, label `Go-live test closure`, **Closed all day**. As a shopper with items in the cart, open `/checkout`. **Pass:** that date's column shows `Closed` and `Go-live test closure` with no selectable slot under **Delivery** and under **Click & Collect**, and the other days show slots. Then remove the override; reload `/checkout`. **Pass:** that date shows slots again. |
| R19 | E2E (live, staff) | As staff, add date = today + 4 days, label `Go-live test hours`, open `09:00`, close `14:00` (not closed). On `/checkout`: under **Click & Collect**, that date has no `18:00 - 20:00` slot; under **Delivery**, that date has its `18:00 - 20:00` slot. **Pass:** both are observed. Remove the override afterwards. |
| R20 | Docs (read) | Read `docs/store-admin-guide/admin-tabs-guide.md`. **Pass:** (a) "Districts you turned away" says it counts postcodes outside the list whether or not the area is recognised, and excludes mistyped ones. (b) The Holiday & closure dates text says a closed day takes no bookings, and changed hours hide collection slots outside them while delivery stays. (c) The fulfilment section's holiday sentence matches the new behaviour. Trace each sentence to R10–R19. |
| R21 | Static | `git diff --name-only origin/staging...HEAD \| grep -E '^prisma/(migrations/\|schema\.prisma)'`. **Pass:** prints nothing. |
| R22 | Static | `git diff --name-only origin/staging...HEAD \| grep -x CHANGELOG.md` prints `CHANGELOG.md`, and the diff adds an entry referencing `#1605`. |
| R23 | Gates | Each of `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run kms:validate` exits 0 when run alone. `npx vitest run --maxWorkers=4`, run alone with no build running beside it, exits 0. CI's quality checks on the PR are green and are the ground truth. |
