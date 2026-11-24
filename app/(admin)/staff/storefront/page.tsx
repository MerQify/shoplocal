import { redirect } from "next/navigation";
import { requireVendorRole } from "@/lib/auth-rbac";
import {
  fetchVendorProfile,
  getVendorConfig,
  getVendorBranding,
  listThemes,
  listVendorThemes,
} from "@/lib/vendor-service";
import { StorefrontConfigForm } from "@/components/staff/StorefrontConfigForm";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { ReviewLinksManager } from "@/components/staff/ReviewLinksManager";
import { FooterSettingsForms } from "@/components/staff/FooterSettingsForms";
import { MarketingConsentSettingsForm } from "@/components/staff/MarketingConsentSettingsForm";
import { getVendorReviewLinkRepository } from "@/lib/vendor-review-links-service";
import { getStorage } from "@/lib/storage";
import { markFileKeys } from "@/lib/vendor-mark";
import { calendarDayInZone } from "@/lib/local-datetime";
import { PageContainer } from "@/components/layout/PageContainer";

export const dynamic = "force-dynamic";

export default async function StorefrontAdminPage() {
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) {
    // Never `return null` here: app/(admin)/layout.tsx renders the portal shell
    // around whatever this returns, so a bare null serves 200 with the header,
    // the nav and an empty page — indistinguishable from a loading state rather
    // than a refusal. Every other /staff/* page uses PanelRefusal (CLAUDE.md).
    if (auth.status === 401) redirect("/login");
    return (
      <PanelRefusal
        title="Store admins only"
        message="You're signed in, but your account doesn't have permission to manage this store's storefront."
      />
    );
  }

  const config = await getVendorConfig(auth.vendorId);
  const branding = await getVendorBranding(auth.vendorId);
  const { getVendorLocation } = await import("@/lib/vendor-service");
  const location = await getVendorLocation(auth.vendorId);
  const themes = await listThemes();
  const vendorThemes = await listVendorThemes(auth.vendorId);
  const reviewLinks = await getVendorReviewLinkRepository().listAll();
  // #1055 — the footer's hours and badges come back on the profile, already ordered.
  const profile = await fetchVendorProfile(auth.vendorId);
  const today = calendarDayInZone(new Date());

  if (!config || !branding) {
    return <div className="p-8">Vendor config or branding not found.</div>;
  }

  const logoUrl = branding.logoStorageKey ? getStorage().publicUrl(branding.logoStorageKey) : null;
  // #1069 — the mark's 192px PNG, for the uploader's preview.
  const markKeys = branding.markStorageKey ? markFileKeys(branding.markStorageKey) : null;
  const markUrl = markKeys ? getStorage().publicUrl(markKeys.icon192) : null;
  // #1233 — the WhatsApp community group QR code image URL, for the uploader's preview.
  const whatsappQrUrl = config.whatsappCommunityQrKey
    ? getStorage().publicUrl(config.whatsappCommunityQrKey)
    : null;

  return (
    <PageContainer width="wide">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-black">Storefront Branding</h1>
        <p className="mt-1 text-sm text-black/60">
          Manage your store’s branding, visual assets, delivery rules and shopfront configuration.
        </p>
      </div>

      <StorefrontConfigForm
        initialConfig={config}
        initialBranding={branding}
        initialLocation={location}
        themes={themes}
        vendorThemes={vendorThemes}
        logoUrl={logoUrl}
        markUrl={markUrl}
        whatsappQrUrl={whatsappQrUrl}
        footerSlot={
          <FooterSettingsForms
            initial={{
              contactPhone: config.contactPhone,
              contactEmail: config.contactEmail,
              companyNumber: config.companyNumber,
              vatNumber: config.vatNumber,
              registeredOffice: config.registeredOffice,
              openingHoursNote: config.openingHoursNote,
              showSecureCheckoutNote: config.showSecureCheckoutNote,
              weeklyHours: profile.weeklyHours,
              paymentBadges: profile.paymentBadges,
              // #1060 — the store's calendar day; earlier overrides are pruned on the next save.
              upcomingOverrides: profile.hoursOverrides.filter((o) => o.date >= today),
              today,
            }}
          />
        }
        marketingSlot={
          <section className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-black">Marketing consent</h2>
            <MarketingConsentSettingsForm enabled={config.marketingConsentEnabled} />
          </section>
        }
        reviewsSlot={
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <ReviewLinksManager links={reviewLinks} />
          </div>
        }
      />
    </PageContainer>
  );
}
