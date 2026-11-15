# Weekly opening hours control checkout slots (build notes)

Written at the end of Build, before the Clear. This is the one artifact the Clear bets on: the
validating context is fresh and has only the spec, the artifact, and this file.

Worktree `E:\GitRepositories\aheed-wt-1605`, on branch `feature/1615-weekly-hours-slots`, cut from
`origin/staging` at `dde7eacc`. The owner reported the gap with a screenshot (Wednesday weekly
**Closed all day**, Wednesday collection still offered), then chose "Same rules" at Propose
(2026-11-15).

## What changed and why

- **`lib/slot-closure.ts`.** Adds `WeeklyDayHours` and `effectiveDayHours(dated, weekly)`.
  - The dated `VendorHoursOverride` wins when present.
  - Otherwise the weekday's `VendorWeeklyHours` row becomes a `DayOverride`. A closed row gives the
    label `Closed every <Weekday>`, and a row with both times gives `Opening hours`. A row with
    neither returns `null`.
  - Every existing rule then applies unchanged.
- **`lib/repositories/fulfilment-slots.ts`.** `getSlotDayForDate` also includes
  `weeklyHours: { where: { dayOfWeek } }`, and feeds both rows to `effectiveDayHours`.
- **`lib/repositories/orders.ts` `placeOrder`.** When there is no dated row, it reads
  `tx.vendorWeeklyHours.findUnique({ where: { vendorId_dayOfWeek: … } })`, using
  `fulfilmentDate.getUTCDay()`. That is safe because the date is the store-local day's UTC midnight.
- **Express gates.**
  - `features/checkout/place-order.ts` uses the profile's `weeklyHours` with the vendor wall clock's
    `dayOfWeek`.
  - `SlotPicker` takes a new `weeklyHours` prop, passed through from
    `app/(storefront)/checkout/page.tsx` via `CheckoutForm`.
- **Tests.**
  - `tests/slot-closure.test.ts` adds a `#1615` block (R1–R4) and two `placeOrder` cases (R5).
  - `tests/place-order-express-closure.test.ts` and `tests/slot-picker-grid.test.tsx` add the Express
    cases (R6).
  - `tests/slot-booking-cutoff.test.ts` gets the fixture
    `vendorWeeklyHours: { findUnique: async () => null }`.
- **Docs.** The store admin guide gains a paragraph on usual Opening hours controlling slots (R8).

## Decisions taken during the build

- **Label for a changed-hours row from the weekly hours: `Opening hours`.** It is never shown,
  because only closed days display a label.
- **Closed label text: `Closed every Wednesday`.** It is shown under `Closed` in the grid header, so
  that column reads "Closed / Closed every Wednesday". It is slightly repetitive, but it
  distinguishes a usual day off from a named holiday. A shorter label is a cheap copy change if the
  owner prefers one.

## Deviations from the spec

None.

## Known-shaky areas

- **Only typechecked and mocked.** `weeklyHours: { where: { dayOfWeek } }` and the
  `vendorId_dayOfWeek` compound-unique lookup have not been run against a real database. R7 on AFC
  staging is the first real exercise. Local DB testing is blocked by `#1599`.
- **R7 depends on staging data.** It relies on Wednesday being saved as weekly Closed all day on AFC
  staging. The owner's screenshot shows the box ticked, but not whether the form was saved.
