import { cancellationOriginLabel } from "@/lib/cancellation-origin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireVendorRole } from "@/lib/auth-rbac";
import { getOrderRepository } from "@/lib/orders-service";
import { getPaymentReconciliationService } from "@/lib/payment-reconciliation-service";
import {
  canCancel,
  formatOrderDate,
  isOrderStatus,
  nextStatus,
  orderStatusLabel,
  paymentControlsFor,
} from "@/lib/order-status";
import { OrderItemsCard } from "@/components/orders/OrderItemsCard";
import { OrderAddressCard } from "@/components/orders/OrderAddressCard";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { StaffOrderTimeline } from "@/components/staff/StaffOrderTimeline";
import { CancelOrderForm } from "@/components/staff/CancelOrderForm";
import { advanceStatus } from "@/features/orders/advance-status";
import { cancelOrderStaff } from "@/features/orders/cancel-order-staff";
import { PageContainer } from "@/components/layout/PageContainer";
import { Icon } from "@/components/icons/Icon";
import {
  CheckPaymentControl,
  ResendConfirmationControl,
} from "@/components/staff/OrderPaymentControls";

// Reads the session and one of this vendor's orders — must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order" };

/**
 * One order, as staff see it (P6a, #158) — the first order detail view staff
 * have ever had. #129, deferred out of P4b, lands here.
 *
 * Uses getForStaff(), which is neither of the two existing reads:
 * getByOrderNumber() implements P3b's capability-URL rule and getForUser()
 * P4a's owner-only rule. Staff authority is the vendor, not ownership — so a
 * guest order with no owner at all is visible here, and another vendor's order
 * number resolves to nothing because vendorId is in the WHERE.
 */
export default async function StaffOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login");
    return (
      <PanelRefusal
        title="Staff only"
        message="This area is restricted to store staff. You're signed in, but your account doesn't have access to this store's orders."
      />
    );
  }

  const order = await getOrderRepository().getForStaff(orderNumber);
  if (!order) notFound();
  const reconciliationOutcome = await getPaymentReconciliationService().outcomeFor(orderNumber);

  const next = nextStatus(order.status, order.fulfilmentMethod);
  // #1324 — a platform admin passes requireVendorRole("ADMIN") too, so it counts as ADMIN here.
  const controls = isOrderStatus(order.status)
    ? paymentControlsFor(auth.via === "platform-admin" ? "ADMIN" : auth.via, order.status)
    : { checkPayment: false, resendEmail: false };

  return (
    <PageContainer width="narrow">
      <Link
        href="/staff/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-primary-muted hover:text-primary"
      >
        <Icon name="chevron-left" className="h-4 w-4" />
        All orders
      </Link>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Order {order.orderNumber}</h1>
          <p className="text-sm text-primary-muted">Placed {formatOrderDate(order.createdAt)}</p>
          {order.buyerEmail && (
            <p className="mt-1 truncate text-sm text-primary-muted">{order.buyerEmail}</p>
          )}
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      {order.status === "CANCELLED" && (
        // #1730 — why it was cancelled, and whether money was ever taken.
        <p className="-mt-2 mb-4 text-sm text-primary-muted">
          <span className="font-bold text-primary">
            {cancellationOriginLabel(order.cancellationOrigin)}
          </span>
          {order.neverPaid ? " · never paid, nothing was charged" : " · this order was paid"}
        </p>
      )}

      {/* The same single-rung control as the queue, driving the same action —
          legality is decided by the service against the persisted status, so
          this page cannot offer a move the service would reject. */}
      {next && (
        <form action={advanceStatus} className="mb-6">
          <input type="hidden" name="orderNumber" value={order.orderNumber} />
          <input type="hidden" name="toStatus" value={next} />
          <button
            type="submit"
            className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white"
          >
            Mark {orderStatusLabel(next).toLowerCase()}
          </button>
        </form>
      )}

      {/* #1324 — store-admin payment controls. Each action re-checks the role. */}
      {controls.checkPayment && <CheckPaymentControl orderNumber={order.orderNumber} />}
      {controls.resendEmail && <ResendConfirmationControl orderNumber={order.orderNumber} />}

      <StaffOrderTimeline timeline={order.timeline} />

      {/* #620 (via #945): confirmPayment writes the same "Payment confirmed." note
          whoever called it, so the timeline alone cannot say. The sweep records
          CONFIRMED only when its own confirm performed the transition, so a
          webhook-confirmed order never shows this. */}
      {reconciliationOutcome === "CONFIRMED" && (
        <p className="mb-6 rounded-xl bg-surface-muted px-3 py-2 text-sm text-primary-muted">
          Payment confirmed by the scheduled payment sweep, not by the payment webhook.
        </p>
      )}

      {/* P7.5b (#150): the same attributed breakdown the customer sees. Staff
          answering "why was I only charged £35?" need the identical rows — two
          different stories about one order is the defect this phase removes.
          Points earned deliberately stay off this page; see OrderPointsNote. */}
      <OrderItemsCard
        items={order.items}
        subtotalPence={order.subtotalPence}
        discountPence={order.discountPence}
        discountCode={order.discountCode}
        deliveryFeePence={order.deliveryFeePence}
        totalPence={order.totalPence}
      />

      <OrderAddressCard
        address={order.address}
        fulfilmentMethod={order.fulfilmentMethod}
        customerEmail={order.buyerEmail}
      />

      {/* P9.2 (#696) — staff cancellation of a PAID order.

          Deliberately last on the page and deliberately not on the queue: this
          is terminal and irreversible from the UI, and it does not belong beside
          the forward-only advance button where a mis-aimed click lands.

          `canCancel` is the same predicate the action re-applies to the
          persisted status, so this cannot offer a cancellation the action would
          then refuse. The required reason is both the friction that makes this a
          deliberate act and the OrderStatusEvent note that becomes the only
          durable record of why. */}
      {canCancel(order.status) && (
        <CancelOrderForm orderNumber={order.orderNumber} action={cancelOrderStaff} />
      )}
    </PageContainer>
  );
}
