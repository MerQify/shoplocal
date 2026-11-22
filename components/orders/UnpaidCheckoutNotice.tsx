import { UNPAID_CHECKOUT_MESSAGE } from "@/lib/cancellation-origin";

/**
 * #1730 R8 — what a customer sees when they open a checkout they never paid for (pressed back,
 * changed the basket, or let the payment link expire). It replaces the progress tracker, whose
 * CANCELLED wording describes a real order being cancelled.
 */
export function UnpaidCheckoutNotice() {
  return (
    <p className="mb-5 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-primary">
      {UNPAID_CHECKOUT_MESSAGE}
    </p>
  );
}
