import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lib/repositories/orders.ts imports lib/db (→ @prisma/client/wasm, unresolvable under vitest) and
// lib/tenant; mock both so the module loads. Same posture as tests/slot-booking-cutoff.test.ts.
vi.mock("@/lib/db", () => ({ getPrisma: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getCurrentVendorId: vi.fn() }));
vi.mock("@/lib/payments", () => ({
  CHECKOUT_SESSION_TTL_MS: 35 * 60 * 1000,
  getPaymentService: () => ({ createPayment: vi.fn() }),
}));

const { getAvailableSlotsForDate, getSlotDayForDate } =
  await import("@/lib/repositories/fulfilment-slots");
const { placeOrder } = await import("@/lib/repositories/orders");
const { effectiveDayHours, expressOverrideVerdict, slotFitsOverride } =
  await import("@/lib/slot-closure");

/**
 * #1605 — dated closures and changed hours (#1060's `VendorHoursOverride`) in the slot list and in
 * placeOrder. The day is a week ahead of NOW, so the #1441 cut-off never interferes.
 */
const VENDOR = "vendor-1";
const NOW = new Date("2026-11-16T08:00:00Z");
const DAY = "2026-11-23"; // a Monday

const SLOTS = [
  { id: "s-10", startTime: "10:00", endTime: "12:00", capacity: 5 },
  { id: "s-09", startTime: "09:00", endTime: "14:00", capacity: 5 },
  { id: "s-13", startTime: "13:00", endTime: "15:00", capacity: 5 },
  { id: "s-18", startTime: "18:00", endTime: "20:00", capacity: 5 },
];

const CLOSED = { label: "Christmas Day", closed: true, openTime: null, closeTime: null };
const SHORT = { label: "Christmas Eve", closed: false, openTime: "09:00", closeTime: "14:00" };

function listPrisma(override: object | null, slots = SLOTS, weekly: object | null = null) {
  const prisma = {
    vendor: {
      findUnique: async () => ({
        id: VENDOR,
        config: {
          timezone: "Europe/London",
          slotHoldDurationMinutes: 15,
          slotBookingCutoffMinutes: 60,
        },
        fulfilmentSlots: slots,
        hoursOverrides: override ? [override] : [],
        weeklyHours: weekly ? [weekly] : [],
      }),
    },
    order: { groupBy: vi.fn(async () => []) },
  };
  return prisma as never;
}

const ids = (slots: { id: string }[]) => slots.map((s) => s.id).sort();

describe("slot list — closed day (R10)", () => {
  it.each(["DELIVERY", "COLLECTION"] as const)("offers no %s slot on a closed day", async (m) => {
    expect(await getAvailableSlotsForDate(listPrisma(CLOSED), VENDOR, m, DAY, NOW)).toEqual([]);
  });

  it("reports the closure label for the grid, even on a weekday with no slots", async () => {
    expect(await getSlotDayForDate(listPrisma(CLOSED, []), VENDOR, "DELIVERY", DAY, NOW)).toEqual({
      slots: [],
      closedLabel: "Christmas Day",
    });
  });
});

describe("slot list — changed hours (R11, R12)", () => {
  it("offers only the collection slots inside the changed hours, bounds inclusive", async () => {
    const slots = await getAvailableSlotsForDate(listPrisma(SHORT), VENDOR, "COLLECTION", DAY, NOW);
    expect(ids(slots)).toEqual(["s-09", "s-10"]);
  });

  it("leaves every delivery slot in place", async () => {
    const slots = await getAvailableSlotsForDate(listPrisma(SHORT), VENDOR, "DELIVERY", DAY, NOW);
    expect(ids(slots)).toEqual(ids(SLOTS));
  });

  it.each([
    ["openTime", { ...SHORT, openTime: null }],
    ["closeTime", { ...SHORT, closeTime: null }],
  ])("trims nothing when %s is missing", async (_label, override) => {
    const slots = await getAvailableSlotsForDate(
      listPrisma(override),
      VENDOR,
      "COLLECTION",
      DAY,
      NOW,
    );
    expect(ids(slots)).toEqual(ids(SLOTS));
  });

  it("is unchanged on a day with no override", async () => {
    const day = await getSlotDayForDate(listPrisma(null), VENDOR, "COLLECTION", DAY, NOW);
    expect(ids(day.slots)).toEqual(ids(SLOTS));
    expect(day.closedLabel).toBeNull();
  });
});

describe("placeOrder — closed day and changed hours (R15, R16)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function orderPrisma(override: object | null, slot = SLOTS[3], weekly: object | null = null) {
    const count = vi.fn(async () => 5);
    const create = vi.fn();
    const overrideLookup = vi.fn(async () => override);
    const tx = {
      vendorHoursOverride: { findUnique: overrideLookup },
      vendorWeeklyHours: { findUnique: async () => weekly },
      vendorFulfilmentSlot: { findUnique: async () => slot },
      vendorConfig: {
        findUnique: async () => ({
          timezone: "Europe/London",
          slotHoldDurationMinutes: 15,
          slotBookingCutoffMinutes: 60,
        }),
      },
      order: { count, create },
    };
    const prisma = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
    return { prisma: prisma as never, count, create, overrideLookup };
  }

  const input = (fulfilmentMethod: "DELIVERY" | "COLLECTION", slotId = SLOTS[3].id) =>
    ({
      cartId: "cart-1",
      userId: null,
      guestEmail: "shopper@example.com",
      fulfilmentSlotId: slotId,
      fulfilmentDate: new Date(`${DAY}T00:00:00.000Z`),
      fulfilmentMethod,
    }) as never;

  it.each(["DELIVERY", "COLLECTION"] as const)(
    "refuses a %s order on a closed day before counting or creating anything",
    async (m) => {
      const { prisma, count, create, overrideLookup } = orderPrisma(CLOSED);
      await expect(placeOrder(prisma, VENDOR, input(m))).rejects.toMatchObject({
        code: "STORE_CLOSED",
        message: "We're closed on that day. Please choose another day.",
      });
      expect(overrideLookup).toHaveBeenCalledWith({
        where: { vendorId_date: { vendorId: VENDOR, date: new Date(`${DAY}T00:00:00.000Z`) } },
      });
      expect(count).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("refuses a collection slot ending after the changed closing time", async () => {
    const { prisma, create } = orderPrisma(SHORT);
    await expect(placeOrder(prisma, VENDOR, input("COLLECTION"))).rejects.toMatchObject({
      code: "SLOT_CLOSED",
      message: "That time slot can no longer be booked. Please choose another.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("lets a delivery order in the same slot through to the capacity check", async () => {
    // `count` reports the slot full, so reaching SLOT_FULL proves the closure checks passed.
    const { prisma, count } = orderPrisma(SHORT);
    await expect(placeOrder(prisma, VENDOR, input("DELIVERY"))).rejects.toMatchObject({
      code: "SLOT_FULL",
    });
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("#1615 R5 — refuses a weekly-closed weekday with no dated entry", async () => {
    const { prisma, create } = orderPrisma(null, SLOTS[3], WEEKLY_CLOSED);
    await expect(placeOrder(prisma, VENDOR, input("DELIVERY"))).rejects.toMatchObject({
      code: "STORE_CLOSED",
      message: "We're closed on that day. Please choose another day.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("#1615 R5 — refuses a collection slot outside the weekly hours", async () => {
    const { prisma, create } = orderPrisma(null, SLOTS[3], WEEKLY_TO_19);
    await expect(placeOrder(prisma, VENDOR, input("COLLECTION"))).rejects.toMatchObject({
      code: "SLOT_CLOSED",
    });
    expect(create).not.toHaveBeenCalled();
  });
});

// #1615 — Monday's usual hours (DAY is a Monday).
const WEEKLY_CLOSED = { dayOfWeek: 1, closed: true, openTime: null, closeTime: null };
const WEEKLY_TO_19 = { dayOfWeek: 1, closed: false, openTime: "09:00", closeTime: "19:00" };

describe("#1615 — the weekly opening hours govern slots too", () => {
  it("R1 — effectiveDayHours: dated wins, then weekly closed, then weekly hours, else null", () => {
    expect(effectiveDayHours(SHORT, WEEKLY_CLOSED)).toEqual(SHORT);
    expect(effectiveDayHours(null, { ...WEEKLY_CLOSED, dayOfWeek: 3 })).toEqual({
      label: "Closed every Wednesday",
      closed: true,
      openTime: null,
      closeTime: null,
    });
    expect(effectiveDayHours(null, WEEKLY_TO_19)).toMatchObject({
      closed: false,
      openTime: "09:00",
      closeTime: "19:00",
    });
    expect(
      effectiveDayHours(null, { dayOfWeek: 1, closed: false, openTime: null, closeTime: null }),
    ).toBeNull();
    expect(effectiveDayHours(null, null)).toBeNull();
  });

  it("R2 — a weekly-closed weekday offers no slot for either method, with its label", async () => {
    for (const m of ["DELIVERY", "COLLECTION"] as const) {
      expect(
        await getSlotDayForDate(listPrisma(null, SLOTS, WEEKLY_CLOSED), VENDOR, m, DAY, NOW),
      ).toEqual({ slots: [], closedLabel: "Closed every Monday" });
    }
  });

  it("R3 — weekly 09:00–19:00 drops the 18:00–20:00 collection slot but not the delivery one", async () => {
    const prisma = listPrisma(null, SLOTS, WEEKLY_TO_19);
    expect(
      ids(await getAvailableSlotsForDate(prisma, VENDOR, "COLLECTION", DAY, NOW)),
    ).not.toContain("s-18");
    expect(ids(await getAvailableSlotsForDate(prisma, VENDOR, "DELIVERY", DAY, NOW))).toContain(
      "s-18",
    );
  });

  it("R4 — a dated entry wins over the weekly row, both ways", async () => {
    const reopened = await getAvailableSlotsForDate(
      listPrisma(SHORT, SLOTS, WEEKLY_CLOSED),
      VENDOR,
      "COLLECTION",
      DAY,
      NOW,
    );
    expect(ids(reopened)).toEqual(["s-09", "s-10"]);
    expect(
      await getAvailableSlotsForDate(
        listPrisma(CLOSED, SLOTS, WEEKLY_TO_19),
        VENDOR,
        "DELIVERY",
        DAY,
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("the pure rules", () => {
  it("slotFitsOverride: closed refuses both methods; changed hours trims collection only", () => {
    const late = { startTime: "18:00", endTime: "20:00" };
    expect(slotFitsOverride("DELIVERY", late, CLOSED)).toBe(false);
    expect(slotFitsOverride("COLLECTION", late, SHORT)).toBe(false);
    expect(slotFitsOverride("DELIVERY", late, SHORT)).toBe(true);
    expect(slotFitsOverride("COLLECTION", late, null)).toBe(true);
  });

  it("expressOverrideVerdict (R17)", () => {
    expect(expressOverrideVerdict(CLOSED, "10:00")).toBe("CLOSED_DAY");
    expect(expressOverrideVerdict(SHORT, "10:00")).toBe("OK");
    expect(expressOverrideVerdict(SHORT, "14:00")).toBe("OUTSIDE_HOURS");
    expect(expressOverrideVerdict(SHORT, "08:59")).toBe("OUTSIDE_HOURS");
    expect(expressOverrideVerdict(null, "23:00")).toBe("OK");
  });
});
