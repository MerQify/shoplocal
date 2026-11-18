// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AllergenNotice } from "@/components/product/AllergenNotice";

/**
 * #1656 — the stopgap allergen notice (until #1653). Two halves:
 *
 * - the component signposts the vendor's OWN contact details, and still tells the shopper to ask
 *   when the vendor has none;
 * - `/cart` renders it only when the vendor ticked `showAllergenNotice` — a non-food vendor never
 *   sees it. Rendered rather than grepped, so deleting the gate fails the test.
 */

afterEach(cleanup);

describe("AllergenNotice (#1656)", () => {
  it("links the vendor's phone and email", () => {
    render(<AllergenNotice phone="01234 567890" email="hello@example.test" />);
    expect(screen.getByRole("complementary", { name: "Allergy information" })).toBeTruthy();
    expect(screen.getByText(/ask us about allergens before you order/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "01234 567890" }).getAttribute("href")).toBe(
      "tel:01234567890",
    );
    expect(screen.getByRole("link", { name: "hello@example.test" }).getAttribute("href")).toBe(
      "mailto:hello@example.test",
    );
  });

  it("still tells the shopper to ask when the vendor has no contact details", () => {
    render(<AllergenNotice phone={null} email={null} />);
    expect(screen.getByText(/ask us about allergens before you order\./i)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not link a value that is not a diallable number", () => {
    render(<AllergenNotice phone="[phone]" email={null} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

const profile = {
  localityName: "Town",
  showAllergenNotice: false,
  contactPhone: "01234 567890",
  contactEmail: null,
};
const getSummary = vi.fn();
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/cart-service", () => ({ getCartRepository: () => ({ getSummary }) }));
vi.mock("@/lib/cart-identity", () => ({
  getCartIdentity: async () => ({ userId: null, guestToken: "g" }),
  getUserId: async () => null,
}));
vi.mock("@/features/lists/save-cart-as-list", () => ({ saveCartAsList: vi.fn() }));
vi.mock("@/lib/vendor-service", () => ({ getCurrentVendorProfile: async () => profile }));
vi.mock("@/lib/config", () => ({ getEnv: () => ({ CDN_BASE_URL: "" }) }));
vi.mock("@/lib/fulfilment-service", () => ({ getFulfilmentMethod: async () => "DELIVERY" }));
vi.mock("@/lib/delivery-pricing-service", () => ({
  getShopperDeliveryRules: async () => ({ minimumOrderPence: 0, freeDeliveryThresholdPence: 0 }),
}));
vi.mock("@/components/cart/CartContents", () => ({ CartContents: () => <div /> }));
vi.mock("@/components/cart/MergePrompt", () => ({ MergePrompt: () => <div /> }));
vi.mock("@/components/cart/RestoreNotice", () => ({ RestoreNotice: () => <div /> }));

describe("/cart allergen notice gate (#1656)", () => {
  const LINES = [{ productId: "p1", name: "Item", quantity: 1 }];

  async function renderCart() {
    const { default: CartPage } = await import("@/app/(storefront)/cart/page");
    render(await CartPage({ searchParams: Promise.resolve({}) }));
  }

  it("is absent when the vendor has not ticked the setting", async () => {
    profile.showAllergenNotice = false;
    getSummary.mockResolvedValue({ lines: LINES, mergePending: false });
    await renderCart();
    expect(screen.queryByText(/Allergy information/)).toBeNull();
  });

  it("is shown when the vendor ticked the setting", async () => {
    profile.showAllergenNotice = true;
    getSummary.mockResolvedValue({ lines: LINES, mergePending: false });
    await renderCart();
    expect(screen.getByText(/Allergy information/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "01234 567890" })).toBeTruthy();
  });
});
