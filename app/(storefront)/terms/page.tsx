import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentVendorProfile } from "@/lib/vendor-service";
import { PageContainer } from "@/components/layout/PageContainer";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getCurrentVendorProfile();
  const vendorName = profile?.name ?? "Aheed Food Centre";
  return {
    title: `Terms of Service — ${vendorName}`,
    description: `Terms and conditions governing orders, delivery, pricing, and services at ${vendorName}.`,
    alternates: { canonical: "/terms" },
  };
}

export default async function TermsPage() {
  const profile = await getCurrentVendorProfile();
  const vendorName = profile?.name ?? "Aheed Food Centre";

  return (
    <PageContainer width="narrow" className="text-primary">
      <nav className="mb-6 text-xs text-primary-muted">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span className="text-primary font-medium">Terms of Service</span>
      </nav>

      <article className="prose prose-sm max-w-none space-y-6">
        <header className="border-b border-black/10 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">{vendorName} — Terms of Service</h1>
          <p className="text-xs text-primary-muted mt-1">Last updated: November 18, 2026</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">1. Overview</h2>
          <p className="text-sm text-primary-muted leading-relaxed">
            Welcome to {vendorName}. These terms and conditions govern your use of our website,
            catalogue browsing, cart reservation, checkout, and home delivery services within our
            supported delivery areas.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">2. Pricing and Availability</h2>
          <p className="text-sm text-primary-muted leading-relaxed">
            All prices displayed on our website are in Pound Sterling (GBP) inclusive of applicable
            VAT. Product availability is updated dynamically. In the unlikely event an item becomes
            unavailable after order placement, we will issue a full refund for the unavailable item.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">3. Delivery Terms</h2>
          <p className="text-sm text-primary-muted leading-relaxed">
            Deliveries are made to supported postcode areas. Minimum order values and delivery fees
            apply as stated at checkout. You must ensure someone is available at the delivery
            address to receive your order.
          </p>
        </section>

        {/* #1055 — the footer's "Returns & refunds" link lands here. */}
        <section id="refunds" className="scroll-mt-24 space-y-2">
          <h2 className="text-lg font-semibold text-primary">
            4. Cancellations, Returns & Refunds
          </h2>
          {/* #1652 — written for the shopper and vendor-neutral: this page serves every vendor,
              so it states the statutory position rather than one trade's examples or deadlines. */}
          <h3 className="text-sm font-semibold text-primary">Changing or cancelling an order</h3>
          <p className="text-sm text-primary-muted leading-relaxed">
            You can cancel an order at no cost until we start preparing it. Contact us with your
            order number and we will cancel it and refund you in full.
          </p>
          <h3 className="text-sm font-semibold text-primary">Something wrong with your order?</h3>
          <p className="text-sm text-primary-muted leading-relaxed">
            If an item arrives damaged, faulty, missing or not what you ordered, tell us as soon as
            possible after you receive it. Include your order number and, if you can, a photo. We
            will replace the item or refund it. Your statutory rights under the Consumer Rights Act
            2015 are not affected.
          </p>
          <h3 className="text-sm font-semibold text-primary">Your right to cancel</h3>
          <p className="text-sm text-primary-muted leading-relaxed">
            For most goods you have 14 days from the day you receive them to cancel your order
            without giving a reason. Return the goods unused, and we will refund you within 14 days
            of receiving them back. This right does not apply to goods that are liable to
            deteriorate or expire rapidly, or to sealed goods that are not suitable for return for
            health or hygiene reasons once unsealed (Consumer Contracts Regulations 2013).
          </p>
          <h3 className="text-sm font-semibold text-primary">How refunds are paid</h3>
          <p className="text-sm text-primary-muted leading-relaxed">
            Refunds go back to the card or payment method you paid with. Once we issue a refund, it
            normally appears on your statement within 5 to 10 working days, depending on your bank.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">5. Who You Are Buying From</h2>
          <p className="text-sm text-primary-muted leading-relaxed">
            You are buying from {vendorName}, which is responsible for the products, prices and your
            order. This website runs on ordering software provided by Merqify Ltd.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">6. Governing Law</h2>
          <p className="text-sm text-primary-muted leading-relaxed">
            These terms are governed by and construed in accordance with the laws of England and
            Wales.
          </p>
        </section>
      </article>
    </PageContainer>
  );
}
