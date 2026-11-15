import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Landing Hero LCP and Accessibility optimizations", () => {
  const promoHeroSource = readFileSync("components/layout/PromotionHero.tsx", "utf8");
  const headerSource = readFileSync("components/layout/Header.tsx", "utf8");
  const landingPageSource = readFileSync("app/(landing)/page.tsx", "utf8");
  const landingLayoutSource = readFileSync("app/(landing)/layout.tsx", "utf8");

  describe("PromotionHero", () => {
    it("assigns fetchPriority='high' and loading='eager' to slide 0, and lazy loading to subsequent slides", () => {
      expect(promoHeroSource).toContain('fetchPriority={index === 0 ? "high" : "auto"}');
      expect(promoHeroSource).toContain('loading={index === 0 ? "eager" : "lazy"}');
    });

    it("renders rotation and pagination controls outside the slides track", () => {
      // The controls block must appear after the track closing </div>
      const trackCloseIndex = promoHeroSource.indexOf("        })}\n      </div>");
      const controlsIndex = promoHeroSource.indexOf("Pause / Resume Controls & Indicator Dots");
      expect(trackCloseIndex).toBeGreaterThan(-1);
      expect(controlsIndex).toBeGreaterThan(trackCloseIndex);
    });

    it("ensures indicator dot buttons have a minimum touch target size (>= 24px)", () => {
      expect(promoHeroSource).toContain("min-w-[24px] min-h-[24px]");
    });
  });

  describe("Header phone accessible name (WCAG 2.5.3)", () => {
    it("includes visible phone number in aria-label to satisfy Label in Name", () => {
      expect(headerSource).toContain("aria-label={`Call ${name} at ${bannerPhone}`}");
    });
  });

  describe("Landing page heading hierarchy", () => {
    it("uses h3 tags for trust value claims under shop-by-department", () => {
      expect(landingPageSource).toContain(
        '<h3 className="font-bold text-xs text-black/90 uppercase tracking-wide">',
      );
      expect(landingPageSource).not.toContain(
        '<h4 className="font-bold text-xs text-black/90 uppercase tracking-wide">',
      );
    });
  });

  describe("Landing layout structured data", () => {
    it("injects GroceryStore JSON-LD schema into the homepage root layout", () => {
      expect(landingLayoutSource).toContain("buildStoreJsonLd");
      expect(landingLayoutSource).toContain('type="application/ld+json"');
      expect(landingLayoutSource).toContain("serializeJsonLd(storeJsonLd)");
    });
  });
});
