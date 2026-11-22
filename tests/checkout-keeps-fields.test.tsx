// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CHECKOUT_DETAILS_KEY, LEGACY_CHECKOUT_DETAILS_KEY } from "@/lib/storage-keys";
import { CookieBanner } from "@/components/consent/CookieBanner";

vi.mock("@/lib/db", () => ({ getPrisma: vi.fn(), getPrismaWs: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/checkout",
}));
const placeOrderAction = vi.fn();
vi.mock("@/features/checkout/place-order", () => ({ placeOrderAction }));
vi.mock("@/features/checkout/address-lookup", () => ({ lookupAddressForCheckout: vi.fn() }));
vi.mock("@/features/storefront/delivery", () => ({
  setDeliveryPostcode: vi.fn(),
  setFulfilmentMethod: vi.fn(),
}));
vi.mock("@/features/checkout/preview-code", () => ({ previewDiscountCode: vi.fn() }));

const { CheckoutForm } = await import("@/components/checkout/CheckoutForm");
const { CheckoutPricingProvider } = await import("@/components/checkout/CheckoutPricing");

/**
 * #1613 — a refused order keeps every field the shopper typed. React 19 resets a form's
 * uncontrolled fields after a form `action` completes; the form now submits through a transition,
 * which is not followed by that reset.
 */

const REFUSAL = "Sorry — we don't deliver to SW1A 1AA yet.";

const TYPED: Record<string, string> = {
  recipientName: "Validation 1613",
  email: "validation-1613@example.com",
  phone: "07700900123",
  line1: "1 Test Street",
  city: "London",
  postcode: "SW1A 1AA",
};

afterEach(() => {
  cleanup();
  localStorage.removeItem(CHECKOUT_DETAILS_KEY);
  localStorage.removeItem(LEGACY_CHECKOUT_DETAILS_KEY);
  vi.clearAllMocks();
});

describe("#1613 checkout keeps typed fields when an order is refused", () => {
  it("shows the refusal and leaves all six fields as typed, submitting the same FormData", async () => {
    placeOrderAction.mockResolvedValue({ error: REFUSAL });
    localStorage.setItem(CHECKOUT_DETAILS_KEY, '{"email":"previous@example.test"}');
    localStorage.setItem(LEGACY_CHECKOUT_DETAILS_KEY, '{"recipientName":"Previous shopper"}');
    render(
      <CheckoutPricingProvider
        basis={{ subtotalPence: 2000, deliveryFeePence: 349 }}
        initialDiscountCode={null}
        prefilledCode={null}
        redeemable={null}
      >
        <CookieBanner />
        <CheckoutForm
          signedInEmail={null}
          redeemable={null}
          offerCollection={false}
          vendorId="v-1"
          bookingWindowDays={14}
          offerDeliverySlots={false}
          timezone="Europe/London"
          method="DELIVERY"
          quotedDeliveryRules=""
        />
      </CheckoutPricingProvider>,
    );

    const field = (id: string) => document.getElementById(id) as HTMLInputElement;
    expect(field("email").value).toBe("");
    expect(field("recipientName").value).toBe("");
    expect(localStorage.getItem(CHECKOUT_DETAILS_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CHECKOUT_DETAILS_KEY)).toBeNull();
    await act(async () => {
      for (const [id, value] of Object.entries(TYPED)) {
        fireEvent.change(field(id), { target: { value } });
      }
    });

    const form = document.querySelector("form[data-checkout-form]") as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", REFUSAL);
    for (const [id, value] of Object.entries(TYPED)) {
      expect(field(id).value, id).toBe(value);
    }
    expect(localStorage.getItem(CHECKOUT_DETAILS_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CHECKOUT_DETAILS_KEY)).toBeNull();

    expect(placeOrderAction).toHaveBeenCalledTimes(1);
    const submitted = placeOrderAction.mock.calls[0][1] as FormData;
    for (const name of ["recipientName", "line1", "city", "postcode"]) {
      expect(submitted.get(name), name).toBe(TYPED[name]);
    }
  });
});
