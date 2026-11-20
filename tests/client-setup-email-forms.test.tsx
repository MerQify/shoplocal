// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DESTINATIONS_UNAVAILABLE_MESSAGE } from "@/lib/client-setup/destination-copy";

/**
 * Dual Listbox Transfer Picker and Inline Inbound Address Edit testing.
 */

const saveSenderAction = vi.fn();
vi.mock("@/app/(admin)/staff/platform/client-setup/actions", () => ({
  addInboundAddressAction: vi.fn(),
  removeInboundAddressAction: vi.fn(),
  updateInboundAddressAction: vi.fn(),
  saveSenderAction,
  sendTestEmailAction: vi.fn(),
}));

const { AddInboundAddressForm, InboundAddressRow, SenderForm } =
  await import("@/components/staff/client-setup/EmailSetupForms");

afterEach(() => cleanup());

const DEFAULT = { status: "set" as const, address: "hub@inbox.test" };
const OK = {
  status: "ok" as const,
  addresses: [
    { email: "hub@inbox.test", verified: true },
    { email: "shop@inbox.test", verified: true },
    { email: "pending@inbox.test", verified: false },
  ],
};

function renderForm(
  defaultForward: Parameters<typeof AddInboundAddressForm>[0]["defaultForward"],
  destinations: Parameters<typeof AddInboundAddressForm>[0]["destinations"] = OK,
) {
  const { container } = render(
    <AddInboundAddressForm
      vendorId="v1"
      defaultForward={defaultForward}
      destinations={destinations}
    />,
  );
  return container.querySelector("form") as HTMLFormElement;
}

const posted = (form: HTMLFormElement) => new FormData(form).getAll("forwardTo");

describe("Dual Listbox Transfer Picker (R1–R2)", () => {
  it("renders verified mailboxes and pending mailboxes clearly", () => {
    renderForm(DEFAULT);
    expect(screen.getByText("Available Mailboxes")).toBeTruthy();
    expect(screen.getByText("Forward To (Recipients)")).toBeTruthy();
    expect(screen.getByText(/pending@inbox\.test/)).toBeTruthy();
  });

  it("preselects the default forward when provided", () => {
    const form = renderForm(DEFAULT);
    expect(posted(form)).toEqual(["hub@inbox.test"]);
    expect(screen.getByText("shop@inbox.test")).toBeTruthy();
  });

  it("allows transferring items between Available and Selected using click buttons", () => {
    const form = renderForm({ status: "unset" });
    expect(posted(form)).toEqual([""]);

    // Click to add shop@inbox.test
    const addShopBtn = screen.getByRole("button", { name: /add shop@inbox\.test/i });
    fireEvent.click(addShopBtn);

    expect(posted(form)).toEqual(["shop@inbox.test"]);

    // Click to remove shop@inbox.test
    const removeShopBtn = screen.getByRole("button", { name: /remove shop@inbox\.test/i });
    fireEvent.click(removeShopBtn);

    expect(posted(form)).toEqual([""]);
  });

  it("allows adding custom email directly to recipients", () => {
    const form = renderForm({ status: "unset" });
    const customInput = screen.getByPlaceholderText(/team\.member@gmail\.com/i);
    const addCustomBtn = screen.getByRole("button", { name: /add to recipients/i });

    fireEvent.change(customInput, { target: { value: "custom@team.test" } });
    fireEvent.click(addCustomBtn);

    expect(posted(form)).toEqual(["custom@team.test"]);
  });
});

describe("fallback when Cloudflare cannot be read (R8)", () => {
  it.each(["not-configured", "forbidden", "error"] as const)(
    "keeps the text field and names the %s reason",
    (reason) => {
      const form = renderForm(DEFAULT, { status: "unavailable", reason });
      const input = screen.getByLabelText(/forward to/i) as HTMLInputElement;
      expect(input.tagName).toBe("INPUT");
      expect(input.value).toBe("hub@inbox.test");
      expect(screen.getByText(DESTINATIONS_UNAVAILABLE_MESSAGE[reason])).toBeTruthy();
      expect(posted(form)).toEqual(["hub@inbox.test"]);
    },
  );
});

describe("InboundAddressRow inline edit", () => {
  const addressItem = {
    id: "addr-1",
    address: "info@store.test",
    purpose: "SUPPORT" as const,
    forwardTo: "team1@domain.test, team2@domain.test",
  };

  it("renders read-only row with Edit and Remove buttons by default", () => {
    render(<InboundAddressRow vendorId="v1" address={addressItem} destinations={OK} />);
    expect(screen.getByText("info@store.test")).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit info@store\.test/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove/i })).toBeTruthy();
  });

  it("opens inline edit form when Edit is clicked and cancels when Cancel is clicked", () => {
    render(<InboundAddressRow vendorId="v1" address={addressItem} destinations={OK} />);

    fireEvent.click(screen.getByRole("button", { name: /edit info@store\.test/i }));

    expect(screen.getByText("Editing:")).toBeTruthy();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText("Editing:")).toBeNull();
    expect(screen.getByRole("button", { name: /edit info@store\.test/i })).toBeTruthy();
  });
});

describe("Use suggested sender (#1403 R14)", () => {
  const SUGGESTION = { name: "Corner Shop", email: "orders@cornershop.example" };

  it("fills both inputs without submitting", () => {
    const { container } = render(
      <SenderForm
        vendorId="v1"
        senderName="Old Name"
        senderEmail="orders@old.example"
        suggestion={SUGGESTION}
      />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", onSubmit);

    expect(screen.getByText(/orders@cornershop\.example/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /use suggested sender/i }));

    expect((screen.getByLabelText(/sender name/i) as HTMLInputElement).value).toBe("Corner Shop");
    expect((screen.getByLabelText(/sender email/i) as HTMLInputElement).value).toBe(
      "orders@cornershop.example",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(saveSenderAction).not.toHaveBeenCalled();
  });

  it("is hidden when the saved sender already equals the suggestion (email case-insensitive)", () => {
    render(
      <SenderForm
        vendorId="v1"
        senderName="Corner Shop"
        senderEmail="Orders@CornerShop.example"
        suggestion={SUGGESTION}
      />,
    );
    expect(screen.queryByRole("button", { name: /use suggested sender/i })).toBeNull();
    expect(screen.queryByText(/suggested/i)).toBeNull();
  });

  it("is hidden when there is no suggestion", () => {
    render(<SenderForm vendorId="v1" senderName="" senderEmail="" suggestion={null} />);
    expect(screen.queryByRole("button", { name: /use suggested sender/i })).toBeNull();
  });
});
