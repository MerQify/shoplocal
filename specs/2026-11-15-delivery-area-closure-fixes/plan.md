---
id: 2026-11-15-delivery-area-closure-fixes-plan
title: "Go-live fixes: refuse out-of-area delivery postcodes, stop slot booking on closure days (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1605. Checkout refuses delivery postcodes outside the store's areas even without reference data, and counts every such refusal; holiday closures block slot booking, and changed hours trim collection slots."
tags: [checkout, delivery, slots, go-live]
related: [sdd-workflow, architecture]
---

# Go-live fixes: refuse out-of-area delivery postcodes, stop slot booking on closure days (plan)

Issue `#1605`, part of the Aheed Food Centre go-live (`#1337`, checklist `#1344`). Both defects were
found during the AFC staging go-live checks on 2026-11-15.

**Goal:** before real orders, a shopper cannot pay for a delivery the store does not make, and
cannot book a slot on a day the store has said it is closed. The store also sees **every**
turned-away delivery district, so it can decide where to expand.

## Why each part exists

### 1. Out-of-area delivery postcodes reach payment

On AFC staging, a delivery order to `SW1A 1AA` (London) passed checkout and reached
`checkout.stripe.com`. That was unpaid test order `AHE-20261115-8B9EMM`, left to expire.

`evaluateDeliveryEligibility` (`lib/delivery-eligibility.ts`) answers `UNVERIFIED` whenever the
reference database has not materialised the postcode's area. The AFC reference data holds only `MK`
and `RG` (`/api/health` → `reference.requiredAreas`), so that covers every postcode elsewhere.
`blocksCheckout` never blocks `UNVERIFIED`, even when the postcode is not in the vendor's own
delivery prefixes (`deliverable: false`).

The file's own header says the opposite: vendor delivery areas need no reference data, "which is
why an environment with no reference database still refuses an out-of-area postcode correctly". Its
Edinburgh example says such a shopper is "refused only if their vendor does not deliver there". The
code never implemented that sentence.

**The fix keeps `UNVERIFIED`'s purpose intact.** That purpose is that an infrastructure gap never
rejects a postcode the store **does** serve, and never calls an address "invalid". The change is
narrow: once the postcode is well formed (the reference service answers `INVALID` for malformed
input without touching any database), a postcode outside the vendor's prefixes is
`OUTSIDE_DELIVERY_AREA` whatever the reference status. `verified` stays `false` in that case,
because the reference database did not confirm the postcode exists.

This one change makes the three downstream consumers right with no edits of their own:
- `blocksCheckout` refuses it.
- `eligibilityMessage` says "Sorry — we don't deliver to … yet."
- The `#889` refusal tally starts counting it.

The header badge and the fulfilment default already read `deliverable`, so they keep agreeing with
checkout (`#764`'s whole point).

**Refusal analytics (owner request at Propose).** `recordRefusalIfOutside` and `refusalRecordFor`
count only `OUTSIDE_DELIVERY_AREA`. Before this slice, that meant only postcodes inside MK/RG were
counted, which is the least useful data: the districts the store most wants to see (Bedford,
Northampton, London) were silently dropped. After the change they are counted by district on
`/staff/delivery-areas`, "Districts you turned away".
- **Malformed postcodes stay uncounted.** They are typos, not demand, and they are still
  `INVALID_POSTCODE`.
- The table still holds no personal data: only the district and day are stored.

### 2. Holiday closures do not stop slot booking

`VendorHoursOverride` (`#1060`) lets a store record a dated closure ("Closed all day") or changed
hours from Staff → Storefront. The footer shows them. `getAvailableSlotsForDate`
(`lib/repositories/fulfilment-slots.ts`) never reads them, so Christmas Day still offers delivery
and collection slots, and `placeOrder` (`lib/repositories/orders.ts`) books them.

**The owner's rules, decided at Propose:**
- **Closed day:** no delivery, collection or express slots. The checkout grid shows the day as
  closed, with the override's label (for example "Christmas Day"). Shoppers book the next open day;
  the grid already shows the following days and pages forward, so nothing new is needed for that.
- **Changed hours** (an override with `closed = false` and both times set): **collection** slots
  that fall outside the day's changed opening hours are not offered. **Delivery** slots stay as
  scheduled, because drivers can deliver after the shop shuts. Express collection is offered only
  inside the changed hours.
- **Enforced twice.** Enforced in the slot list, and again at order placement. A grid loaded before
  the store saved the closure, or a direct server-action call, cannot book the day. This mirrors how
  `#1441`'s cut-off is enforced in both places.

"Falls outside" means: a collection slot is offered on a changed-hours day only when its
`startTime` is not before the override's `openTime` **and** its `endTime` is not after its
`closeTime`. An override with `closed = false` and a missing time trims nothing.

## Scope (this slice)

- `lib/delivery-eligibility.ts`: verdict change and an updated state-model comment.
- `lib/delivery-refusal.ts`: comment update. Its logic already keys on `OUTSIDE_DELIVERY_AREA`.
- Slot availability and placement:
  - `lib/repositories/fulfilment-slots.ts`, plus a pure closure/trim helper beside `lib/slot-cutoff.ts`.
  - `lib/repositories/orders.ts` (`placeOrder`) and `features/checkout/place-order.ts`.
  - `features/checkout/slots.ts`: the week action carries a per-day closure label.
  - `components/checkout/SlotPicker.tsx`: closed-day column, and express gating.
  - `lib/slot-grid.ts` only if the grid builder needs the closure.
- Tests beside the existing ones (`tests/delivery-eligibility.test.ts`,
  `tests/delivery-refusals*.test.ts`, `tests/slot-*.test.ts`, `tests/slot-picker-grid.test.tsx`).
- `docs/store-admin-guide/admin-tabs-guide.md`:
  - "Districts you turned away" now covers postcodes the reference data does not hold.
  - Holiday & closure dates now block or trim slots.
  - The fulfilment section's "there is no one-off or holiday slot" sentence is corrected.
- `CHANGELOG.md`.

**No schema change, no migration.** Every table used here already exists.

## Deliberately excluded

- **Orders already booked on a date later marked closed.** The store is not warned, and the orders
  are not moved. Noted on `#1604`. Staff see them in the orders list as before.
- **Changed hours trimming delivery slots.** The owner chose collection only.
- **A closure-specific capacity, or one-off extra slots on a holiday.** That is `#1604`'s territory.
- **The "No slots available" flash before the first slot fetch completes** (`SlotPicker` renders the
  empty state while `isPending` is still false on first paint). Minor UX, seen during the go-live
  check. It misled the first reading, but it is not a defect in either rule here, so it is left for
  `#1604` or a polish slice.
- **Importing reference postcode data beyond MK/RG.** Not needed once the vendor's own prefixes
  decide refusal. The reference data still adds "is this postcode real" inside covered areas.
- **Express server-side schedule validation in general.** Today express availability is checked
  only in the browser against `VendorExpressSchedule`. This slice adds the server refusal for
  closure and changed-hours days only. It does not add a general server check of the weekly express
  schedule.

## Open items carried forward

- Local DB-touching validation (`npm run preview`) is blocked by the rejected dev database password
  (`#1599`). The DB-backed requirements are validated on AFC staging after the `staging` merge,
  which needs a staff sign-in to add and remove a test override (owner, or a staging staff account).
