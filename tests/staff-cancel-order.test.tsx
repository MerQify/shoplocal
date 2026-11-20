// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  CUSTOMER_MESSAGE_MAX_LENGTH,
  parseCancellationChoices,
} from "@/lib/order-cancellation-form";

/**
 * #1691 R11–R12 — the staff cancel form's two required choices and its custom message, and the
 * action's server-side re-validation. The cancel service and the notifier are mocked; what
 * `cancelConfirmedOrder` stores is asserted in tests/orders.test.ts.
 */

const m = vi.hoisted(() => ({
  cancelConfirmed: vi.fn(async () => ({ orderNumber: "SHO-1" })),
  notify: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-rbac", () => ({
  requireVendorRole: async () => ({ ok: true, user: { id: "staff-1" } }),
}));
vi.mock("@/lib/orders-service", () => ({
  getOrderRepository: () => ({
    getForStaff: async () => ({ orderNumber: "SHO-1", status: "CONFIRMED" }),
  }),
  getOrderCancelService: () => ({ cancelConfirmed: m.cancelConfirmed }),
}));
vi.mock("@/lib/order-notifications-service", () => ({ notifyOrderEvent: m.notify }));

const { cancelOrderStaff } = await import("@/features/orders/cancel-order-staff");
const { CancelOrderForm } = await import("@/components/staff/CancelOrderForm");

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  data.set("orderNumber", "SHO-1");
  data.set("reason", "customer phoned");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseCancellationChoices (R12)", () => {
  it("refuses a missing or unknown choice", () => {
    expect(parseCancellationChoices(form({ cancellationMessage: "REFUNDED" }))).toBeNull();
    expect(parseCancellationChoices(form({ cancellationReason: "CUSTOMER_REQUEST" }))).toBeNull();
    expect(
      parseCancellationChoices(
        form({ cancellationReason: "BOSS_SAID", cancellationMessage: "REFUNDED" }),
      ),
    ).toBeNull();
    expect(
      parseCancellationChoices(form({ cancellationReason: "OTHER", cancellationMessage: "MAYBE" })),
    ).toBeNull();
  });

  it("refuses a message over the limit after trimming, and accepts one at it", () => {
    const at = "x".repeat(CUSTOMER_MESSAGE_MAX_LENGTH);
    expect(
      parseCancellationChoices(
        form({
          cancellationReason: "OTHER",
          cancellationMessage: "CUSTOM",
          customerMessage: `${at}x`,
        }),
      ),
    ).toBeNull();
    expect(
      parseCancellationChoices(
        form({
          cancellationReason: "OTHER",
          cancellationMessage: "CUSTOM",
          customerMessage: ` ${at} `,
        }),
      ),
    ).toEqual({ reason: "OTHER", message: "CUSTOM", customerMessage: at });
  });

  it("keeps the message only for CUSTOM with text", () => {
    expect(
      parseCancellationChoices(
        form({
          cancellationReason: "CUSTOMER_REQUEST",
          cancellationMessage: "REFUNDED",
          customerMessage: "ignored",
        }),
      ),
    ).toEqual({ reason: "CUSTOMER_REQUEST", message: "REFUNDED", customerMessage: null });
    expect(
      parseCancellationChoices(
        form({
          cancellationReason: "OTHER",
          cancellationMessage: "CUSTOM",
          customerMessage: "   ",
        }),
      ),
    ).toEqual({ reason: "OTHER", message: "CUSTOM", customerMessage: null });
  });
});

describe("cancelOrderStaff (R12)", () => {
  it("cancels nothing without valid choices", async () => {
    await cancelOrderStaff(form({ cancellationReason: "CUSTOMER_REQUEST" }));
    expect(m.cancelConfirmed).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("passes the internal reason and the parsed choices, then notifies", async () => {
    await cancelOrderStaff(
      form({
        cancellationReason: "STORE_UNABLE",
        cancellationMessage: "CUSTOM",
        customerMessage: "  Sorry, we ran out.  ",
      }),
    );
    expect(m.cancelConfirmed).toHaveBeenCalledWith("SHO-1", "customer phoned", "staff-1", {
      reason: "STORE_UNABLE",
      message: "CUSTOM",
      customerMessage: "Sorry, we ran out.",
    });
    expect(m.notify).toHaveBeenCalledWith({ orderNumber: "SHO-1" }, "CANCELLED");
  });
});

describe("CancelOrderForm (R11)", () => {
  it("has both required radio groups with the exact labels, and the internal-only note", () => {
    render(<CancelOrderForm orderNumber="SHO-1" action={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Who asked for this?" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "What should we tell the customer?" })).toBeTruthy();
    for (const label of [
      "Customer asked",
      "We couldn't fulfil it",
      "Other",
      "Refunded in full",
      "Not refunded yet",
      "Write my own message",
    ]) {
      const radio = screen.getByRole("radio", { name: label }) as HTMLInputElement;
      expect(radio.required).toBe(true);
    }
    expect(screen.getByText(/this reason is not shown to the customer/)).toBeTruthy();
  });

  it("shows the message box only once 'Write my own message' is chosen", () => {
    render(<CancelOrderForm orderNumber="SHO-1" action={vi.fn()} />);
    expect(screen.queryByLabelText("Message to the customer")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Write my own message" }));

    const box = screen.getByLabelText("Message to the customer") as HTMLTextAreaElement;
    expect(box.name).toBe("customerMessage");
    expect(box.maxLength).toBe(1000);
    expect(box.required).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "Refunded in full" }));
    expect(screen.queryByLabelText("Message to the customer")).toBeNull();
  });
});
