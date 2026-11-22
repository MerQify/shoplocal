import { describe, expect, it, vi } from "vitest";
import {
  availabilityLabel,
  checkIncentive,
  effectiveRecoveryStatus,
  lineAvailability,
  qualifyingBundles,
  RECOVERABLE_ORIGINS,
} from "@/lib/abandoned-checkout/recovery";
import {
  hashRecoveryToken,
  isWellFormedRecoveryToken,
  newRecoveryToken,
} from "@/lib/abandoned-checkout/token";
import { evaluateCode, refusalMessage, type EvaluateCodeInput } from "@/lib/discounts";
import {
  abandonedWhere,
  claimRecoverySend,
  listAbandonedCheckouts,
  markRecoveredInTransaction,
  type AbandonedCheckoutRow,
} from "@/lib/repositories/abandoned-checkouts";
import { toView } from "@/lib/abandoned-checkouts-service";

/** #1732/#1733 — checkout recovery: rules, token, incentives, the send guard and "Recovered". */

const NOW = new Date("2026-11-22T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("listing (R4)", () => {
  it("selects only the five recoverable reasons — never STAFF, never unrecorded", () => {
    expect([...RECOVERABLE_ORIGINS].sort()).toEqual(
      [
        "CHECKOUT_ABANDONED",
        "CHECKOUT_CHANGED",
        "PAYMENT_EXPIRED",
        "PAYMENT_FAILED",
        "PROVIDER_UNAVAILABLE",
      ].sort(),
    );
    expect(abandonedWhere("v1")).toEqual({
      vendorId: "v1",
      status: "CANCELLED",
      statusEvents: {
        some: { status: "CANCELLED", cancellationOrigin: { in: [...RECOVERABLE_ORIGINS] } },
      },
    });
  });

  it("lists the last window only, newest first", async () => {
    const findMany = vi.fn(async (_args: Record<string, unknown>) => []);
    const since = new Date(NOW.getTime() - 30 * DAY);
    await listAbandonedCheckouts({ order: { findMany } } as never, "v1", since);
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { ...abandonedWhere("v1"), createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("lineAvailability (R6)", () => {
  it.each([
    ["deleted product", null, 1, "No longer available"],
    [
      "inactive",
      { isActive: false, stockMode: "TRACKED", stockQuantity: 5 },
      1,
      "No longer available",
    ],
    [
      "tracked, none left",
      { isActive: true, stockMode: "TRACKED", stockQuantity: 0 },
      1,
      "No longer available",
    ],
    [
      "tracked, short",
      { isActive: true, stockMode: "TRACKED", stockQuantity: 2 },
      3,
      "Only 2 left",
    ],
    ["tracked, enough", { isActive: true, stockMode: "TRACKED", stockQuantity: 3 }, 3, "Available"],
    ["untracked", { isActive: true, stockMode: "UNTRACKED", stockQuantity: 0 }, 9, "Available"],
  ] as const)("%s → %s", (_l, product, quantity, label) => {
    expect(availabilityLabel(lineAvailability(product, quantity))).toBe(label);
  });
});

describe("effectiveRecoveryStatus (R7)", () => {
  const recent = new Date(NOW.getTime() - DAY);
  const old = new Date(NOW.getTime() - 8 * DAY);
  it.each([
    ["no record, recent", null, recent, null, "PENDING"],
    ["no record, past the window", null, old, null, "EXPIRED"],
    ["reviewed, past the window", "REVIEWED", old, null, "EXPIRED"],
    ["sent, link live", "EMAIL_SENT", old, new Date(NOW.getTime() + DAY), "EMAIL_SENT"],
    ["sent, link expired", "EMAIL_SENT", old, new Date(NOW.getTime() - 1), "EXPIRED"],
    ["suppressed stays", "SUPPRESSED", old, null, "SUPPRESSED"],
    ["recovered stays", "RECOVERED", old, new Date(NOW.getTime() - 1), "RECOVERED"],
  ] as const)("%s → %s", (_l, stored, abandonedAt, tokenExpiresAt, expected) => {
    expect(effectiveRecoveryStatus({ stored, abandonedAt, tokenExpiresAt }, NOW, 7)).toBe(expected);
  });
});

describe("checkIncentive (R10)", () => {
  const basket = { totalPence: 2000, deliveryFeePence: 399, isDelivery: true };
  const base = { minSubtotalPence: 0, endsInDays: 14 };
  it("percentage 1-50 becomes basis points, with an end date", () => {
    expect(checkIncentive({ ...base, kind: "PERCENTAGE", amount: 10 }, basket, NOW)).toEqual({
      ok: true,
      value: 1000,
      endsAt: new Date(NOW.getTime() + 14 * DAY),
    });
  });
  it.each([
    [{ kind: "PERCENTAGE", amount: 0 }],
    [{ kind: "PERCENTAGE", amount: 51 }],
    [{ kind: "FIXED_AMOUNT", amount: 49 }],
    [{ kind: "FIXED_AMOUNT", amount: 2001 }],
  ] as const)("refuses %o", (change) => {
    expect(checkIncentive({ ...base, ...change }, basket, NOW).ok).toBe(false);
  });
  it("free delivery needs a delivery order with a fee", () => {
    expect(
      checkIncentive({ ...base, kind: "FREE_DELIVERY", amount: 0 }, basket, NOW),
    ).toMatchObject({
      ok: true,
      value: 0,
    });
    expect(
      checkIncentive(
        { ...base, kind: "FREE_DELIVERY", amount: 0 },
        { ...basket, isDelivery: false },
        NOW,
      ).ok,
    ).toBe(false);
  });
  it("refuses an end date outside 1-60 days", () => {
    expect(
      checkIncentive({ ...base, kind: "PERCENTAGE", amount: 10, endsInDays: 0 }, basket, NOW).ok,
    ).toBe(false);
    expect(
      checkIncentive({ ...base, kind: "PERCENTAGE", amount: 10, endsInDays: 61 }, basket, NOW).ok,
    ).toBe(false);
  });
});

describe("qualifyingBundles (R11)", () => {
  const bundles = [
    {
      name: "Curry night",
      items: [
        { productId: "rice", quantity: 1 },
        { productId: "dal", quantity: 2 },
      ],
    },
    { name: "Empty", items: [] },
  ];
  it("lists a bundle only when every item is held at its quantity", () => {
    expect(
      qualifyingBundles(
        [
          { productId: "rice", quantity: 1 },
          { productId: "dal", quantity: 2 },
        ],
        bundles,
      ).map((b) => b.name),
    ).toEqual(["Curry night"]);
    expect(
      qualifyingBundles(
        [
          { productId: "rice", quantity: 1 },
          { productId: "dal", quantity: 1 },
        ],
        bundles,
      ),
    ).toEqual([]);
  });
});

describe("discount evaluation (R12, R13)", () => {
  const code: EvaluateCodeInput = {
    kind: "PERCENTAGE",
    value: 1000,
    minSubtotalPence: 0,
    startsAt: new Date(0),
    endsAt: null,
    remainingRedemptions: 1,
    maxPerCustomer: 1,
    isActive: true,
    subtotalPence: 2000,
    deliveryFeePence: 399,
    userId: "user-1",
    customerUseCount: 0,
    now: NOW,
  };
  it("a customer-locked code works for its customer only, and never for a guest", () => {
    expect(evaluateCode({ ...code, restrictedToUserId: "user-1" })).toEqual({
      ok: true,
      discountPence: 200,
    });
    expect(evaluateCode({ ...code, restrictedToUserId: "user-2" })).toEqual({
      ok: false,
      reason: "RESTRICTED_TO_ANOTHER_CUSTOMER",
    });
    expect(evaluateCode({ ...code, restrictedToUserId: "user-1", userId: null })).toEqual({
      ok: false,
      reason: "SIGN_IN_REQUIRED",
    });
    expect(refusalMessage("RESTRICTED_TO_ANOTHER_CUSTOMER")).toMatch(/another customer/);
  });
  it("free delivery is worth exactly the delivery fee, and is refused without one", () => {
    const fd = { ...code, kind: "FREE_DELIVERY" as const, value: 0 };
    expect(evaluateCode(fd)).toEqual({ ok: true, discountPence: 399 });
    expect(evaluateCode({ ...fd, deliveryFeePence: 0 })).toEqual({
      ok: false,
      reason: "DELIVERY_ONLY",
    });
    expect(refusalMessage("DELIVERY_ONLY")).toMatch(/delivery/);
  });
  it("free delivery still respects the minimum spend", () => {
    expect(
      evaluateCode({ ...code, kind: "FREE_DELIVERY", value: 0, minSubtotalPence: 2500 }),
    ).toEqual({ ok: false, reason: "BELOW_MINIMUM" });
  });
});

describe("restore token (R19)", () => {
  it("is 32 random bytes in base64url, and only its SHA-256 is meant for storage", async () => {
    const a = await newRecoveryToken();
    const b = await newRecoveryToken();
    expect(isWellFormedRecoveryToken(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(await hashRecoveryToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });
  it("rejects malformed tokens before any lookup", () => {
    expect(isWellFormedRecoveryToken("short")).toBe(false);
    expect(isWellFormedRecoveryToken(`${"a".repeat(42)}!`)).toBe(false);
  });
});

/** A transaction double whose compare-and-set honours `emailCount` like Postgres would. */
function sendDb(initial: { emailCount: number; status: string }) {
  const state = { ...initial, tokenHash: null as string | null };
  const events: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const tx = {
    checkoutRecovery: {
      updateMany: async (args: {
        where: { emailCount: number; status: { notIn: string[] } };
        data: { emailCount: number; tokenHash: string; status: string };
      }) => {
        updates.push(args.data);
        if (args.where.emailCount !== state.emailCount) return { count: 0 };
        if (args.where.status.notIn.includes(state.status)) return { count: 0 };
        state.emailCount = args.data.emailCount;
        state.status = args.data.status;
        state.tokenHash = args.data.tokenHash;
        return { count: 1 };
      },
    },
    checkoutRecoveryEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        events.push(args.data);
        return {};
      },
    },
  };
  const prisma = { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
  return { prisma: prisma as never, state, events, updates };
}

describe("claimRecoverySend (R18, R19)", () => {
  const claim = {
    recoveryId: "rec-1",
    tokenHash: "h1",
    actorUserId: "staff-1",
    discountCode: null,
    now: NOW,
  };
  it("two concurrent sends expecting the same count produce exactly one claim", async () => {
    const db = sendDb({ emailCount: 0, status: "REVIEWED" });
    const results = await Promise.all([
      claimRecoverySend(db.prisma, "v1", { ...claim, expectedEmailCount: 0 }),
      claimRecoverySend(db.prisma, "v1", { ...claim, expectedEmailCount: 0, tokenHash: "h2" }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(db.state.emailCount).toBe(1);
    expect(db.events).toEqual([expect.objectContaining({ kind: "EMAIL_SENT" })]);
  });
  it("a confirmed second send records EMAIL_RESENT and a fresh token hash", async () => {
    const db = sendDb({ emailCount: 1, status: "EMAIL_SENT" });
    expect(
      await claimRecoverySend(db.prisma, "v1", {
        ...claim,
        expectedEmailCount: 1,
        tokenHash: "h9",
      }),
    ).toBe(true);
    expect(db.state).toMatchObject({ emailCount: 2, tokenHash: "h9" });
    expect(db.events[0]).toMatchObject({ kind: "EMAIL_RESENT" });
  });
  it("a suppressed checkout cannot be claimed", async () => {
    const db = sendDb({ emailCount: 0, status: "SUPPRESSED" });
    expect(await claimRecoverySend(db.prisma, "v1", { ...claim, expectedEmailCount: 0 })).toBe(
      false,
    );
    expect(db.events).toEqual([]);
  });
  it("stores only the hash it is given, never a raw token", async () => {
    const db = sendDb({ emailCount: 0, status: "PENDING" });
    await claimRecoverySend(db.prisma, "v1", {
      ...claim,
      expectedEmailCount: 0,
      tokenHash: "a".repeat(64),
    });
    expect(JSON.stringify(db.updates)).not.toContain("raw-token");
    expect(db.updates[0]).toMatchObject({ tokenHash: "a".repeat(64) });
  });
});

function recoveredTx(match: { id: string } | null, updateCount = 1) {
  const calls: { findFirst: unknown[]; updateMany: unknown[]; events: unknown[] } = {
    findFirst: [],
    updateMany: [],
    events: [],
  };
  const tx = {
    checkoutRecovery: {
      findFirst: async (args: never) => {
        calls.findFirst.push(args);
        return match;
      },
      updateMany: async (args: never) => {
        calls.updateMany.push(args);
        return { count: updateCount };
      },
    },
    checkoutRecoveryEvent: {
      create: async (args: never) => {
        calls.events.push(args);
        return {};
      },
    },
  };
  return { tx, calls };
}

describe("markRecoveredInTransaction (R22)", () => {
  it("marks the paying customer's newest recent EMAIL_SENT recovery RECOVERED with the order", async () => {
    const { tx, calls } = recoveredTx({ id: "rec-1" });
    expect(
      await markRecoveredInTransaction(tx, "v1", { orderId: "o-new", userId: "user-1", now: NOW }),
    ).toBe(true);
    expect(calls.findFirst[0]).toMatchObject({
      where: {
        vendorId: "v1",
        status: "EMAIL_SENT",
        orderId: { not: "o-new" },
        order: { userId: "user-1" },
        lastEmailedAt: { gte: new Date(NOW.getTime() - 14 * DAY) },
      },
      orderBy: { lastEmailedAt: "desc" },
    });
    expect(calls.updateMany[0]).toMatchObject({
      where: { id: "rec-1", vendorId: "v1", status: "EMAIL_SENT" },
      data: { status: "RECOVERED", recoveredOrderId: "o-new", recoveredAt: NOW },
    });
    expect(calls.events[0]).toMatchObject({ data: { recoveryId: "rec-1", kind: "RECOVERED" } });
  });
  it("a guest order changes nothing", async () => {
    const { tx, calls } = recoveredTx({ id: "rec-1" });
    expect(
      await markRecoveredInTransaction(tx, "v1", { orderId: "o", userId: null, now: NOW }),
    ).toBe(false);
    expect(calls.findFirst).toEqual([]);
  });
  it("no matching recovery changes nothing", async () => {
    const { tx, calls } = recoveredTx(null);
    expect(
      await markRecoveredInTransaction(tx, "v1", { orderId: "o", userId: "user-1", now: NOW }),
    ).toBe(false);
    expect(calls.updateMany).toEqual([]);
  });
  it("losing the compare-and-set (already recovered) writes no event", async () => {
    const { tx, calls } = recoveredTx({ id: "rec-1" }, 0);
    expect(
      await markRecoveredInTransaction(tx, "v1", { orderId: "o", userId: "user-1", now: NOW }),
    ).toBe(false);
    expect(calls.events).toEqual([]);
  });
});

describe("staff view (R5, R7)", () => {
  const row: AbandonedCheckoutRow = {
    orderId: "order-1",
    orderNumber: "SHO-1",
    userId: "user-1",
    confirmationToken: null,
    email: "sam@example.com",
    customerName: "Sam",
    totalPence: 1500,
    subtotalPence: 1500,
    deliveryFeePence: 399,
    isDelivery: true,
    items: [
      {
        productId: "rice",
        productName: "Rice",
        quantity: 1,
        unitPricePence: 500,
        lineTotalPence: 500,
        product: {
          isActive: true,
          currentPricePence: 550,
          stockMode: "TRACKED",
          stockQuantity: 0,
          imageKey: null,
        },
      },
    ],
    abandonedAt: new Date(NOW.getTime() - DAY),
    origin: "CHECKOUT_CHANGED",
    recovery: null,
  };
  it("shows reason, availability, current price, status and Bought later", () => {
    const view = toView(
      row,
      true,
      [{ userId: "user-1", orderNumber: "SHO-2", createdAt: new Date(NOW.getTime() - 1000) }],
      [],
      NOW,
    );
    expect(view).toMatchObject({
      reasonLabel: "Changed at checkout",
      status: "PENDING",
      statusLabel: "Pending",
      boughtLater: "SHO-2",
      blockedReason: null,
      canResend: false,
    });
    expect(view.items[0]).toMatchObject({
      availability: "No longer available",
      available: false,
      originalUnitPence: 500,
      currentUnitPence: 550,
    });
  });
  it("an order placed BEFORE the abandonment is not 'Bought later'", () => {
    const view = toView(
      row,
      true,
      [{ userId: "user-1", orderNumber: "SHO-0", createdAt: new Date(NOW.getTime() - 3 * DAY) }],
      [],
      NOW,
    );
    expect(view.boughtLater).toBeNull();
  });
});
