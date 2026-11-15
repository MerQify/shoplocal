---
id: 2026-11-15-weekly-hours-slots-plan
title: "Weekly opening hours control checkout slots (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1615. The weekly Opening hours now gate slots with the #1605 rules: a weekly closed day offers no slot, opening hours trim collection, and a dated holiday entry still wins for its date."
tags: [checkout, slots, go-live]
related: [sdd-workflow]
---

# Weekly opening hours control checkout slots (plan)

Issue `#1615`, a follow-up to `#1605`, for go-live (`#1344`). On AFC staging (2026-11-15) the owner
ticked Wednesday **Closed all day** in Staff → Storefront → **Opening hours**, and checkout still
offered Wednesday Click & Collect slots. `#1605` wired only the dated **Holiday & closure dates**
(`VendorHoursOverride`). The weekly hours (`VendorWeeklyHours`) still reached only the footer.

**Goal:** the shop's own weekly hours decide which days and times can be booked, exactly as a dated
entry does.

**The owner's decision (2026-11-15): same rules as the dated entries.**

**Scope (this slice):**

- **`lib/slot-closure.ts`.** Add `effectiveDayHours(dated, weekly)`. The dated override wins when
  present. Otherwise the weekday's `VendorWeeklyHours` row becomes a `DayOverride`:
  - `closed` gives a closed day labelled `Closed every <Weekday>`;
  - both times set gives changed hours;
  - neither has no effect.

  Every existing rule (`slotFitsOverride`, `closedDayLabel`, `expressOverrideVerdict`) then applies
  unchanged.
- **The slot list** (`getSlotDayForDate`) also reads the weekday's weekly row.
- **`placeOrder`** reads the weekly row when there is no dated override.
- **The Express gates.** `placeOrderAction` uses the profile's `weeklyHours`, and `SlotPicker` takes
  a `weeklyHours` prop passed down from the checkout page.
- The store admin guide and the CHANGELOG are updated.

**No schema change.**

**Deliberately excluded:**

- **Already-booked orders on a newly closed weekday.** Same as `#1605`, tracked on `#1604`.
- **A per-method "collection hours" setting**, separate from the shop's hours. Not asked for.

**Visible effect on AFC staging and production:** Sunday closes at 19:00, so the Sunday
`18:00`–`20:00` collection slot disappears, while the delivery one stays. That is intended under the
owner's rule. The owner was told at Propose.

**Open items carried forward:** none.
