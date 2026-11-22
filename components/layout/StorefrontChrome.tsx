import { timeStorefrontRender } from "@/lib/storefront-render-timing";
import { Fragment, Suspense, type ReactNode } from "react";
import { headers } from "next/headers";
import { getStorefrontSession } from "@/lib/storefront-session";
import { getRewardsDataForUser } from "@/lib/rewards-service";
import { Header } from "@/components/layout/Header";
import { FloatingContact } from "@/components/layout/FloatingContact";
import { AssistantLauncherProvider } from "@/components/assistant/AssistantLauncher";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { getEmailEnv, getPlatformBrandingEnv, readOptional } from "@/lib/config";
import { emailDomain } from "@/lib/email/policy";
import { isOwnDomainHost } from "@/lib/client-setup/sender-suggestion";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { QuickViewProvider } from "@/components/product/quick-view-context";
import { QuickViewDrawer } from "@/components/product/QuickViewDrawer";
import { CartFeedbackProvider } from "@/components/cart/CartFeedback";
import { RewardsLauncher } from "@/components/rewards/RewardsLauncher";
import { brandStyle } from "@/lib/vendor-theme";
import type { VendorProfile } from "@/lib/repositories/vendor";
import { getActiveSlotAssetsForVendor } from "@/lib/category-assets-service";
import { ActiveSlotIconsProvider } from "@/components/icons/ActiveSlotIconsProvider";

/**
 * Shared storefront chrome (P8.5f) — header, footer, cookie banner, and the
 * vendor's brand tokens. Extracted out of `app/(storefront)/layout.tsx` so
 * `app/(landing)/layout.tsx` can render the identical chrome for `/` while
 * passing `isLanding={true}` into `Header`, without duplicating any markup.
 */
export async function StorefrontChrome({
  children,
  profile,
  isLanding,
}: {
  children: ReactNode;
  profile: VendorProfile;
  isLanding: boolean;
}) {
  const [requestHeaders, activeSlotIcons] = await Promise.all([
    headers(),
    timeStorefrontRender("chrome.icons", () => getActiveSlotAssetsForVendor(profile.id)).catch(
      () => ({}),
    ),
  ]);
  const host = requestHeaders.get("host") ?? "";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;
  // #1015 — from the profile already loaded above: no query added to the page render. One value for
  // both FloatingContact and the footer's channel row (#1060), so they always list the same set.
  const assistantAvailable = profile.assistantEnabled && profile.whatsappNumber !== null;
  const platformBranding = getPlatformBrandingEnv();
  // #1409 — judged from the host the shopper is on, so it costs no query. The platform domain is
  // EMAIL_FROM's, the same source the Client Setup sender suggestion uses.
  const platformDomain = emailDomain(readOptional(getEmailEnv)?.EMAIL_FROM ?? "") || undefined;
  const ownDomain = isOwnDomainHost(host.toLowerCase(), platformDomain);

  // The homepage has no product tiles that open quick view.
  const QuickViewBoundary = isLanding ? Fragment : QuickViewProvider;

  return (
    <ActiveSlotIconsProvider initialIcons={activeSlotIcons}>
      <QuickViewBoundary>
        <div style={brandStyle(profile.primitives)} className="flex min-h-screen flex-col">
          {/*
          #956 — inside the brand-style div, not around it: the feedback region
          is painted with `bg-primary`, and `brandStyle()` sets that token inline
          here, so outside this div SriMart would get the :root (Aheed) colour.
        */}
          <CartFeedbackProvider>
            {/* #1060 — one help-assistant panel, opened from FloatingContact or the footer. */}
            <AssistantLauncherProvider vendorName={profile.name}>
              <Header isLanding={isLanding} />
              <div className="flex-1">{children}</div>
              {/* #1055 — vendor-configured footer; every value comes from `profile` (no extra query). */}
              <StorefrontFooter
                profile={profile}
                platformName={platformBranding.PLATFORM_NAME}
                platformTagline={platformBranding.PLATFORM_TAGLINE}
                platformBrandingTerminology={
                  profile.platformBrandingTerminology ||
                  platformBranding.PLATFORM_BRANDING_TERMINOLOGY
                }
                assistantAvailable={assistantAvailable}
                ownDomain={ownDomain}
              />
              <FloatingContact
                vendorName={profile.name}
                facebookUrl={profile.facebookUrl}
                instagramUrl={profile.instagramUrl}
                whatsappNumber={profile.whatsappNumber}
                whatsappCommunityUrl={profile.whatsappCommunityUrl}
                assistantAvailable={assistantAvailable}
              />
            </AssistantLauncherProvider>
            <CookieBanner />
            {!isLanding && <QuickViewDrawer />}
            <Suspense fallback={null}>
              <StorefrontRewards baseUrl={baseUrl} vendorName={profile.name} />
            </Suspense>
          </CartFeedbackProvider>
        </div>
      </QuickViewBoundary>
    </ActiveSlotIconsProvider>
  );
}

// The floating rewards control can arrive after the storefront has rendered.
async function StorefrontRewards({ baseUrl, vendorName }: { baseUrl: string; vendorName: string }) {
  const session = await getStorefrontSession();
  const initialData = await timeStorefrontRender("chrome.rewards", () =>
    getRewardsDataForUser(session?.user?.id ?? null, baseUrl),
  );
  if (!initialData.loyaltyEnabled) return null;

  return <RewardsLauncher initialData={initialData} vendorName={vendorName} />;
}
