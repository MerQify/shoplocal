import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaymentCheckResult } from "@/lib/payment-check-service";
import type { BulkAddLine, MergeLine } from "@/lib/cart-rules";

/**
 * #1589 R9–R11 — `cancelOrder` asks Stripe before it cancels, never cancels a
 * paid order or cancels while Stripe is unreachable, and restores the basket
 * only after its OWN cancel (a double submit must not double the basket).
 *
 * The payment check, the cancel service and the cart are mocked; `restoredLines`
 * and `buildRestoreNoticeUrl` run for real, so the notice URL is the one `/cart`
 * would receive. What `addItems` writes is its own contract
 * (`tests/cart-bulk-add-report.test.ts`).
 */

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const viewer = vi.hoisted(() => ({ order: null as unknown, userId: null as string | null }));
const getByOrderNumber = vi.hoisted(() =>
  vi.fn(async (_n: string, _u: string | null, _t: string | null) => viewer.order),
);
const cancelUnpaid = vi.hoisted(() => vi.fn(async (_n: string, _r: string) => true));
vi.mock("@/lib/orders-service", () => ({
  getOrderRepository: () => ({ getByOrderNumber }),
  getOrderCancelService: () => ({ cancelUnpaid }),
}));

const addItems = vi.hoisted(() =>
  vi.fn(async (_identity: unknown, lines: MergeLine[]): Promise<BulkAddLine[]> =>
    lines.map((l) => ({
      productId: l.productId,
      requested: l.quantity,
      // The second line comes back short, so a real restore yields a notice URL
      // distinguishable from plain `/cart`.
      added: l.productId === "p-2" ? 1 : l.quantity,
      kind: l.productId === "p-2" ? "partial" : "added",
    })),
  ),
);
vi.mock("@/lib/cart-service", () => ({ getCartRepository: () => ({ addItems }) }));
vi.mock("@/lib/cart-identity", () => ({
  getCartIdentity: async () => ({
    userId: viewer.userId,
    guestToken: viewer.userId ? null : "guest-cart",
  }),
}));
vi.mock("@/features/cart/shared", () => ({
  scopedToUser: (identity: { userId: string | null; guestToken: string | null }) => identity,
}));

const check = vi.hoisted(() =>
  vi.fn(async (_n: string): Promise<PaymentCheckResult> => ({ kind: "no-session" })),
);
vi.mock("@/lib/payment-check-service", () => ({ getPaymentCheckService: () => ({ check }) }));

const { cancelOrder } = await import("@/features/checkout/cancel-order");

afterEach(() => {
  vi.clearAllMocks();
  viewer.order = null;
  viewer.userId = null;
  cancelUnpaid.mockResolvedValue(true);
});

const pendingOrder = {
  orderNumber: "AHE-1",
  status: "PENDING_PAYMENT",
  items: [
    { productId: "p-1", productName: "Item one", quantity: 3, customNote: "ripe ones" },
    { productId: "p-2", productName: "Item two", quantity: 2, customNote: null },
  ],
};

const form = (t: string) => {
  const data = new FormData();
  data.set("orderNumber", "AHE-1");
  data.set("t", t);
  return data;
};

const redirectedTo = async (data: FormData): Promise<string> => {
  await expect(cancelOrder(data)).rejects.toThrow(/^REDIRECT:/);
  return redirect.mock.calls.at(-1)![0];
};

const RESTORED = "/cart?restored=cancelled";

describe("cancelOrder — before asking Stripe (#1589 R9)", () => {
  it("refused access lands on /cart and touches nothing", async () => {
    viewer.order = null;
    await expect(redirectedTo(form("wrong"))).resolves.toBe("/cart");
    expect(check).not.toHaveBeenCalled();
    expect(cancelUnpaid).not.toHaveBeenCalled();
    expect(addItems).not.toHaveBeenCalled();
  });

  it("an order already past PENDING_PAYMENT lands on /cart and touches nothing", async () => {
    viewer.order = { ...pendingOrder, status: "CONFIRMED" };
    await expect(redirectedTo(form("tok-1"))).resolves.toBe("/cart");
    expect(check).not.toHaveBeenCalled();
    expect(cancelUnpaid).not.toHaveBeenCalled();
  });
});

describe("cancelOrder — the payment check decides (#1589 R10)", () => {
  it.each<[PaymentCheckResult, string, string]>([
    [{ kind: "confirmed" }, "/checkout/AHE-1?t=tok-1", "/checkout/AHE-1"],
    [{ kind: "not-pending" }, "/checkout/AHE-1?t=tok-1", "/checkout/AHE-1"],
    [
      { kind: "refused", reason: "binding-mismatch" } as PaymentCheckResult,
      "/checkout/AHE-1?t=tok-1",
      "/checkout/AHE-1",
    ],
    [
      { kind: "provider-error" },
      "/checkout/AHE-1/cancel?payment=unavailable&t=tok-1",
      "/checkout/AHE-1/cancel?payment=unavailable",
    ],
    [{ kind: "not-found" }, "/cart", "/cart"],
  ])("%o cancels nothing and restores nothing", async (result, guest, member) => {
    viewer.order = pendingOrder;
    check.mockResolvedValue(result);

    await expect(redirectedTo(form("tok-1"))).resolves.toBe(guest);
    viewer.userId = "user-1";
    await expect(redirectedTo(form(""))).resolves.toBe(member);

    expect(check).toHaveBeenCalledWith("AHE-1");
    expect(cancelUnpaid).not.toHaveBeenCalled();
    expect(addItems).not.toHaveBeenCalled();
  });

  it.each<PaymentCheckResult>([
    { kind: "no-session" },
    { kind: "not-paid", sessionStatus: "open", paymentStatus: "unpaid" },
  ])("%o: cancels once, then restores once with a notice", async (result) => {
    viewer.order = pendingOrder;
    check.mockResolvedValue(result);

    const url = await redirectedTo(form("tok-1"));
    expect(url.startsWith(RESTORED)).toBe(true);
    expect(cancelUnpaid).toHaveBeenCalledTimes(1);
    expect(addItems).toHaveBeenCalledTimes(1);
    // Stripe is asked BEFORE anything is cancelled.
    expect(check.mock.invocationCallOrder[0]).toBeLessThan(
      cancelUnpaid.mock.invocationCallOrder[0],
    );
  });

  it("a repeat whose cancelUnpaid lost the compare-and-set restores nothing", async () => {
    viewer.order = pendingOrder;
    check.mockResolvedValue({ kind: "not-paid", sessionStatus: "open", paymentStatus: "unpaid" });
    cancelUnpaid.mockResolvedValue(false);

    await expect(redirectedTo(form("tok-1"))).resolves.toBe("/cart");
    expect(cancelUnpaid).toHaveBeenCalledTimes(1);
    expect(addItems).not.toHaveBeenCalled();
  });

  it("two submits, the second losing the compare-and-set, restore the basket once", async () => {
    viewer.order = pendingOrder;
    check.mockResolvedValue({ kind: "not-paid", sessionStatus: "open", paymentStatus: "unpaid" });
    cancelUnpaid.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await redirectedTo(form("tok-1"));
    await redirectedTo(form("tok-1"));
    expect(cancelUnpaid).toHaveBeenCalledTimes(2);
    expect(addItems).toHaveBeenCalledTimes(1);
  });
});

describe("cancelOrder — what goes back in the basket (#1589 R11)", () => {
  it("keeps the reason, and restores each line's quantity and note unchanged", async () => {
    viewer.order = pendingOrder;
    check.mockResolvedValue({ kind: "no-session" });

    await redirectedTo(form("tok-1"));
    expect(cancelUnpaid).toHaveBeenCalledWith("AHE-1", "Shopper cancelled payment at checkout");
    expect(addItems).toHaveBeenCalledWith({ userId: null, guestToken: "guest-cart" }, [
      { productId: "p-1", quantity: 3, customNote: "ripe ones" },
      { productId: "p-2", quantity: 2 },
    ]);
  });
});
