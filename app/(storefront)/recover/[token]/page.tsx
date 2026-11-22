import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentVendorId } from "@/lib/tenant";
import { findRecoverableByToken } from "@/lib/abandoned-checkouts-service";
import { availabilityLabel, lineAvailability } from "@/lib/abandoned-checkout/recovery";
import { codeBenefit, NOT_CHARGED_SENTENCE } from "@/lib/abandoned-checkout/email";
import { formatPrice } from "@/components/product/format-price";
import { PageContainer } from "@/components/layout/PageContainer";
import { restoreRecoveryBasket } from "@/features/checkout/restore-recovery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your saved basket",
  robots: { index: false, follow: false },
};

/**
 * #1733 R20 — the restore link from a checkout-recovery email. This render READS ONLY: it shows the
 * basket at today's prices and availability, and the button posts to `restoreRecoveryBasket`. An
 * unknown, malformed, expired, suppressed, recovered or other-store token gets one neutral page,
 * so the response says nothing about which it was.
 */
export default async function RecoverBasketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await findRecoverableByToken(await getCurrentVendorId(), token);

  if (!row) {
    return (
      <PageContainer width="narrow">
        <h1 className="text-xl font-bold text-primary">This link has expired</h1>
        <p className="mt-2 text-sm text-primary-muted">
          It may be older than two weeks, or it has already done its job. Your basket wasn&apos;t
          kept, but everything is still in the shop.
        </p>
        <Link href="/categories" className="mt-4 inline-block font-semibold text-action underline">
          Go to the shop
        </Link>
      </PageContainer>
    );
  }

  const incentive = row.recovery?.incentive?.isActive ? row.recovery.incentive : null;
  const lines = row.items.map((item) => {
    const availability = lineAvailability(
      item.product
        ? {
            isActive: item.product.isActive,
            stockMode: item.product.stockMode,
            stockQuantity: item.product.stockQuantity,
          }
        : null,
      item.quantity,
    );
    return { item, availability };
  });
  const total = lines
    .filter(({ availability }) => availability.kind !== "unavailable")
    .reduce(
      (sum, { item }) =>
        sum + (item.product?.currentPricePence ?? item.unitPricePence) * item.quantity,
      0,
    );

  return (
    <PageContainer width="narrow">
      <h1 className="text-xl font-bold text-primary">Your saved basket</h1>
      <p className="mt-2 text-sm text-primary">{NOT_CHARGED_SENTENCE}</p>
      <p className="mt-1 text-sm text-primary-muted">
        Prices below are today&apos;s. Restoring adds what&apos;s available to your basket; nothing
        is held for you.
      </p>

      <ul className="mt-4 divide-y divide-black/5 rounded-2xl border border-black/10 bg-white">
        {lines.map(({ item, availability }, i) => (
          <li
            key={`${item.productName}-${i}`}
            className="flex justify-between gap-3 px-4 py-3 text-sm"
          >
            <span>
              {item.quantity} × {item.productName}
              <span
                className={`block text-xs ${availability.kind === "unavailable" ? "font-bold text-danger" : "text-primary-muted"}`}
              >
                {availabilityLabel(availability)}
              </span>
            </span>
            <span className="text-primary">
              {availability.kind === "unavailable"
                ? "—"
                : formatPrice(
                    (item.product?.currentPricePence ?? item.unitPricePence) * item.quantity,
                  )}
            </span>
          </li>
        ))}
        <li className="flex justify-between px-4 py-3 text-sm font-bold">
          <span>Total today</span>
          <span>{formatPrice(total)}</span>
        </li>
      </ul>

      {incentive && (
        <p className="mt-3 rounded-2xl bg-action/10 px-4 py-3 text-sm text-primary">
          Your code <strong>{incentive.code}</strong> gives you {codeBenefit(incentive)}. Enter it
          at checkout.
        </p>
      )}

      <form action={restoreRecoveryBasket} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="rounded-2xl bg-action px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          Restore my basket
        </button>
      </form>
    </PageContainer>
  );
}
