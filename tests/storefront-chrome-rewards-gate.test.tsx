// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderToReadableStream } from "react-dom/server";
import type { VendorProfile } from "@/lib/repositories/vendor";

/**
 * #1023 — the floating Rewards launcher renders only for a vendor that runs a loyalty scheme.
 *
 * With loyalty off, the panel still showed "Loyalty Rewards", a points balance and a link to
 * `/account/loyalty`, which 404s for that vendor. The flag comes from the rewards data the chrome
 * resolves while streaming, including for signed-out shoppers.
 */

const state = vi.hoisted(() => ({
  loyaltyEnabled: false,
  rewardsReady: undefined as Promise<void> | undefined,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:8787" }),
}));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({ api: { getSession: async () => null } }),
}));
vi.mock("@/lib/rewards-service", () => ({
  getRewardsDataForUser: async () => {
    await state.rewardsReady;
    return {
      authenticated: false,
      loyaltyEnabled: state.loyaltyEnabled,
      balancePoints: 0,
      expiryDate: null,
      pointsPerPoundEarned: 1,
      pencePerPointRedeemed: 1,
      minRedeemPoints: 100,
      tier: null,
      referralCode: "",
      referralsCompleted: 0,
      referralUrl: "",
      discountOffPence: 500,
      rewardPoints: 100,
    };
  },
}));
// Chrome siblings the gate does not touch; each has its own tests.
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/FloatingContact", () => ({ FloatingContact: () => null }));
// #1055 — the footer has its own test (tests/storefront-footer.test.tsx); this one is about the launcher.
vi.mock("@/components/layout/StorefrontFooter", () => ({ StorefrontFooter: () => null }));
vi.mock("@/components/consent/CookieBanner", () => ({ CookieBanner: () => null }));
vi.mock("@/components/product/QuickViewDrawer", () => ({ QuickViewDrawer: () => null }));
vi.mock("@/lib/vendor-theme", () => ({ brandStyle: () => ({}) }));

const LAUNCHER_LABEL = "Open rewards and loyalty panel";
const profile = { name: "Test Store", primitives: {} } as unknown as VendorProfile;

async function streamChrome() {
  const { StorefrontChrome } = await import("@/components/layout/StorefrontChrome");
  const chrome = await StorefrontChrome({ children: <main>page</main>, profile, isLanding: false });
  return renderToReadableStream(chrome);
}

async function renderChrome() {
  const stream = await streamChrome();
  await stream.allReady;
  document.body.innerHTML = await new Response(stream).text();
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  state.rewardsReady = undefined;
});

describe("StorefrontChrome rewards launcher gate (#1023)", () => {
  it("renders no launcher when the vendor has loyalty off", async () => {
    state.loyaltyEnabled = false;
    await renderChrome();
    expect(screen.getByText("page")).toBeTruthy();
    expect(screen.queryAllByLabelText(LAUNCHER_LABEL)).toHaveLength(0);
  });

  it("renders exactly one launcher when the vendor has loyalty on", async () => {
    state.loyaltyEnabled = true;
    await renderChrome();
    expect(screen.queryAllByLabelText(LAUNCHER_LABEL)).toHaveLength(1);
  });

  it("streams the page while rewards data is still pending", async () => {
    state.loyaltyEnabled = true;
    const { promise, resolve } = Promise.withResolvers<void>();
    state.rewardsReady = promise;
    const stream = await streamChrome();
    const reader = stream.getReader();

    try {
      const { value } = await reader.read();
      const shell = new TextDecoder().decode(value);
      expect(shell).toContain("<main>page</main>");
      expect(shell).not.toContain(LAUNCHER_LABEL);
    } finally {
      resolve();
      await stream.allReady;
      await reader.cancel();
    }
  });
});
