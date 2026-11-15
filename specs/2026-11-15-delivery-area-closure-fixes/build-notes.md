# Go-live fixes: refuse out-of-area delivery postcodes, stop slot booking on closure days (build notes)

Written at the end of Build, **before** the Clear. This is the one artifact the Clear bets on: the
validating context is fresh and has only the spec, the artifact, and this file.

**Where the work is.**
- Worktree `E:\GitRepositories\aheed-wt-1605`, on branch `feature/1605-delivery-area-closure-fixes`
  (cut from `origin/staging` at `f6801dcb`).
- Its `node_modules` is a **junction** to the main checkout's. Run `rmdir node_modules` **before**
  `git worktree remove` (memory: worktree removal followed the junction once and emptied the main
  `node_modules`). A junctioned worktree cannot run `npm run preview`.
- Commits: spec `8a4af69e`, build `fdcb4079`, then this build-notes / CHANGELOG commit.

**Owner direction given in this session (2026-11-15).** "You can test these changes after moving
to staging." The live rows (R7–R9, R18, R19) run on AFC staging after the `staging` merge. Under
memory `feedback_pr_merge_needs_user`, a green feature → staging squash needs no further ask;
staging → main does.

## What changed and why

**Part A — delivery area.**
- `lib/delivery-eligibility.ts`: `evaluateDeliveryEligibility` now decides on the vendor's areas
  first. After the `INVALID` early return, `!deliverable` → `OUTSIDE_DELIVERY_AREA`, with
  `verified = referenceStatus === "VALID"`. Otherwise it returns `DELIVERABLE` (VALID) or
  `UNVERIFIED`. So `UNVERIFIED` now only ever means "in the vendor's area, but the reference could
  not confirm the postcode".
- `blocksCheckout`, `eligibilityMessage`, `refusalRecordFor` and `recordRefusalIfOutside` are
  unchanged in logic. They already keyed on `OUTSIDE_DELIVERY_AREA`, so refusal and counting follow
  automatically. That is why the diff is so small.
- The header comment and state-model table were rewritten, including a `#1605` paragraph saying the
  Edinburgh sentence had been documented since `#764` but never implemented.
- `lib/delivery-refusal.ts`: comment only.

**Part B — closures.**
- **New pure module `lib/slot-closure.ts`.** It holds `DayOverride`, `closedDayLabel`,
  `slotFitsOverride(method, slot, override)`, `expressOverrideVerdict(override, hhmm)` and the two
  message constants. It sits beside `lib/slot-cutoff.ts` and follows its pattern: one rule shared by
  the slot list and `placeOrder`.
- **`lib/repositories/fulfilment-slots.ts`.**
  - New `getSlotDayForDate` returns `{ slots, closedLabel }`.
  - `getAvailableSlotsForDate` is now a thin wrapper returning `.slots`, so every existing caller is
    untouched.
  - The vendor query adds `hoursOverrides: { where: { date } }`.
  - A closed override returns early with the label, even when that weekday has no slots. Otherwise
    the bookable filter is `isSlotBookable && slotFitsOverride`.
- **`lib/fulfilment-slots-service.ts`.** New `getSlotDayForVendor`.
- **`features/checkout/slots.ts`.** `getAvailableSlotsForWeek` now uses `getSlotDayForVendor` and
  returns `{ day, slots, closedLabel }` per day. The file is still async-exports-only.
- **`lib/repositories/orders.ts` `placeOrder`.**
  - Inside the transaction, before the existing slot block, it reads
    `tx.vendorHoursOverride.findUnique({ where: { vendorId_date: … } })` whenever
    `input.fulfilmentDate` is set.
  - `closed` → `CheckoutError("STORE_CLOSED", CLOSED_DAY_MESSAGE)`. `STORE_CLOSED` was added to the
    code union.
  - Then, if the slot exists and `!slotFitsOverride(input.fulfilmentMethod, slot, override)` → the
    existing `SLOT_CLOSED` message.
  - Both checks run before the cut-off and capacity checks.
- **`features/checkout/place-order.ts`.** When `isExpress`, it computes today's store-local day and
  wall clock from the vendor profile (`hoursOverrides` already carries `date` as a `YYYY-MM-DD`
  string), then returns the closed or outside-hours message before `createOrder`.
- **UI.**
  - `app/(storefront)/checkout/page.tsx` → `CheckoutForm` → `SlotPicker` pass a new
    `hoursOverrides` prop.
  - `SlotPicker` keeps a `closedByDay` map from the week action. A closed day's header cell shows
    `Closed` plus the label, and its body cells are already `–` (null) with no radio.
  - The empty-state message now shows only when there are no bands **and** no closed day in the
    shown week. A fully closed week renders a header-only table.
  - The Express effect also requires `expressOverrideVerdict(...) === "OK"` for today.
- **Docs.** `docs/store-admin-guide/admin-tabs-guide.md` changes three places:
  - "Districts you turned away" now covers every well-formed postcode outside the list.
  - A new "Holiday & closure dates also control checkout slots" paragraph under the Storefront
    footer text.
  - The fulfilment sentence "there is no one-off or holiday slot" is replaced by one pointing to
    closure dates.
- **Generated files.** `ARTIFACT_INDEX.md` and `app/(admin)/staff/runbook/docs.ts` were regenerated
  by `kms:build-index`, for the new `plan.md` and the guide edit.

**Tests.**
- New:
  - `tests/slot-closure.test.ts` covers R10, R11, R12, R15, R16 and the pure rules.
  - `tests/place-order-express-closure.test.ts` covers the server half of R17.
- Extended:
  - `tests/delivery-eligibility.test.ts` covers R1–R3.
  - `tests/delivery-refusals.test.ts` covers R4.
  - `tests/delivery-refusals-service.test.ts` covers R5.
  - `tests/slot-week-action.test.ts` covers R13.
  - `tests/slot-picker-grid.test.tsx` covers R14 and the browser half of R17.

## Decisions taken during the build

- **Status change, not a new status.** I mapped "unverified and outside the area" to the existing
  `OUTSIDE_DELIVERY_AREA` with `verified: false`. I rejected adding an `UNVERIFIED_OUTSIDE` status,
  because every consumer (block, message, count) already does the right thing for
  `OUTSIDE_DELIVERY_AREA`. `lib/address-lookup-service.ts` maps `valid: eligibility.verified`, so it
  is unaffected: verified was already `false` for these postcodes.
- **Express checks are separate from slots.** An Express order submits no `fulfilmentDate` (its
  hidden input is disabled while Express is on), so `placeOrder` never sees a date for it. The
  Express check therefore lives in `placeOrderAction`, using the profile's `hoursOverrides` rather
  than a new query.
- **Bounds.** Changed-hours collection keeps a slot when `start >= openTime && end <= closeTime`,
  inclusive both ends, as R11 specifies. Express is allowed while `openTime <= now < closeTime`,
  exclusive at close, matching the existing weekly express-schedule comparison in `SlotPicker`.
- **Validation order in `placeOrder`.** The closed-day check runs before the slot lookup, so it
  refuses even when `fulfilmentSlotId` is missing or stale.
- **Closed label placement.** I put it in the column **header** rather than in every body cell. A
  fully closed week has no body rows, so the header is the only place that always exists.
- **Admin-guide sentence about existing orders.** I first wrote "check the orders list for that
  date", then softened it to "review any orders already booked for that date". I have not verified
  that the orders list filters by fulfilment date, so the sentence promises no control.

## Deviations from the spec

- **R12, and the touched test files.**
  - **Pre-existing expectations changed in two tests.**
    - `tests/delivery-eligibility.test.ts` ("is returned when the postcode's area is not
      materialised") used Edinburgh `EH1 1YZ` against the default prefixes `["MK"]`, and expected
      `UNVERIFIED`. That expectation **was** the bug. I gave the test `deliveryPrefixes: ["EH"]`, so
      it still proves the "uncovered but served → UNVERIFIED" case. R12 does not cover that file
      (R12 is about `tests/slot-*.test.ts`), but recording it, because it is a changed expectation
      rather than an addition.
    - `tests/slot-week-action.test.ts` now mocks `getSlotDayForVendor`, because the week action
      calls it instead of `getAvailableSlotsForVendor`. Its assertions were renamed to the new mock,
      with the same expected values. R13 required changing this file. The R12 diff check in
      `validation.md` names only `slot-capacity`, `slot-cutoff`, `slot-booking-cutoff` and
      `slot-grid`, which is consistent.
  - **Fixture addition.** `tests/slot-booking-cutoff.test.ts` got only
    `vendorHoursOverride: { findUnique: async () => null }` in the `placeOrder` tx mock, which R12
    allows.

## Known-shaky areas

- **No DB-backed run of the new Prisma calls.**
  - `include: { hoursOverrides: { where: { date } } }` and
    `tx.vendorHoursOverride.findUnique({ where: { vendorId_date: { vendorId, date } } })` have only
    been typechecked and run against mocks.
  - `vendorId_date` is Prisma's generated name for `@@unique([vendorId, date])` (typecheck accepts
    it).
  - Local `npm run preview` is blocked by `#1599`, and the four live-DB vitest files
    (`slot-capacity`, `concurrency-slot-booking`, `express-sla`, `aheed-stock-import-safeguards`)
    fail locally with "Authentication failed against the database server", identically with this
    change stashed. CI has no `DATABASE_URL`, so it skips them.
  - **R18/R19 on AFC staging are the first real exercise. Look there first.**
  - `placeOrder` runs on `getPrismaWs()` (interactive transaction). The new `findUnique` is a plain
    read inside it, which is fine on that adapter.
- **`@db.Date` equality.** Both the list (`where: { date }`) and `placeOrder` match the override by
  the UTC-midnight `Date` of the store-local day, the same convention `Order.fulfilmentDate` and
  `VendorHoursOverride.date` already use (`#811`, `#1060`). If R18 shows slots on the closed date,
  suspect a date mismatch first.
- **Live checks need a staff sign-in.** R9, R18 and R19 need a staff session on AFC staging. If no
  staging staff account is available, those rows are the owner's.
- **The R7 message comes from the server.** It renders through the checkout action's error state.
  It is unit-tested at the eligibility level only; the end-to-end form path is R7 itself.
- **Not built (deliberately excluded in `plan.md`):** the first-paint "No slots available" flash,
  and orders already booked on a newly closed date. Both are recorded on `#1604` (comment of
  2026-11-15). General server-side checking of the weekly express schedule is `#1607`.
