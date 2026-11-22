import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  UNPAID_CHECKOUT_WHERE,
  isUnpaidCheckout,
  listOrdersForStaff,
  listOrdersForUser,
} from "@/lib/repositories/orders";
import { parseStaffOrdersQuery, staffOrdersHref } from "@/lib/staff-orders-query";
import {
  UNPAID_CHECKOUT_MESSAGE,
  UNRECORDED_ORIGIN_LABEL,
  cancellationOriginLabel,
} from "@/lib/cancellation-origin";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { UnpaidCheckoutNotice } from "@/components/orders/UnpaidCheckoutNotice";

/**
 * #1730 — unpaid checkouts (cancelled, never paid) told apart from real cancellations.
 *
 * The predicate is a FACT about Payment, not the recorded reason, so it has to be right for every
 * payment status — above all, it must never match an order the customer paid for.
 */

/** Evaluates UNPAID_CHECKOUT_WHERE the way Postgres would, for one order. */
function matchesUnpaidWhere(order: { status: string; paymentStatus: string | null }): boolean {
  const where = UNPAID_CHECKOUT_WHERE;
  if (order.status !== where.status) return false;
  const paidStatuses = where.NOT.payment.is.status.in as string[];
  const paymentIsPaid = order.paymentStatus !== null && paidStatuses.includes(order.paymentStatus);
  return !paymentIsPaid;
}

describe("UNPAID_CHECKOUT_WHERE / isUnpaidCheckout (#1730 R6)", () => {
  const cases: [status: string, payment: string | null, unpaid: boolean][] = [
    ["CANCELLED", null, true], // provider unreachable at placement: no Payment row
    ["CANCELLED", "PENDING", true],
    ["CANCELLED", "FAILED", true], // releaseOrder marks the payment FAILED
    ["CANCELLED", "SUCCEEDED", false], // paid, then cancelled by staff
    ["CANCELLED", "REFUNDED", false], // paid, cancelled and refunded
    ["PENDING_PAYMENT", null, false],
    ["PENDING_PAYMENT", "PENDING", false],
    ["CONFIRMED", "SUCCEEDED", false],
    ["DELIVERED", "SUCCEEDED", false],
  ];

  it.each(cases)("status %s with payment %s → unpaid checkout: %s", (status, payment, unpaid) => {
    expect(matchesUnpaidWhere({ status, paymentStatus: payment })).toBe(unpaid);
    expect(isUnpaidCheckout(status, payment)).toBe(unpaid);
  });
});

function capturingPrisma() {
  const findMany = vi.fn(async (_args: { where: Record<string, unknown> }) => []);
  return { prisma: { order: { findMany } } as never, findMany };
}

describe("listOrdersForUser (#1730 R7)", () => {
  it("excludes unpaid checkouts and nothing else", async () => {
    const { prisma, findMany } = capturingPrisma();
    await listOrdersForUser(prisma, "v1", "u1", { take: 10 });

    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({ vendorId: "v1", userId: "u1", NOT: UNPAID_CHECKOUT_WHERE });
  });
});

describe("staff orders list (#1730 R10)", () => {
  it("hides unpaid checkouts by default, even under the CANCELLED filter", async () => {
    const { prisma, findMany } = capturingPrisma();
    const query = parseStaffOrdersQuery({ status: "CANCELLED" });
    expect(query.includeUnpaid).toBe(false);

    await listOrdersForStaff(prisma, "v1", { take: 10, filter: query });

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      status: { in: ["CANCELLED"] },
      NOT: UNPAID_CHECKOUT_WHERE,
    });
  });

  it("includes them with ?unpaid=1, and carries the flag into the pagination link", async () => {
    const { prisma, findMany } = capturingPrisma();
    const query = parseStaffOrdersQuery({ status: "CANCELLED", unpaid: "1" });
    expect(query.includeUnpaid).toBe(true);

    await listOrdersForStaff(prisma, "v1", { take: 10, filter: query });

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("NOT");
    expect(staffOrdersHref(query, "c1")).toBe("/staff/orders?status=CANCELLED&unpaid=1&cursor=c1");
  });

  it("treats anything but exactly '1' as off", () => {
    for (const unpaid of ["", "0", "true", "yes", undefined]) {
      expect(parseStaffOrdersQuery({ unpaid }).includeUnpaid).toBe(false);
    }
  });
});

describe("cancellation origin labels (#1730 R11)", () => {
  it("labels every origin, and an unrecorded one honestly", () => {
    expect(cancellationOriginLabel("CHECKOUT_CHANGED")).toBe("Changed at checkout");
    expect(cancellationOriginLabel("PAYMENT_EXPIRED")).toBe("Payment link expired");
    expect(cancellationOriginLabel("PAYMENT_FAILED")).toBe("Payment failed");
    expect(cancellationOriginLabel("CHECKOUT_ABANDONED")).toBe("Checkout abandoned");
    expect(cancellationOriginLabel("PROVIDER_UNAVAILABLE")).toBe("Payment service unavailable");
    expect(cancellationOriginLabel("STAFF")).toBe("Cancelled by store");
    expect(cancellationOriginLabel(null)).toBe(UNRECORDED_ORIGIN_LABEL);
    expect(cancellationOriginLabel("SOMETHING_NEW")).toBe(UNRECORDED_ORIGIN_LABEL);
  });
});

describe("customer wording (#1730 R8/R9)", () => {
  it("an unpaid checkout reads 'Payment not completed', never 'Cancelled'", () => {
    const html = renderToStaticMarkup(OrderStatusBadge({ status: "CANCELLED", neverPaid: true }));
    expect(html).toContain("Payment not completed");
    expect(html).not.toContain("Cancelled");
    // The apostrophe is HTML-escaped in markup, so match up to it.
    expect(renderToStaticMarkup(UnpaidCheckoutNotice())).toContain(
      "Payment not completed. You haven",
    );
    expect(UNPAID_CHECKOUT_MESSAGE).toBe("Payment not completed. You haven't been charged.");
  });

  it("a paid order the store cancelled still reads 'Cancelled'", () => {
    const html = renderToStaticMarkup(OrderStatusBadge({ status: "CANCELLED" }));
    expect(html).toContain("Cancelled");
  });
});
