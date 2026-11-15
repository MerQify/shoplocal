import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #1605 R17 — `placeOrderAction` refuses an Express collection order on a day the store is closed,
 * or outside that day's changed hours, before any order is created. The toggle is hidden in those
 * cases (tests/slot-picker-grid.test.tsx); this is the server half, for a stale page or a direct
 * call. Harness copied from tests/place-order-delivery-pricing.test.ts.
 */

const m = vi.hoisted(() => ({
  createOrder: vi.fn(),
  redirect: vi.fn(),
  profile: {
    id: "vendor-1",
    slug: "aheed",
    timezone: "Europe/London",
    deliveryFeePence: 349,
    minimumOrderPence: 0,
    freeDeliveryThresholdPence: 4000,
    collectionMinimumOrderPence: 0,
    deliveryAreas: [],
    hoursOverrides: [] as {
      date: string;
      label: string;
      closed: boolean;
      openTime: string | null;
      closeTime: string | null;
    }[],
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:8787" }),
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => m.redirect(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPrisma: vi.fn(() => ({})), getPrismaWs: vi.fn() }));
vi.mock("@/lib/cart-identity", () => ({
  getCartIdentity: async () => ({ userId: "u1", guestToken: null }),
}));
vi.mock("@/lib/cart-service", () => ({
  getCartRepository: () => ({
    getSummary: async () => ({ mergePending: false, lines: [{ id: "l1" }] }),
    getCartId: async () => "cart-1",
  }),
}));
vi.mock("@/lib/orders-service", () => ({
  getOrderRepository: () => ({ createOrder: m.createOrder }),
}));
vi.mock("@/lib/vendor-service", () => ({ getCurrentVendorProfile: async () => m.profile }));
vi.mock("@/lib/delivery-eligibility-service", () => ({ getDeliveryEligibility: vi.fn() }));
vi.mock("@/lib/customer-addresses-service", () => ({
  getCustomerAddressService: () => ({ save: vi.fn() }),
}));
vi.mock("@/features/storefront/delivery", () => ({ setDeliveryPostcode: vi.fn() }));
vi.mock("@/lib/repositories/delivery-refusals", () => ({ recordDeliveryRefusal: vi.fn() }));

import { placeOrderAction } from "@/features/checkout/place-order";

const TODAY = "2026-11-16"; // 10:00 UTC = 10:00 GMT in Europe/London

function expressForm(): FormData {
  const form = new FormData();
  form.set("fulfilmentMethod", "COLLECTION");
  form.set("recipientName", "Test Shopper");
  form.set("phone", "07000000000");
  form.set("isExpress", "on");
  return form;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  vi.clearAllMocks();
  m.profile.hoursOverrides = [];
  m.createOrder.mockResolvedValue({
    orderNumber: "AHE-1",
    redirectUrl: "/pay",
    confirmationToken: "t",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("#1605 R17 — Express collection obeys today's closure and changed hours", () => {
  it("refuses on a closed day and creates nothing", async () => {
    m.profile.hoursOverrides = [
      { date: TODAY, label: "Closed", closed: true, openTime: null, closeTime: null },
    ];
    expect(await placeOrderAction({ error: null }, expressForm())).toEqual({
      error: "We're closed on that day. Please choose another day.",
    });
    expect(m.createOrder).not.toHaveBeenCalled();
  });

  it("refuses outside today's changed hours and creates nothing", async () => {
    m.profile.hoursOverrides = [
      { date: TODAY, label: "Half day", closed: false, openTime: "06:00", closeTime: "09:00" },
    ];
    expect(await placeOrderAction({ error: null }, expressForm())).toEqual({
      error: "Express collection isn't available right now. Please choose a time slot.",
    });
    expect(m.createOrder).not.toHaveBeenCalled();
  });

  it("places the order inside today's changed hours", async () => {
    m.profile.hoursOverrides = [
      { date: TODAY, label: "Half day", closed: false, openTime: "09:00", closeTime: "13:00" },
    ];
    await placeOrderAction({ error: null }, expressForm());
    expect(m.createOrder).toHaveBeenCalledTimes(1);
  });

  it("ignores an override on another day", async () => {
    m.profile.hoursOverrides = [
      { date: "2026-11-17", label: "Closed", closed: true, openTime: null, closeTime: null },
    ];
    await placeOrderAction({ error: null }, expressForm());
    expect(m.createOrder).toHaveBeenCalledTimes(1);
  });
});
