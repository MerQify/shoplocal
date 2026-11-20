"use server";

import { redirect } from "next/navigation";
import { getOrderCancelService, getOrderRepository } from "@/lib/orders-service";
import { getCartRepository } from "@/lib/cart-service";
import { getCartIdentity } from "@/lib/cart-identity";
import { scopedToUser } from "@/features/cart/shared";
import { restoredLines } from "@/lib/restore-lines";
import { buildRestoreNoticeUrl } from "@/lib/restore-notice";
import { getPaymentCheckService } from "@/lib/payment-check-service";
import { getPaymentService } from "@/lib/payments";
import { orderConfirmationPath, unfinishedPaymentPath } from "@/lib/unfinished-payment";

/**
 * Cancel a still-unpaid order and put its lines back in the cart (P9.1, #428).
 *
 * This used to be `app/api/checkout/cancel/route.ts`, a GET that cancelled the
 * order and released its inventory on sight. Stripe's `cancel_url` returns the
 * browser with a GET, so the route was reachable — and destructive — to any link
 * prefetcher, mail scanner, chat unfurler or crawler that so much as touched the
 * URL. Splitting it was the fix: the page at
 * `app/(storefront)/checkout/[orderNumber]/cancel/page.tsx` asks, and this
 * action acts.
 *
 * The hidden fields are attacker-controlled like any other form input, so this
 * re-proves the capability token rather than trusting that the page already did
 * — the same posture `eraseGuestOrder` takes with the order-number/email pair.
 *
 * Refusal ends at plain `/cart`, so the response says nothing about whether the
 * order existed or the token was right.
 *
 * #1589 — Stripe is asked BEFORE anything is cancelled, through the same
 * single-order check the return page uses (`getPaymentCheckService().check`).
 * A shopper who paid in another tab, whose webhook has not arrived, is confirmed
 * and sent to the confirmation page instead of having a paid order cancelled.
 * When Stripe cannot be reached nothing is cancelled — not knowing is not
 * "unpaid" — and the shopper is offered a retry; the scheduled sweep remains the
 * release path if Stripe stays down.
 *
 * And the basket is restored only when THIS call's `cancelUnpaid` performed the
 * cancellation. `releaseOrder` is a compare-and-set, so a double submit cancels
 * once; before #1589 both submits restored, doubling every line.
 *
 * NOTE: this file may export async functions and nothing else. A single value
 * export makes every action in it fail at runtime while `build`, `typecheck` and
 * `test` all stay green (CLAUDE.md's Server Actions section).
 */
export async function cancelOrder(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const token = String(formData.get("t") ?? "");

  const identity = await getCartIdentity();
  const scoped = scopedToUser(identity);
  const userId = scoped.userId ?? null;

  const order = await getOrderRepository().getByOrderNumber(orderNumber, userId, token || null);
  // A refusal, a repeat cancel and an unknown order land on plain `/cart`, which says nothing
  // about the order.
  let destination = "/cart";

  // Only PENDING_PAYMENT is cancellable. A paid or already-cancelled order is
  // left exactly as it is — the same guard the deleted route carried.
  if (order && order.status === "PENDING_PAYMENT") {
    const tokenOrNull = token || null;
    const check = await getPaymentCheckService().check(orderNumber);

    switch (check.kind) {
      case "confirmed":
      case "not-pending":
      case "refused":
        // Paid (or moved on) after all. `refused` means Stripe said paid but the
        // stored binding disagreed — an anomaly already persisted for staff, which
        // cancelling would bury.
        destination = orderConfirmationPath(orderNumber, tokenOrNull);
        break;
      case "provider-error":
        destination = unfinishedPaymentPath(orderNumber, tokenOrNull, "unavailable");
        break;
      case "no-session":
      case "not-paid": {
        // Not the webhook's `fail` any more (P9.1, #429): that now requires a
        // payment binding proving which Stripe session an event is about, and a
        // shopper cancelling from their own browser has none. This path's
        // credential is the capability token, already proved above.
        const cancelled = await getOrderCancelService().cancelUnpaid(
          orderNumber,
          "Shopper cancelled payment at checkout",
        );

        // #957 — and say what could not go back (a product deactivated since the order was placed,
        // or stock taken by someone else after the release above), rather than handing back a
        // short basket with no message. Only after this call's own cancel (#1589).
        if (cancelled) {
          // #1690 R8 — close the hosted page too, or the cancelled order stays payable until
          // Stripe's own expiry. Best-effort: the cancel already happened, and a failure here
          // must change neither the redirect nor the basket restore below.
          if (check.kind === "not-paid") {
            try {
              await getPaymentService().expireSession?.(check.sessionId);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error(`[payments] expireSession failed for order ${orderNumber}: ${message}`);
            }
          }
          const lines = await restoredLines(order.items, (toAdd) =>
            getCartRepository().addItems(scoped, toAdd),
          );
          destination = buildRestoreNoticeUrl("cancelled", lines);
        }
        break;
      }
      // not-found: plain /cart.
    }
  }

  // Outside any try/catch: redirect() throws a control-flow signal that must not
  // be swallowed.
  redirect(destination);
}
