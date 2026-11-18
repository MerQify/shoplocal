// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * #1658 — the homepage hero said "100% Certified HMC Halal" for EVERY vendor (it was a literal), so
 * an electronics shop claimed certified halal on its own homepage; verified live on SriMart staging
 * 2026-11-18, the #239 incident again. The pill now renders only for a vendor with both the Halal
 * and HMC certification settings on, and never says "100%".
 *
 * Rendered rather than grepped: a source check passes as soon as the setting names appear anywhere
 * in the file, including this kind of comment, so only a render fails when the gate is deleted.
 */

const profile: Record<string, unknown> = {};

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/vendor-service", () => ({ getCurrentVendorProfile: async () => profile }));
vi.mock("@/lib/categories-service", () => ({
  getCategoryRepository: () => ({ listTopLevel: async () => [] }),
}));
vi.mock("@/lib/promotions-service", () => ({ getLivePromotionsForStorefront: async () => [] }));
vi.mock("@/lib/customer-feedback-service", () => ({
  getCustomerFeedbackRepository: () => ({
    listApproved: async () => [],
    listApprovedForStorefront: async () => [],
    summary: async () => ({ count: 0, average: null }),
    approvedSummary: async () => ({ count: 0, average: null }),
  }),
}));
vi.mock("@/lib/vendor-review-links-service", () => ({
  getVendorReviewLinkRepository: () => ({ listActive: async () => [] }),
}));
vi.mock("@/lib/config", () => ({ getEnv: () => ({ CDN_BASE_URL: "" }) }));
vi.mock("@/lib/delivery-pricing-service", () => ({
  getShopperDeliveryRules: async () => ({
    deliveryFeePence: 0,
    minimumOrderPence: 0,
    freeDeliveryThresholdPence: null,
  }),
}));
vi.mock("@/components/layout/PromotionHero", () => ({ PromotionHero: () => <div /> }));
vi.mock("@/components/layout/DepartmentScroller", () => ({ DepartmentScroller: () => <div /> }));
vi.mock("@/components/storefront/CustomerFeedbackCards", () => ({
  CustomerFeedbackCards: () => <div />,
  ReviewLinkGroup: () => <div />,
}));

async function renderHome() {
  const { default: Home } = await import("@/app/(landing)/page");
  render(await Home());
}

afterEach(cleanup);

describe("homepage halal pill (#1658)", () => {
  it("is absent for a vendor without Halal and HMC switched on", async () => {
    Object.assign(profile, {
      name: "Test Store",
      localityName: "Town",
      showHalalLabel: false,
      showHmcCertification: false,
    });
    await renderHome();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/HMC/);
    expect(text).not.toMatch(/100%/);
  });

  it("is absent when only Halal is on", async () => {
    Object.assign(profile, { showHalalLabel: true, showHmcCertification: false });
    await renderHome();
    expect(document.body.textContent).not.toMatch(/HMC/);
  });

  it("says 'HMC certified halal', without '100%', when both are on", async () => {
    Object.assign(profile, { showHalalLabel: true, showHmcCertification: true });
    await renderHome();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/HMC certified halal/);
    expect(text).not.toMatch(/100%/);
  });
});
