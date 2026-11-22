import { UNPAID_CHECKOUT_STATUS_LABEL } from "@/lib/cancellation-origin";
import { orderStatusLabel } from "@/lib/order-status";

/**
 * The customer-facing status pill (P4a, #122). Tone comes from the status alone,
 * using semantic design tokens — never raw hex (design-system.md).
 */
const TONE: Record<string, string> = {
  PENDING_PAYMENT: "bg-accent-tint text-primary",
  CONFIRMED: "bg-action/10 text-action",
  OUT_FOR_DELIVERY: "bg-accent-tint text-primary",
  DELIVERED: "bg-action/10 text-action",
  CANCELLED: "bg-danger-tint text-danger",
};

const DEFAULT_TONE = "bg-surface-muted text-primary";

/**
 * #1730 — `neverPaid` (cancelled, never paid) reads "Payment not completed" in a neutral tone: the
 * customer never placed a paid order, so it is not shown as a red "Cancelled".
 */
export function OrderStatusBadge({
  status,
  neverPaid = false,
}: {
  status: string;
  neverPaid?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
        neverPaid ? DEFAULT_TONE : (TONE[status] ?? DEFAULT_TONE)
      }`}
    >
      {neverPaid ? UNPAID_CHECKOUT_STATUS_LABEL : orderStatusLabel(status)}
    </span>
  );
}
