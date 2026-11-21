/**
 * #1435 R12 — "what happens next", the one source both the customer emails and the order progress
 * tracker read (`components/orders/OrderProgressTracker.tsx`), so the page and the email can never
 * tell a customer two different things.
 *
 * Leading with the next step is deliberate: waiting is what makes an order anxious, and a concrete
 * next step with a real time window removes most of that (uncertainty reduction). The copy stays
 * neutral — no store name, no product example — because vendors sell different things.
 *
 * Pure and import-free, so a client component can use it.
 */

export const ORDER_EVENTS = [
  "CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "READY_FOR_COLLECTION",
  "COLLECTED",
  "CANCELLED",
  // #1552 — not an order status: the webhook names it for an async payment failure.
  "PAYMENT_FAILED",
] as const;

export type OrderEvent = (typeof ORDER_EVENTS)[number];

export type FulfilmentMethodValue = "DELIVERY" | "COLLECTION";

export function isOrderEvent(status: string): status is OrderEvent {
  return (ORDER_EVENTS as readonly string[]).includes(status);
}

/**
 * The P9.2 (#696) cancellation copy, verbatim. It is careful about money on purpose: no code path
 * issues a refund (#606), so it says plainly that the charge stands and points to a human.
 */
export const CANCELLED_NEXT_STEP =
  "We're sorry — we've had to cancel this order and any points or discount code you used have been put back on your account. No payment has been returned yet, so please reply to this email and we'll sort that out with you directly.";

/**
 * #1691 — what staff chose when cancelling (`OrderStatusEvent.cancellation*`). String unions rather
 * than the Prisma enums so this file stays import-free for client components. Every field null (or
 * no notice at all) means a cancellation made before #1691, or by the system: original wording.
 */
export interface CancellationNotice {
  reason: "CUSTOMER_REQUEST" | "STORE_UNABLE" | "OTHER" | null;
  message: "REFUNDED" | "NOT_REFUNDED" | "CUSTOM" | null;
  customerMessage: string | null;
}

const REFUNDED_SENTENCE =
  "Your payment has been refunded in full; it can take a few days to reach your account.";
const PUT_BACK_SENTENCE =
  "Any points or discount code you used have been put back on your account.";

/** #1691 R13 — the "Write my own message" choice with nothing written: says nothing it can't know. */
export const CANCELLED_NEUTRAL_NEXT_STEP =
  "This order has been cancelled. If you have any questions about it, including any payment, please reply to this email.";

/** #1691 R13 — the CANCELLED text for a staff cancellation's choices; one table for email and page. */
export function cancelledNextStep(notice: CancellationNotice | null | undefined): string {
  if (!notice || notice.message === null) return CANCELLED_NEXT_STEP;
  if (notice.message === "CUSTOM") {
    const custom = notice.customerMessage?.trim() ?? "";
    return custom.length > 0 ? custom : CANCELLED_NEUTRAL_NEXT_STEP;
  }
  const customerAsked = notice.reason === "CUSTOMER_REQUEST";
  if (notice.message === "REFUNDED") {
    return customerAsked
      ? `As you asked, we've cancelled this order. ${REFUNDED_SENTENCE} ${PUT_BACK_SENTENCE}`
      : `We're sorry — we've had to cancel this order. ${REFUNDED_SENTENCE} ${PUT_BACK_SENTENCE}`;
  }
  return customerAsked
    ? "As you asked, we've cancelled this order, and any points or discount code you used have been put back on your account. We'll refund your payment and let you know when it's done."
    : CANCELLED_NEXT_STEP;
}

/** #1552 — an async payment method failed, so `failPayment` cancelled the order and released stock. */
export const PAYMENT_FAILED_NEXT_STEP =
  "No money has been taken and the items have been released. You're welcome to place the order again whenever you're ready.";

const DONE =
  "Nothing else to do. If anything isn't right, reply to this email and we'll put it right.";

/** The text for a status, or null where there is none (e.g. `PENDING_PAYMENT`). */
export function nextStepText(
  status: string,
  method: FulfilmentMethodValue,
  orderNumber: string,
  /** #1691 — the staff cancellation's choices; only read for CANCELLED. */
  cancellation?: CancellationNotice | null,
): string | null {
  switch (status) {
    case "CONFIRMED":
      return method === "COLLECTION"
        ? "We'll pack your order and email you as soon as it's ready to collect."
        : "We'll pack your order and email you when it's out for delivery.";
    case "OUT_FOR_DELIVERY":
      return "Our driver has your order now. Please keep your phone nearby in case they need to reach you.";
    case "READY_FOR_COLLECTION":
      return `Your items are packed and waiting for you in store. Bring your order number: ${orderNumber}.`;
    case "DELIVERED":
    case "COLLECTED":
      return DONE;
    case "CANCELLED":
      return cancelledNextStep(cancellation);
    case "PAYMENT_FAILED":
      return PAYMENT_FAILED_NEXT_STEP;
    default:
      return null;
  }
}

/** The slot sentence that follows the text, or null without a slot label or for a final status. */
export function slotSentence(
  status: string,
  method: FulfilmentMethodValue,
  slotLabel: string | null,
): string | null {
  if (!slotLabel) return null;
  switch (status) {
    case "CONFIRMED":
      return method === "COLLECTION"
        ? `Your collection slot: ${slotLabel}.`
        : `Your delivery slot: ${slotLabel}.`;
    case "OUT_FOR_DELIVERY":
      return `Expected: ${slotLabel}.`;
    case "READY_FOR_COLLECTION":
      return `Your collection slot: ${slotLabel}.`;
    default:
      return null;
  }
}
