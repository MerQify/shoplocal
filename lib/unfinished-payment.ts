/**
 * Paths and states for an order whose shopper left Stripe without paying (#1589).
 *
 * A plain module because `features/checkout/resume-payment.ts` and
 * `cancel-order.ts` are `"use server"` files, which may export async functions
 * and nothing else (CLAUDE.md), and the cancel page parses what they build.
 */

/** What an action learned from Stripe, carried back to the cancel page as `?payment=`. */
export type UnfinishedPaymentParam = "expired" | "none" | "unavailable";

/** Which choices `UnfinishedPaymentChoices` shows. */
export type UnfinishedPaymentState = "open" | "past-ttl" | "expired" | "none";

function tokenSuffix(token: string | null, joiner: "?" | "&"): string {
  return token ? `${joiner}t=${encodeURIComponent(token)}` : "";
}

/** The confirmation page (Stripe's `success_url`), token kept when the shopper had one. */
export function orderConfirmationPath(orderNumber: string, token: string | null): string {
  return `/checkout/${encodeURIComponent(orderNumber)}${tokenSuffix(token, "?")}`;
}

/** The "Your payment wasn't finished" page with what the action learned. */
export function unfinishedPaymentPath(
  orderNumber: string,
  token: string | null,
  payment: UnfinishedPaymentParam,
): string {
  return `/checkout/${encodeURIComponent(orderNumber)}/cancel?payment=${payment}${tokenSuffix(token, "&")}`;
}

/**
 * The page's choices from the `?payment=` parameter and OUR clock.
 *
 * The clock alone never yields `expired`: only an action that asked Stripe sends
 * `?payment=expired`. A crafted parameter can only hide "Continue to payment" —
 * both actions re-ask Stripe before they do anything.
 */
export function unfinishedPaymentView(
  payment: string | undefined,
  pastTtl: boolean,
): { state: UnfinishedPaymentState; notice: "unavailable" | null } {
  const notice = payment === "unavailable" ? "unavailable" : null;
  if (payment === "expired") return { state: "expired", notice };
  if (payment === "none") return { state: "none", notice };
  return { state: pastTtl ? "past-ttl" : "open", notice };
}
