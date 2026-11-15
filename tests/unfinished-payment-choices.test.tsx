// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";

/**
 * #1589 R13–R18 — the choices shown after a shopper leaves Stripe, and the
 * button that disables itself while its form submits. Also the page's
 * `?payment=` → state mapping (R20), which lives in `lib/unfinished-payment.ts`.
 *
 * Form actions are identified by mocking both action modules with named
 * functions: React renders a function action as a `javascript:` URL in jsdom, so
 * the test reads React's own props off the form element instead.
 */

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: status.pending, data: null, method: null, action: null }),
}));

const resumePayment = vi.hoisted(() => async function resumePayment() {});
const cancelOrder = vi.hoisted(() => async function cancelOrder() {});
vi.mock("@/features/checkout/resume-payment", () => ({ resumePayment }));
vi.mock("@/features/checkout/cancel-order", () => ({ cancelOrder }));

const { UnfinishedPaymentChoices } = await import("@/components/checkout/UnfinishedPaymentChoices");
const { PendingSubmitButton } = await import("@/components/checkout/PendingSubmitButton");
const { unfinishedPaymentView } = await import("@/lib/unfinished-payment");

afterEach(() => {
  cleanup();
  status.pending = false;
});

/** The function React was given as `action` for this form. */
function actionOf(form: HTMLFormElement): unknown {
  const propsKey = Object.keys(form).find((k) => k.startsWith("__reactProps"));
  return propsKey
    ? (form as unknown as Record<string, { action?: unknown }>)[propsKey].action
    : null;
}

function forms(container: HTMLElement) {
  return [...container.querySelectorAll("form")].map((form) => ({
    form,
    action: actionOf(form),
    orderNumber: (form.querySelector('input[name="orderNumber"]') as HTMLInputElement)?.value,
    t: (form.querySelector('input[name="t"]') as HTMLInputElement)?.value,
    buttons: [...form.querySelectorAll('button[type="submit"]')].map((b) => b.textContent),
  }));
}

describe("PendingSubmitButton (#1589 R13)", () => {
  it("is enabled when idle", () => {
    render(
      <PendingSubmitButton pendingLabel="Working…" className="x">
        Go
      </PendingSubmitButton>,
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveProperty("disabled", false);
    expect(button.getAttribute("aria-disabled")).toBeNull();
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("disables itself while its form is pending", () => {
    status.pending = true;
    render(
      <PendingSubmitButton pendingLabel="Working…" className="x">
        Go
      </PendingSubmitButton>,
    );
    const button = screen.getByRole("button", { name: "Working…" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("is a client component", () => {
    const source = readFileSync("components/checkout/PendingSubmitButton.tsx", "utf8");
    expect(source.startsWith('"use client";')).toBe(true);
  });
});

describe("UnfinishedPaymentChoices (#1589 R14–R17)", () => {
  it.each(["open", "past-ttl"] as const)(
    "%s: Continue to payment, then Change my order, each in its own form",
    (state) => {
      const { container } = render(
        <UnfinishedPaymentChoices orderNumber="AHE-1" token="tok-1" state={state} notice={null} />,
      );
      const found = forms(container);
      expect(found).toHaveLength(2);
      expect(found[0]).toMatchObject({
        action: resumePayment,
        orderNumber: "AHE-1",
        t: "tok-1",
        buttons: ["Continue to payment"],
      });
      expect(found[1]).toMatchObject({
        action: cancelOrder,
        orderNumber: "AHE-1",
        t: "tok-1",
        buttons: ["Change my order"],
      });
      expect(container.textContent).toMatch(/cancels it and nothing is charged/);
      expect(container.textContent).toMatch(/items go back into your basket/);
    },
  );

  it("only past-ttl says the link may have expired", () => {
    const { container, rerender } = render(
      <UnfinishedPaymentChoices orderNumber="AHE-1" token={null} state="past-ttl" notice={null} />,
    );
    expect(container.textContent).toContain("This payment link may have expired");
    rerender(
      <UnfinishedPaymentChoices orderNumber="AHE-1" token={null} state="open" notice={null} />,
    );
    expect(container.textContent).not.toContain("may have expired");
  });

  it("sends an empty token for a member", () => {
    const { container } = render(
      <UnfinishedPaymentChoices orderNumber="AHE-1" token={null} state="open" notice={null} />,
    );
    for (const found of forms(container)) expect(found.t).toBe("");
  });

  it.each([
    ["expired", "This payment link has expired — nothing was charged."],
    ["none", "There's no payment page to return to for this order — nothing was charged."],
  ] as const)("%s: one form, Put my items back in the basket, no Continue", (state, sentence) => {
    const { container } = render(
      <UnfinishedPaymentChoices orderNumber="AHE-1" token="tok-1" state={state} notice={null} />,
    );
    expect(container.textContent).toContain(sentence);
    const found = forms(container);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      action: cancelOrder,
      orderNumber: "AHE-1",
      t: "tok-1",
      buttons: ["Put my items back in the basket"],
    });
    expect(screen.queryByText("Continue to payment")).toBeNull();
  });

  it("the unavailable notice is a retryable status, and the buttons stay", () => {
    render(
      <UnfinishedPaymentChoices
        orderNumber="AHE-1"
        token="tok-1"
        state="open"
        notice="unavailable"
      />,
    );
    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("We couldn't reach the payment service just now");
    expect(notice.textContent).toContain("Nothing has changed");
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change my order" })).toBeTruthy();
  });

  it("renders no status without a notice", () => {
    render(
      <UnfinishedPaymentChoices orderNumber="AHE-1" token="tok-1" state="open" notice={null} />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is not a client component itself", () => {
    const source = readFileSync("components/checkout/UnfinishedPaymentChoices.tsx", "utf8");
    expect(source).not.toContain('"use client"');
  });
});

describe("unfinishedPaymentView — the cancel page's state (#1589 R20)", () => {
  it.each<[string | undefined, boolean, string, string | null]>([
    [undefined, false, "open", null],
    [undefined, true, "past-ttl", null],
    ["expired", false, "expired", null],
    ["none", false, "none", null],
    ["unavailable", false, "open", "unavailable"],
    ["unavailable", true, "past-ttl", "unavailable"],
    ["bogus", false, "open", null],
    ["bogus", true, "past-ttl", null],
  ])("payment=%s pastTtl=%s → %s / %s", (payment, pastTtl, state, notice) => {
    expect(unfinishedPaymentView(payment, pastTtl)).toEqual({ state, notice });
  });

  it("our clock alone never says expired", () => {
    expect(unfinishedPaymentView(undefined, true).state).not.toBe("expired");
  });
});
