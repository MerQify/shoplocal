import { describe, it, expect, vi } from "vitest";
import { resumeOrderPayment } from "@/lib/resume-payment";
import type { RetrievedSession } from "@/lib/payments";
import type { OrderPaymentState } from "@/lib/repositories/orders";

/**
 * #1589 R4 — "Continue to payment"'s decision table, driven with plain-object
 * deps: no database, no Stripe, no `vi.mock` (every import in the module is a
 * type import).
 */

const pending: OrderPaymentState = {
  orderNumber: "AHE-1",
  status: "PENDING_PAYMENT",
  providerReference: "cs_test_1",
};

const session = (over: Partial<RetrievedSession>): RetrievedSession => ({
  id: "cs_test_1",
  paymentStatus: "unpaid",
  status: "open",
  amountTotal: 1234,
  currency: "gbp",
  url: "https://checkout.stripe.com/c/pay/cs_test_1",
  ...over,
});

const depsReturning = (s: RetrievedSession) => ({
  retrieveSession: vi.fn(async (_id: string) => s),
});

describe("resumeOrderPayment (#1589 R4)", () => {
  it("a: an order no longer pending is not-pending, and Stripe is not asked", async () => {
    const deps = depsReturning(session({}));
    await expect(resumeOrderPayment(deps, { ...pending, status: "CONFIRMED" })).resolves.toEqual({
      kind: "not-pending",
    });
    expect(deps.retrieveSession).not.toHaveBeenCalled();
  });

  it("b: an order with no stored session is no-session, and Stripe is not asked", async () => {
    const deps = depsReturning(session({}));
    await expect(
      resumeOrderPayment(deps, { ...pending, providerReference: null }),
    ).resolves.toEqual({ kind: "no-session" });
    expect(deps.retrieveSession).not.toHaveBeenCalled();
  });

  it("c: a provider failure is provider-error, never expired", async () => {
    const deps = {
      retrieveSession: vi.fn(async () => {
        throw new Error("Stripe down");
      }),
    };
    await expect(resumeOrderPayment(deps, pending)).resolves.toEqual({ kind: "provider-error" });
  });

  it("asks Stripe about the order's own stored session id", async () => {
    const deps = depsReturning(session({}));
    await resumeOrderPayment(deps, pending);
    expect(deps.retrieveSession).toHaveBeenCalledTimes(1);
    expect(deps.retrieveSession).toHaveBeenCalledWith("cs_test_1");
  });

  it("d: a paid session is complete", async () => {
    await expect(
      resumeOrderPayment(
        depsReturning(session({ paymentStatus: "paid", status: "complete" })),
        pending,
      ),
    ).resolves.toEqual({ kind: "complete" });
  });

  it("d: a complete session is complete even without paid", async () => {
    await expect(
      resumeOrderPayment(depsReturning(session({ status: "complete", url: null })), pending),
    ).resolves.toEqual({ kind: "complete" });
  });

  it("d: a verified payment wins over an expired status", async () => {
    await expect(
      resumeOrderPayment(
        depsReturning(session({ paymentStatus: "paid", status: "expired" })),
        pending,
      ),
    ).resolves.toEqual({ kind: "complete" });
  });

  it("d: a verified payment wins over an open status", async () => {
    await expect(
      resumeOrderPayment(
        depsReturning(session({ paymentStatus: "paid", status: "open" })),
        pending,
      ),
    ).resolves.toEqual({ kind: "complete" });
  });

  it("e: an open session with an https URL reopens that URL", async () => {
    await expect(resumeOrderPayment(depsReturning(session({})), pending)).resolves.toEqual({
      kind: "open",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
  });

  it("f: an expired session is expired", async () => {
    await expect(
      resumeOrderPayment(depsReturning(session({ status: "expired", url: null })), pending),
    ).resolves.toEqual({ kind: "expired" });
  });

  it("g: an open session with no URL (the stub) is unavailable", async () => {
    await expect(
      resumeOrderPayment(depsReturning(session({ url: null })), pending),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("g: an open session with a non-https URL is unavailable", async () => {
    await expect(
      resumeOrderPayment(depsReturning(session({ url: "http://checkout.stripe.com/x" })), pending),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("g: an unknown session status is unavailable", async () => {
    await expect(
      resumeOrderPayment(depsReturning(session({ status: null })), pending),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
