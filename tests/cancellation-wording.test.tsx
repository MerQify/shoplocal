// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { buildCustomerEmail } from "@/lib/order-notifications/customer-email";
import {
  CANCELLED_NEUTRAL_NEXT_STEP,
  CANCELLED_NEXT_STEP,
  cancelledNextStep,
  type CancellationNotice,
} from "@/lib/order-notifications/next-step";
import { OrderProgressTracker } from "@/components/orders/OrderProgressTracker";
import { webhookOrder } from "./fixtures/webhook-order";

/**
 * #1691 R13–R15 — the CANCELLED "what happens next" wording chosen from a staff cancellation's
 * choices, the same in the email and on the order page, with a custom message never becoming markup.
 */

afterEach(cleanup);

const notice = (
  reason: CancellationNotice["reason"],
  message: CancellationNotice["message"],
  customerMessage: string | null = null,
): CancellationNotice => ({ reason, message, customerMessage });

const CUSTOMER_REFUNDED =
  "As you asked, we've cancelled this order. Your payment has been refunded in full; it can take a few days to reach your account. Any points or discount code you used have been put back on your account.";
const CUSTOMER_NOT_REFUNDED =
  "As you asked, we've cancelled this order, and any points or discount code you used have been put back on your account. We'll refund your payment and let you know when it's done.";
const STORE_REFUNDED =
  "We're sorry — we've had to cancel this order. Your payment has been refunded in full; it can take a few days to reach your account. Any points or discount code you used have been put back on your account.";

describe("cancelledNextStep (R13)", () => {
  it.each<[string, CancellationNotice | null, string]>([
    ["customer asked, refunded", notice("CUSTOMER_REQUEST", "REFUNDED"), CUSTOMER_REFUNDED],
    [
      "customer asked, not refunded",
      notice("CUSTOMER_REQUEST", "NOT_REFUNDED"),
      CUSTOMER_NOT_REFUNDED,
    ],
    ["store unable, refunded", notice("STORE_UNABLE", "REFUNDED"), STORE_REFUNDED],
    ["other, refunded", notice("OTHER", "REFUNDED"), STORE_REFUNDED],
    ["store unable, not refunded", notice("STORE_UNABLE", "NOT_REFUNDED"), CANCELLED_NEXT_STEP],
    ["other, not refunded", notice("OTHER", "NOT_REFUNDED"), CANCELLED_NEXT_STEP],
    [
      "custom with text",
      notice("CUSTOMER_REQUEST", "CUSTOM", "We'll call you about the refund."),
      "We'll call you about the refund.",
    ],
    ["custom, empty", notice("OTHER", "CUSTOM", ""), CANCELLED_NEUTRAL_NEXT_STEP],
    ["custom, blank", notice("STORE_UNABLE", "CUSTOM", "   "), CANCELLED_NEUTRAL_NEXT_STEP],
    ["custom, null", notice("OTHER", "CUSTOM", null), CANCELLED_NEUTRAL_NEXT_STEP],
    ["no choices recorded", notice(null, null), CANCELLED_NEXT_STEP],
    ["no notice at all", null, CANCELLED_NEXT_STEP],
  ])("%s", (_label, input, expected) => {
    expect(cancelledNextStep(input)).toBe(expected);
  });

  it("the neutral wording is the exact R13 sentence", () => {
    expect(CANCELLED_NEUTRAL_NEXT_STEP).toBe(
      "This order has been cancelled. If you have any questions about it, including any payment, please reply to this email.",
    );
  });

  it("no fixed wording names a store or a product", () => {
    for (const text of [
      CUSTOMER_REFUNDED,
      CUSTOMER_NOT_REFUNDED,
      STORE_REFUNDED,
      CANCELLED_NEUTRAL_NEXT_STEP,
    ]) {
      expect(text).not.toMatch(/Aheed|SriMart|Merqify|grocer|banana|halal/i);
    }
  });
});

function cancelledEmail(cancellation: CancellationNotice | null) {
  return buildCustomerEmail({
    order: webhookOrder({ status: "CANCELLED", cancellation }),
    event: "CANCELLED",
    storeName: "Corner Shop",
    baseUrl: "https://shop.example.test",
  });
}

describe("the cancellation email (R14, R15)", () => {
  it("uses the chosen wording", () => {
    const email = cancelledEmail(notice("CUSTOMER_REQUEST", "REFUNDED"));
    expect(email.text).toContain(CUSTOMER_REFUNDED);
  });

  it("keeps the original wording for a cancellation with no choices", () => {
    expect(cancelledEmail(null).text).toContain(CANCELLED_NEXT_STEP);
  });

  it("renders a custom message as inert text in the HTML and verbatim in the text part", () => {
    const typed = '<a href="x">y</a> & "q" **not bold**';
    const email = cancelledEmail(notice("OTHER", "CUSTOM", typed));
    expect(email.html).toContain(
      "&lt;a href=&quot;x&quot;&gt;y&lt;/a&gt; &amp; &quot;q&quot; **not bold**",
    );
    expect(email.html).not.toContain('<a href="x">');
    expect(email.html).not.toContain("<strong>not bold</strong>");
    expect(email.text).toContain(typed);
  });
});

describe("the order page (R14, R15)", () => {
  const base = {
    orderNumber: "SHO-1",
    status: "CANCELLED",
    fulfilmentMethod: "COLLECTION" as const,
    timeline: [{ status: "CANCELLED", label: "Cancelled", at: new Date("2026-11-20T18:00:00Z") }],
    slotLabel: null,
  };

  it("shows the same wording as the email", () => {
    render(
      <OrderProgressTracker {...base} cancellation={notice("CUSTOMER_REQUEST", "REFUNDED")} />,
    );
    expect(screen.getByText(CUSTOMER_REFUNDED)).toBeTruthy();
  });

  it("keeps the original wording when no choices are passed", () => {
    render(<OrderProgressTracker {...base} />);
    expect(screen.getByText(CANCELLED_NEXT_STEP)).toBeTruthy();
  });

  it("renders a custom message as a text node", () => {
    const typed = '<a href="x">y</a>';
    const { container } = render(
      <OrderProgressTracker {...base} cancellation={notice("OTHER", "CUSTOM", typed)} />,
    );
    expect(screen.getByText(typed)).toBeTruthy();
    expect(container.querySelector('a[href="x"]')).toBeNull();
  });

  it("never uses dangerouslySetInnerHTML", () => {
    const source = readFileSync("components/orders/OrderProgressTracker.tsx", "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
