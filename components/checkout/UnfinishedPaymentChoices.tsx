import { resumePayment } from "@/features/checkout/resume-payment";
import { cancelOrder } from "@/features/checkout/cancel-order";
import { PendingSubmitButton } from "@/components/checkout/PendingSubmitButton";
import type { UnfinishedPaymentState } from "@/lib/unfinished-payment";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-action-hover disabled:opacity-60";
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 px-4 py-2 text-xs font-bold text-primary transition-colors hover:border-primary/40 disabled:opacity-60";

/**
 * The choices for an order whose shopper left Stripe without paying (#1589),
 * shared by the cancel page (Stripe's `cancel_url`) and the member order page.
 *
 * `state` comes from what Stripe said (`expired`, `none`) or, failing that, from
 * our clock (`past-ttl` only softens the wording — the Continue button stays).
 *
 * Each choice is its own form with one submit button: a button meant to keep
 * the order can never submit the form that cancels it. Both actions re-prove the
 * token carried in the hidden field — this having rendered authorizes nothing.
 *
 * No client JS of its own; only the buttons are client components.
 */
export function UnfinishedPaymentChoices({
  orderNumber,
  token,
  state,
  notice,
}: {
  orderNumber: string;
  token: string | null;
  state: UnfinishedPaymentState;
  notice: "unavailable" | null;
}) {
  const hidden = (
    <>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="t" value={token ?? ""} />
    </>
  );
  const canContinue = state === "open" || state === "past-ttl";

  return (
    <div className="rounded-2xl border border-black/10 bg-surface-muted p-4">
      {notice === "unavailable" && (
        <p
          role="status"
          className="mb-3 rounded-xl bg-danger-tint px-3 py-2 text-xs font-semibold text-danger"
        >
          We couldn&apos;t reach the payment service just now. Nothing has changed — please try
          again.
        </p>
      )}

      {state === "past-ttl" && (
        <p className="mb-3 text-xs leading-relaxed text-primary-muted">
          This payment link may have expired. If it has, we&apos;ll tell you when you continue.
        </p>
      )}
      {state === "expired" && (
        <p className="mb-3 text-xs font-semibold text-primary">
          This payment link has expired — nothing was charged.
        </p>
      )}
      {state === "none" && (
        <p className="mb-3 text-xs font-semibold text-primary">
          There&apos;s no payment page to return to for this order — nothing was charged.
        </p>
      )}

      {canContinue ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <form action={resumePayment}>
              {hidden}
              <PendingSubmitButton pendingLabel="Opening payment…" className={PRIMARY}>
                Continue to payment
              </PendingSubmitButton>
            </form>
            <form action={cancelOrder}>
              {hidden}
              <PendingSubmitButton pendingLabel="Changing…" className={SECONDARY}>
                Change my order
              </PendingSubmitButton>
            </form>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-primary-muted">
            Changing your order cancels it and nothing is charged. Your items go back into your
            basket, so you can change anything before checking out again.
          </p>
        </>
      ) : (
        <form action={cancelOrder}>
          {hidden}
          <PendingSubmitButton pendingLabel="Putting items back…" className={PRIMARY}>
            Put my items back in the basket
          </PendingSubmitButton>
        </form>
      )}
    </div>
  );
}
