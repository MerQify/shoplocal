// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/storefront/delivery", () => ({
  setFulfilmentMethod: vi.fn(),
  setDeliveryPostcode: vi.fn(),
}));

const { LocationControl } = await import("@/components/layout/LocationControl");
const { DepartmentSearchBar } = await import("@/components/layout/DepartmentSearchBar");
const { ShoppingListLink } = await import("@/components/layout/ShoppingListLink");
const { ViewSwitcher } = await import("@/components/layout/ViewSwitcher");

afterEach(cleanup);

describe("Header navigation controls consistency (#1610)", () => {
  it("LocationControl summary trigger conforms to the standard h-10 control height and medallion sizing", () => {
    const { container } = render(
      <LocationControl
        postcode="MK9 1AA"
        deliverable
        offerCollection
        method="COLLECTION"
      />
    );

    const summary = container.querySelector("summary")!;
    expect(summary).toBeDefined();
    expect(summary.className).toContain("h-10");
    expect(summary.className).toContain("min-h-tap");
    expect(summary.className).toContain("lg:min-h-0");
    expect(summary.className).toContain("rounded-xl");
    expect(summary.className).toContain("border");
    expect(summary.className).toContain("border-black/10");
    expect(summary.className).toContain("bg-surface-muted");

    const medallion = summary.querySelector("[data-medallion]") as HTMLElement;
    expect(medallion).toBeDefined();
    expect(medallion.style.width).toBe("24px");
    expect(medallion.style.height).toBe("24px");
  });

  it("LocationControl single button fallback conforms to standard h-10 control height", () => {
    const { container } = render(
      <LocationControl
        postcode={null}
        deliverable={null}
        offerCollection={false}
        method="DELIVERY"
      />
    );

    const button = container.querySelector("button")!;
    expect(button).toBeDefined();
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("min-h-tap");
    expect(button.className).toContain("rounded-xl");
    expect(button.className).toContain("border-black/10");
    expect(button.className).toContain("bg-surface-muted");

    const medallion = button.querySelector("[data-medallion]") as HTMLElement;
    expect(medallion).toBeDefined();
    expect(medallion.style.width).toBe("24px");
    expect(medallion.style.height).toBe("24px");
  });

  it("DepartmentSearchBar conforms to standard h-10 height with full-height child segments", () => {
    const { container } = render(
      <DepartmentSearchBar
        departments={[{ slug: "meat", name: "Meat" }]}
        placeholder="Search products..."
      />
    );

    const form = container.querySelector("form")!;
    expect(form).toBeDefined();
    expect(form.className).toContain("h-10");
    expect(form.className).toContain("min-h-tap");
    expect(form.className).toContain("lg:min-h-0");

    const select = container.querySelector("select")!;
    expect(select).toBeDefined();
    expect(select.className).toContain("h-full");

    const submitBtn = form.querySelector("button[type='submit']")!;
    expect(submitBtn).toBeDefined();
    expect(submitBtn.className).toContain("h-full");
  });

  it("ShoppingListLink conforms to standard h-10 height, border, bg and 24px medallion", () => {
    const { container } = render(<ShoppingListLink />);

    const link = container.querySelector("a")!;
    expect(link).toBeDefined();
    expect(link.className).toContain("h-10");
    expect(link.className).toContain("min-h-tap");
    expect(link.className).toContain("rounded-xl");
    expect(link.className).toContain("border-black/10");
    expect(link.className).toContain("bg-surface-muted");

    const medallion = link.querySelector("[data-medallion]") as HTMLElement;
    expect(medallion).toBeDefined();
    expect(medallion.style.width).toBe("24px");
    expect(medallion.style.height).toBe("24px");
  });

  it("ViewSwitcher conforms to navigation control styling (h-10, border, bg-surface-muted, 24px medallion)", () => {
    const { container } = render(
      <ViewSwitcher
        canSeeAdmin
        currentTier="staff"
        isPortal={false}
      />
    );

    const button = container.querySelector("button")!;
    expect(button).toBeDefined();
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("min-h-tap");
    expect(button.className).toContain("rounded-xl");
    expect(button.className).toContain("border");
    expect(button.className).toContain("border-black/10");
    expect(button.className).toContain("bg-surface-muted");
    expect(button.className).not.toContain("bg-primary/10");

    const medallion = button.querySelector("[data-medallion]") as HTMLElement;
    expect(medallion).toBeDefined();
    expect(medallion.style.width).toBe("24px");
    expect(medallion.style.height).toBe("24px");
  });
});
