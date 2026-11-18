// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * #1652 — `/terms` is written for the shopper: an actionable refund policy under `#refunds` (the
 * footer's "Returns & refunds" link) and a plain "who you are buying from" clause in place of the
 * platform/merchant VAT-liability allocation that used to sit in consumer terms.
 *
 * The page serves every vendor, so the assertions use a neutral test vendor.
 */

vi.mock("@/lib/vendor-service", () => ({
  getCurrentVendorProfile: async () => ({ name: "Test Store" }),
}));

async function renderTerms() {
  const { default: TermsPage } = await import("@/app/(storefront)/terms/page");
  render(await TermsPage());
}

afterEach(cleanup);

describe("/terms (#1652)", () => {
  it("gives an actionable refund policy under #refunds", async () => {
    await renderTerms();

    const refunds = document.getElementById("refunds");
    expect(refunds).not.toBeNull();
    const text = refunds?.textContent ?? "";
    expect(text).toMatch(/damaged, faulty, missing or not what you ordered/i);
    expect(text).toMatch(/order number/i);
    expect(text).toMatch(/card or payment method you paid with/i);
    expect(text).toMatch(/5 to 10 working days/i);
    expect(text).toMatch(/14 days/i);
    expect(text).toMatch(/deteriorate or expire rapidly/i);
  });

  it("names the vendor as seller and Merqify as software provider, without the VAT clause", async () => {
    await renderTerms();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Tax Responsibility/i);
    expect(text).not.toMatch(/HMRC/);
    expect(text).toMatch(/You are buying from Test Store/);
    expect(text).toMatch(/Merqify Ltd/);
  });

  it("is dated for this revision", async () => {
    await renderTerms();
    expect(document.body.textContent).toMatch(/Last updated: November 18, 2026/);
  });
});
