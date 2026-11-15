import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * #1589 R5 — `getResumePaymentService().resume`: vendor-scoped load of the
 * order's own session, `not-found` for no row, and the decision fed by the live
 * payment service.
 */

const state = vi.hoisted(() => ({
  row: null as null | { orderNumber: string; status: string; providerReference: string | null },
}));
const findOrderPaymentState = vi.hoisted(() =>
  vi.fn(async (_p: unknown, _v: string, _n: string) => state.row),
);
vi.mock("@/lib/db", () => ({ getPrisma: () => ({ client: "http" }), getPrismaWs: () => ({}) }));
vi.mock("@/lib/tenant", () => ({ getCurrentVendorId: async () => "v-aheed" }));
vi.mock("@/lib/repositories/orders", () => ({ findOrderPaymentState }));

const retrieveSession = vi.hoisted(() =>
  vi.fn(async (id: string) => ({
    id,
    paymentStatus: "unpaid",
    status: "open",
    amountTotal: 100,
    currency: "gbp",
    url: "https://checkout.stripe.com/c/pay/" + id,
  })),
);
vi.mock("@/lib/payments", () => ({ getPaymentService: () => ({ retrieveSession }) }));

const { getResumePaymentService } = await import("@/lib/resume-payment-service");

beforeEach(() => vi.clearAllMocks());

describe("getResumePaymentService().resume (#1589 R5)", () => {
  it("is not-found when the current vendor has no such order", async () => {
    state.row = null;
    await expect(getResumePaymentService().resume("AHE-404")).resolves.toEqual({
      kind: "not-found",
    });
    expect(findOrderPaymentState).toHaveBeenCalledWith({ client: "http" }, "v-aheed", "AHE-404");
    expect(retrieveSession).not.toHaveBeenCalled();
  });

  it("asks the payment service about the stored session and returns the decision", async () => {
    state.row = { orderNumber: "AHE-1", status: "PENDING_PAYMENT", providerReference: "cs_test_9" };
    await expect(getResumePaymentService().resume("AHE-1")).resolves.toEqual({
      kind: "open",
      url: "https://checkout.stripe.com/c/pay/cs_test_9",
    });
    expect(retrieveSession).toHaveBeenCalledWith("cs_test_9");
  });
});
