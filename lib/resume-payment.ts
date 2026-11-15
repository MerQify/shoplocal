import type { RetrievedSession } from "@/lib/payments";
import type { OrderPaymentState } from "@/lib/repositories/orders";

/**
 * "Continue to payment" for an order whose shopper left Stripe without paying (#1589).
 *
 * Decides where the shopper goes from the order's OWN stored session and Stripe's
 * answer about it — never from the order's age. A second session for the same
 * order is the binding mismatch #429/#454 guard against, so this only ever
 * reopens the one already stored.
 *
 * Read-only: `deps` has no member that writes, so nothing here can confirm,
 * cancel or release an order. A verified payment (`paid`) is tested before
 * `open`/`expired`, so it always wins; the confirmation page's own
 * `PaymentStatusCheck` (#1324) then confirms it.
 *
 * Every import above is type-only and erased, the same property
 * `lib/payment-check.ts` keeps: the table is unit-tested with plain objects for
 * deps, no database, no Stripe key and no `vi.mock`.
 */

export interface ResumePaymentDeps {
  retrieveSession(sessionId: string): Promise<RetrievedSession>;
}

export type ResumePaymentOutcome =
  | { kind: "not-pending" }
  | { kind: "no-session" }
  | { kind: "provider-error" }
  | { kind: "complete" }
  | { kind: "open"; url: string }
  | { kind: "expired" }
  | { kind: "unavailable" };

export async function resumeOrderPayment(
  deps: ResumePaymentDeps,
  order: OrderPaymentState,
): Promise<ResumePaymentOutcome> {
  if (order.status !== "PENDING_PAYMENT") return { kind: "not-pending" };
  if (order.providerReference === null) return { kind: "no-session" };

  let session: RetrievedSession;
  try {
    session = await deps.retrieveSession(order.providerReference);
  } catch {
    // "Could not ask" is never "expired" — the shopper is offered a retry.
    return { kind: "provider-error" };
  }

  if (session.paymentStatus === "paid" || session.status === "complete") {
    return { kind: "complete" };
  }
  // Only an https page is followed, even though the URL comes from Stripe's own
  // response: a redirect target read from a remote API is checked anyway.
  if (session.status === "open" && session.url?.startsWith("https://")) {
    return { kind: "open", url: session.url };
  }
  if (session.status === "expired") return { kind: "expired" };
  // Includes the stub adapter (`open` with no URL): there is nowhere to pay.
  return { kind: "unavailable" };
}
