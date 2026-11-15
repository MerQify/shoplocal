# Go-live fixes: refuse out-of-area delivery postcodes, stop slot booking on closure days (requirements / acceptance criteria)

Closes `#1605`. Builds on `#764` (delivery eligibility), `#889` (refusal counts), `#1060` (holiday
and closure dates) and `#1441` (slot booking cut-off). In one line: checkout refuses delivery to any
well-formed postcode outside the store's delivery prefixes, even where the reference database holds
no data. Every such refusal is counted by district. A closed day offers and books no slots, and a
changed-hours day offers and books only collection slots inside those hours. `plan.md` has the
reasoning.

Terms used below:
- **Vendor prefixes:** the store's `VendorDeliveryArea` prefixes, as passed to
  `evaluateDeliveryEligibility` in `deliveryPrefixes`.
- **Closed override:** a `VendorHoursOverride` row with `closed = true` for a date.
- **Changed-hours override:** a row with `closed = false` and both `openTime` and `closeTime` set.
- All dates are the store-local calendar day, the existing `#811` convention.

## Part A — delivery area

R1. `evaluateDeliveryEligibility` returns `status: "OUTSIDE_DELIVERY_AREA"`, `deliverable: false`,
    `verified: false` when `referenceStatus` is `"UNVERIFIED"` and the postcode does not match any
    vendor prefix. A unit test in `tests/delivery-eligibility.test.ts` asserts this for `SW1A 1AA`
    against prefixes `["MK"]`.

R2. The other verdicts are unchanged, each asserted by a unit test in the same file:
    - `UNVERIFIED` matching a vendor prefix → `status: "UNVERIFIED"`, `deliverable: true`.
    - `VALID` matching → `DELIVERABLE`, `verified: true`.
    - `VALID` not matching → `OUTSIDE_DELIVERY_AREA`, `verified: true`.
    - `INVALID` → `INVALID_POSTCODE` whatever the prefixes.

R3. `blocksCheckout` returns `true` for the R1 verdict, and `eligibilityMessage` returns exactly
    `Sorry — we don't deliver to SW1A 1AA yet.` for it. Both are asserted by unit tests.

R4. `refusalRecordFor` returns `{ district: "SW1A", day }` for the R1 verdict. It returns `null` for
    `INVALID_POSTCODE`, for `UNVERIFIED` with `deliverable: true`, and for `DELIVERABLE`. Asserted by
    unit tests in `tests/delivery-refusals.test.ts` or `tests/delivery-refusals-service.test.ts`.

R5. `recordRefusalIfOutside` calls `recordDeliveryRefusal` once with district `SW1A` and the given
    source (`"CHECKOUT"`, `"HEADER"`) for the R1 verdict. It makes no call for an `INVALID_POSTCODE`
    verdict. Asserted by a unit test with the repository mocked.

R6. The comments in `lib/delivery-eligibility.ts` (the state-model table) and `lib/delivery-refusal.ts`
    describe the new rule: a well-formed postcode outside the vendor prefixes is
    `OUTSIDE_DELIVERY_AREA` whether or not the reference database covers its area, and is counted.
    No sentence in either file still states that only reference-confirmed postcodes are counted or
    refused. Checked by reading both comment blocks.

R7. **AFC staging, live.** Checkout with **Delivery**, address postcode `SW1A 1AA`, a slot chosen
    and valid contact details shows `Sorry — we don't deliver to SW1A 1AA yet.` on the checkout
    page. The browser does not navigate to `checkout.stripe.com`.

R8. **AFC staging, live.** Checkout with **Delivery** and postcode `MK9 3EL` (the store's own
    address, inside its areas) reaches `checkout.stripe.com` with an `AHE-` order reference. The
    payment is not completed; the session is left to expire.

R9. **AFC staging, live.** After R7, `/staff/delivery-areas` → "Districts you turned away" lists
    district `SW1A` with a count of at least 1 in the last 30 days.

## Part B — closure days and changed hours

R10. For a date with a closed override, slot availability (`getAvailableSlotsForDate`, or the
     helper it delegates to) returns no slots for `DELIVERY` and for `COLLECTION`, even though
     weekly slots exist for that weekday. Asserted by a unit test.

R11. For a date with a changed-hours override `09:00`–`14:00`:
     - a `COLLECTION` slot `13:00`–`15:00` is not returned;
     - a `COLLECTION` slot `10:00`–`12:00` is returned;
     - a `COLLECTION` slot `09:00`–`14:00` is returned (bounds inclusive);
     - every `DELIVERY` slot for that weekday is returned unchanged.

     Asserted by unit tests. A further test asserts that an override with `closed = false` and a
     null `openTime` or `closeTime` removes no slots.

R12. A date with no override returns exactly the slots it returned before this slice. The existing
     `tests/slot-*.test.ts` pass unchanged, apart from fixture additions needed to supply an empty
     override list.

R13. The week slot action (`getAvailableSlotsForWeek` in `features/checkout/slots.ts`) returns, for
     each requested day, the closure label when that day has a closed override, and no label
     otherwise. Asserted by a test in `tests/slot-week-action.test.ts`.

R14. `SlotPicker` renders a closed day's column with the text `Closed` and the override label (for
     example `Christmas Day`), and renders no slot radio input in that column. Every other day's
     slots render as before. Asserted by a component test in `tests/slot-picker-grid.test.tsx`.
     A week in which every day is closed shows the closed columns, not the
     `No slots available for these dates.` message.

R15. `placeOrder` rejects an order whose `fulfilmentDate` has a closed override. It throws a
     `CheckoutError` with message `We're closed on that day. Please choose another day.` and creates
     no `Order` row. Asserted by a unit test. The checkout page shows that message to the shopper
     (the existing `CheckoutError` → form error path).

R16. `placeOrder` rejects a `COLLECTION` order whose slot falls outside that date's changed-hours
     override (rule as in R11). It uses the existing `SLOT_CLOSED` message
     `That time slot can no longer be booked. Please choose another.` A `DELIVERY` order on the same
     date and slot is accepted. Both are asserted by unit tests.

R17. Express collection follows the same rules:
     - **Browser:** the express toggle is not shown when today (store-local) has a closed override,
       or when the current store-local time is outside today's changed-hours override.
     - **Server:** `placeOrderAction` refuses an `isExpress` order in either case, with
       `We're closed on that day. Please choose another day.` for a closed day and
       `Express collection isn't available right now. Please choose a time slot.` for outside
       changed hours. No order is created.

     Both are asserted by unit or component tests.

R18. **AFC staging, live.**
     1. A staff user adds a closed override labelled `Go-live test closure` for a date within the
        next 6 days (Staff → Storefront → Holiday & closure dates).
     2. With items in the cart, `/checkout` shows that date's column as `Closed` with the label and
        no selectable slot, for both **Delivery** and **Click & Collect**. The other days show their
        usual slots.
     3. The override is then removed, and that date's slots reappear.

R19. **AFC staging, live.**
     1. A staff user adds a changed-hours override `09:00`–`14:00` labelled `Go-live test hours` for
        a date within the next 6 days.
     2. On `/checkout` that date offers no **Click & Collect** slot ending after `14:00` (the
        `18:00`–`20:00` slot is absent). **Delivery** on that date still offers its `18:00`–`20:00`
        slot.
     3. The override is then removed.

## Docs, change control, gates

R20. `docs/store-admin-guide/admin-tabs-guide.md` states:
     - (a) under "Districts you turned away", that the table counts postcodes outside the store's
       list whether or not the platform recognises the area, and still excludes mistyped
       postcodes;
     - (b) under Holiday & closure dates, that a closed day takes no delivery or collection
       bookings, and that changed hours hide collection slots outside those hours while delivery
       slots stay;
     - (c) in the fulfilment section, no longer the sentence that there is "no one-off or holiday
       slot" without saying that closure dates now close slots.

     Each capability sentence traces to the R10–R19 behaviour.

R21. No schema change: `git diff --name-only origin/staging...HEAD` lists no file under
     `prisma/migrations/` and does not list `prisma/schema.prisma`.

R22. `CHANGELOG.md` updated (Gate 4).

R23. `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=4`, `npm run format:check`
     and `npm run kms:validate` all remain green after this slice.
