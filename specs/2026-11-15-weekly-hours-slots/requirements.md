# Weekly opening hours control checkout slots (requirements / acceptance criteria)

Closes `#1615`. Builds on `#1605` (`lib/slot-closure.ts`). The weekly **Opening hours**
(`VendorWeeklyHours`) gate slots with the same rules as a dated **Holiday & closure** entry, and a
dated entry still wins for its date.

R1. `effectiveDayHours(dated, weekly)` in `lib/slot-closure.ts` returns:

    - the dated override when it is not null;
    - otherwise, for a weekly row with `closed: true`, a closed `DayOverride` labelled
      `Closed every <Weekday>` (for example `Closed every Wednesday` for `dayOfWeek: 3`);
    - for a weekly row with both times set, a changed-hours `DayOverride` with those times;
    - otherwise `null`.

    Asserted by unit tests.

R2. Slot availability for a date whose weekday is weekly-closed, with no dated entry, returns no
    `DELIVERY` and no `COLLECTION` slots, and reports the closed label. Asserted by a unit test.

R3. For a weekday with weekly hours `09:00`–`19:00` and no dated entry, a `COLLECTION` slot
    `18:00`–`20:00` is not returned, and the `DELIVERY` slot `18:00`–`20:00` is. Asserted by a unit
    test.

R4. A dated entry wins over the weekly row:

    - a dated open changed-hours entry on a weekly-closed weekday offers collection slots inside
      the dated hours;
    - a dated closed entry on a weekly-open weekday offers none.

    Asserted by unit tests.

R5. `placeOrder` refuses an order on a weekly-closed weekday (no dated entry) with `STORE_CLOSED`
    and `We're closed on that day. Please choose another day.`, and creates no order. It refuses a
    `COLLECTION` slot outside the weekly hours with `SLOT_CLOSED`. Asserted by unit tests.

R6. Express collection:

    - `placeOrderAction` refuses `isExpress` when today is weekly-closed (closed message), or when
      now is outside today's weekly hours (outside-hours message);
    - `SlotPicker` hides the Express toggle in both cases.

    Asserted by tests.

R7. **AFC staging, live.**

    1. With Wednesday set **Closed all day** in the weekly Opening hours, `/checkout` shows the next
       Wednesday as `Closed` / `Closed every Wednesday`, with no slot under **Click & Collect** or
       **Delivery**.
    2. Under **Click & Collect**, Sunday shows no `18:00 - 20:00` slot, while **Delivery** still
       does.

R8. `docs/store-admin-guide/admin-tabs-guide.md` says the weekly Opening hours control checkout
    slots (closed days take no bookings, collection slots stay inside opening hours), and that a
    Holiday & closure entry overrides them for its date.

R9. `CHANGELOG.md` updated (Gate 4).

R10. `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=4`, `npm run format:check`
     and `npm run kms:validate` all remain green, apart from the four live-DB files blocked by
     `#1599`.
