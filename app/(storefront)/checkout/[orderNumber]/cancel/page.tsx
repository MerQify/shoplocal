import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getOrderRepository } from "@/lib/orders-service";
import { getAuth } from "@/lib/auth";
import { formatPrice } from "@/components/product/format-price";
import { isPastCheckoutSessionTtl } from "@/lib/payments";
import { unfinishedPaymentView } from "@/lib/unfinished-payment";
import { UnfinishedPaymentChoices } from "@/components/checkout/UnfinishedPaymentChoices";
import { PaymentStatusCheck } from "@/components/checkout/PaymentStatusCheck";
import { PageContainer } from "@/components/layout/PageContainer";
import { IconMedallion } from "@/components/icons/IconMedallion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your payment wasn't finished" };

/**
 * "Your payment wasn't finished" (P9.1, #428; #1589).
 *
 * Stripe's `cancel_url` points here, and Stripe returns the browser with a GET.
 * This page therefore does the one thing a GET is allowed to do — ask. Both
 * choices are POST server actions: `resumePayment` reopens the order's own Stripe
 * session, `cancelOrder` cancels and puts the items back in the basket. That
 * keeps every effect out of reach of the prefetchers, mail scanners and
 * unfurlers that follow a URL.
 *
 * #1589 — before this, the page's other option was a link to `/cart`, which
 * `placeOrder` had already emptied, and nothing linked back to the open session.
 *
 * The render asks Stripe nothing. Which choices show comes from `?payment=`,
 * set by an action after Stripe answered, or from our clock, which only softens
 * the wording; see `unfinishedPaymentView`. `PaymentStatusCheck` asks once, via
 * a POST, whether the order was paid in another tab, and the page then redirects
 * to the confirmation page by itself.
 *
 * Authorized exactly like the confirmation page, through the same
 * `getByOrderNumber` call: a member's order is theirs alone, a guest order needs
 * the capability token in `?t=`, and every refusal takes one branch to
 * /orders/lookup rather than a distinguishable 404.
 *
 * A plain server-rendered form, no client JS — the same progressive-enhancement
 * shape the staff panel uses.
 */
export default async function CancelOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string; payment?: string }>;
}) {
  const { orderNumber } = await params;
  const { t, payment } = await searchParams;
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  const viewerUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const order = await getOrderRepository().getByOrderNumber(orderNumber, viewerUserId, t ?? null);
  if (!order) redirect(`/orders/lookup?orderNumber=${encodeURIComponent(orderNumber)}`);

  // Nothing left to decide once the order has moved on. Sending them to the
  // confirmation page keeps the token in hand rather than dropping them at a
  // dead end.
  if (order.status !== "PENDING_PAYMENT") {
    redirect(
      `/checkout/${encodeURIComponent(orderNumber)}${t ? `?t=${encodeURIComponent(t)}` : ""}`,
    );
  }

  const { state, notice } = unfinishedPaymentView(
    payment,
    isPastCheckoutSessionTtl(order.createdAt, new Date()),
  );

  return (
    <PageContainer width="standard">
      <PaymentStatusCheck orderNumber={order.orderNumber} token={t ?? null} />

      <div className="mb-6 flex items-center gap-3">
        <IconMedallion
          icon="circle-alert"
          size={32}
          tint="accent"
          className="shrink-0"
          decorative
        />
        <div>
          <h1 className="text-xl font-bold text-primary">Your payment wasn&apos;t finished</h1>
          <p className="text-sm text-primary-muted">
            Order <span className="font-semibold text-primary">{order.orderNumber}</span> has not
            been paid for. Order total {formatPrice(order.totalPence)}.
          </p>
        </div>
      </div>

      <UnfinishedPaymentChoices
        orderNumber={order.orderNumber}
        token={t ?? null}
        state={state}
        notice={notice}
      />
    </PageContainer>
  );
}
