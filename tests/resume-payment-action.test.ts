import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResumePaymentResult } from "@/lib/resume-payment-service";

/**
 * #1589 R7, R8 — the "Continue to payment" action: access re-proved before
 * Stripe is asked, and every outcome's exact redirect for a guest (token) and a
 * member (no token). The service is mocked; its decision table is
 * `tests/resume-payment.test.ts`.
 */

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const viewer = vi.hoisted(() => ({ order: null as unknown, userId: null as string | null }));
const getByOrderNumber = vi.hoisted(() =>
  vi.fn(async (_n: string, _u: string | null, _t: string | null) => viewer.order),
);
vi.mock("@/lib/orders-service", () => ({ getOrderRepository: () => ({ getByOrderNumber }) }));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({
    api: { getSession: async () => (viewer.userId ? { user: { id: viewer.userId } } : null) },
  }),
}));

const service = vi.hoisted(() => ({
  resume: vi.fn(async (_n: string): Promise<ResumePaymentResult> => ({ kind: "not-found" })),
}));
vi.mock("@/lib/resume-payment-service", () => ({ getResumePaymentService: () => service }));

const { resumePayment } = await import("@/features/checkout/resume-payment");

afterEach(() => {
  vi.clearAllMocks();
  viewer.order = null;
  viewer.userId = null;
});

const form = (t: string, orderNumber = "AHE-1") => {
  const data = new FormData();
  data.set("orderNumber", orderNumber);
  data.set("t", t);
  return data;
};

const redirectedTo = async (data: FormData): Promise<string> => {
  await expect(resumePayment(data)).rejects.toThrow(/^REDIRECT:/);
  return redirect.mock.calls.at(-1)![0];
};

describe("resumePayment — access (#1589 R7)", () => {
  it("refuses to /orders/lookup without asking Stripe", async () => {
    viewer.order = null;
    await expect(redirectedTo(form("wrong"))).resolves.toBe("/orders/lookup?orderNumber=AHE-1");
    expect(service.resume).not.toHaveBeenCalled();
    expect(getByOrderNumber).toHaveBeenCalledWith("AHE-1", null, "wrong");
  });

  it("passes a member's session user id and no token", async () => {
    viewer.userId = "user-1";
    viewer.order = { orderNumber: "AHE-1" };
    service.resume.mockResolvedValueOnce({ kind: "not-pending" });
    await redirectedTo(form(""));
    expect(getByOrderNumber).toHaveBeenCalledWith("AHE-1", "user-1", null);
  });
});

describe("resumePayment — redirects (#1589 R8)", () => {
  const cases: [ResumePaymentResult, string, string][] = [
    [
      { kind: "open", url: "https://checkout.stripe.com/c/pay/cs_test_1" },
      "https://checkout.stripe.com/c/pay/cs_test_1",
      "https://checkout.stripe.com/c/pay/cs_test_1",
    ],
    [{ kind: "complete" }, "/checkout/AHE-1?t=tok-1", "/checkout/AHE-1"],
    [{ kind: "not-pending" }, "/checkout/AHE-1?t=tok-1", "/checkout/AHE-1"],
    [
      { kind: "expired" },
      "/checkout/AHE-1/cancel?payment=expired&t=tok-1",
      "/checkout/AHE-1/cancel?payment=expired",
    ],
    [
      { kind: "no-session" },
      "/checkout/AHE-1/cancel?payment=none&t=tok-1",
      "/checkout/AHE-1/cancel?payment=none",
    ],
    [
      { kind: "provider-error" },
      "/checkout/AHE-1/cancel?payment=unavailable&t=tok-1",
      "/checkout/AHE-1/cancel?payment=unavailable",
    ],
    [
      { kind: "unavailable" },
      "/checkout/AHE-1/cancel?payment=unavailable&t=tok-1",
      "/checkout/AHE-1/cancel?payment=unavailable",
    ],
    [
      { kind: "not-found" },
      "/checkout/AHE-1/cancel?payment=unavailable&t=tok-1",
      "/checkout/AHE-1/cancel?payment=unavailable",
    ],
  ];

  it.each(cases)("%o → guest %s, member %s", async (outcome, guest, member) => {
    viewer.order = { orderNumber: "AHE-1" };
    service.resume.mockResolvedValue(outcome);

    await expect(redirectedTo(form("tok-1"))).resolves.toBe(guest);

    viewer.userId = "user-1";
    await expect(redirectedTo(form(""))).resolves.toBe(member);
    expect(service.resume).toHaveBeenCalledTimes(2);
    expect(service.resume).toHaveBeenCalledWith("AHE-1");
  });

  it("encodes the order number and the token", async () => {
    viewer.order = { orderNumber: "AHE 1" };
    service.resume.mockResolvedValue({ kind: "expired" });
    await expect(redirectedTo(form("a&b", "AHE 1"))).resolves.toBe(
      "/checkout/AHE%201/cancel?payment=expired&t=a%26b",
    );
  });
});
