"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getOrderRepository } from "@/lib/orders-service";
import { getResumePaymentService } from "@/lib/resume-payment-service";
import { orderConfirmationPath, unfinishedPaymentPath } from "@/lib/unfinished-payment";

/**
 * "Continue to payment" (#1589): send the shopper back to their order's OWN
 * Stripe session, or tell them truthfully why that is not possible.
 *
 * A POST server action, not part of the page's GET render — Stripe returns the
 * browser to the cancel page with a GET, and prefetchers follow GETs (#428).
 *
 * The hidden fields are attacker-controlled, so access is re-proved exactly as
 * `cancelOrder` and the pages do: the member's own order, or a guest order with
 * the right capability token. A refusal goes to /orders/lookup, the pages' one
 * refusal branch, and the Stripe URL is never revealed.
 *
 * Writes nothing. A repeat click reopens the same session.
 *
 * NOTE: this file may export async functions and nothing else (CLAUDE.md's
 * Server Actions section).
 */
export async function resumePayment(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const token = String(formData.get("t") ?? "") || null;

  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  const viewerUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const order = await getOrderRepository().getByOrderNumber(orderNumber, viewerUserId, token);
  if (!order) redirect(`/orders/lookup?orderNumber=${encodeURIComponent(orderNumber)}`);

  const outcome = await getResumePaymentService().resume(orderNumber);

  let destination: string;
  switch (outcome.kind) {
    case "open":
      destination = outcome.url;
      break;
    case "complete":
    case "not-pending":
      // The confirmation page confirms a paid order whose webhook is late (#1324).
      destination = orderConfirmationPath(orderNumber, token);
      break;
    case "expired":
      destination = unfinishedPaymentPath(orderNumber, token, "expired");
      break;
    case "no-session":
      destination = unfinishedPaymentPath(orderNumber, token, "none");
      break;
    default:
      // provider-error, unavailable, not-found: retryable, never reported as expired.
      destination = unfinishedPaymentPath(orderNumber, token, "unavailable");
  }

  // Outside any try/catch: redirect() throws a control-flow signal.
  redirect(destination);
}
