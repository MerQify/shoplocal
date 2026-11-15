import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { StorefrontChrome } from "@/components/layout/StorefrontChrome";
import { getCurrentVendorProfile } from "@/lib/vendor-service";
import { buildStoreJsonLd, serializeJsonLd } from "@/lib/seo-schema";
import { getEnv } from "@/lib/config";

/**
 * P8.5f: the landing page's own route group, sharing a route (`/`) and the
 * same chrome as `(storefront)` but rendering `Header` with `isLanding={true}`
 * — see `components/layout/StorefrontChrome.tsx` for why this is a second
 * route group rather than a request-scoped `proxy.ts`.
 */

// force-dynamic: same reason as app/(storefront)/layout.tsx — the Header reads
// the session, which only works in the Workers runtime.
export const dynamic = "force-dynamic";

export default async function LandingLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentVendorProfile();
  if (!profile) {
    redirect("/coming-soon");
  }

  const { CDN_BASE_URL } = getEnv();
  const canonicalOrigin = profile.canonicalHost
    ? `https://${profile.canonicalHost}`
    : "https://www.aheedfoodcentre.co.uk";

  const imageUrl =
    profile.markStorageKey && CDN_BASE_URL ? `${CDN_BASE_URL}/${profile.markStorageKey}` : null;

  const storeJsonLd = buildStoreJsonLd({
    name: profile.name,
    canonicalOrigin,
    telephone: profile.contactPhone,
    location: profile.location,
    weeklyHours: profile.weeklyHours,
    imageUrl,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(storeJsonLd) }}
      />
      <StorefrontChrome profile={profile} isLanding={true}>
        {children}
      </StorefrontChrome>
    </>
  );
}
