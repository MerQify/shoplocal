/**
 * Why an order was cancelled (#1730) — pure presentation and vocabulary, no I/O, and deliberately no
 * `@prisma/client` import (same split as `lib/order-status.ts`). The string union below mirrors the
 * Prisma `CancellationOrigin` enum value for value, so it is assignable to it at every write site.
 *
 * Every value except `STAFF` is a never-paid checkout leaving `PENDING_PAYMENT` through
 * `releaseOrder`. Whether an order was ever PAID is not read from here: that is a fact on `Payment`
 * (`UNPAID_CHECKOUT_WHERE` in `lib/repositories/orders.ts`), which also covers historical orders
 * whose origin was never recorded.
 */
export type CancellationOriginValue =
  | "CHECKOUT_CHANGED"
  | "CHECKOUT_ABANDONED"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "STAFF";

/** Staff-facing label for each origin; `null` is a historical cancellation with no proven reason. */
const LABELS: Record<CancellationOriginValue, string> = {
  CHECKOUT_CHANGED: "Changed at checkout",
  PAYMENT_EXPIRED: "Payment link expired",
  PAYMENT_FAILED: "Payment failed",
  CHECKOUT_ABANDONED: "Checkout abandoned",
  PROVIDER_UNAVAILABLE: "Payment service unavailable",
  STAFF: "Cancelled by store",
};

export const UNRECORDED_ORIGIN_LABEL = "Reason not recorded";

export function cancellationOriginLabel(origin: string | null | undefined): string {
  if (!origin) return UNRECORDED_ORIGIN_LABEL;
  return LABELS[origin as CancellationOriginValue] ?? UNRECORDED_ORIGIN_LABEL;
}

/** Customer-facing status and sentence for a cancelled order that was never paid (#1730 R8). */
export const UNPAID_CHECKOUT_STATUS_LABEL = "Payment not completed";
export const UNPAID_CHECKOUT_MESSAGE = "Payment not completed. You haven't been charged.";
