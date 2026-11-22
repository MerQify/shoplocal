// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearStoredCheckoutDetails } from "@/lib/checkout-details-storage";
import { CHECKOUT_DETAILS_KEY, LEGACY_CHECKOUT_DETAILS_KEY } from "@/lib/storage-keys";

afterEach(() => localStorage.clear());

describe("clearStoredCheckoutDetails", () => {
  it("clears both checkout keys while preserving other preferences", () => {
    localStorage.setItem(CHECKOUT_DETAILS_KEY, '{"email":"shopper@example.test"}');
    localStorage.setItem(LEGACY_CHECKOUT_DETAILS_KEY, '{"phone":"00000000000"}');
    localStorage.setItem("unrelated", "keep");

    clearStoredCheckoutDetails(() => localStorage);

    expect(localStorage.getItem(CHECKOUT_DETAILS_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CHECKOUT_DETAILS_KEY)).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("allows checkout to continue when browser storage is blocked", () => {
    expect(() =>
      clearStoredCheckoutDetails(() => {
        throw new DOMException("Storage blocked", "SecurityError");
      }),
    ).not.toThrow();
  });
});
