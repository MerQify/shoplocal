// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { RoleJourneyMaps, type UserJourneyRole } from "@/components/help/RoleJourneyMaps";

afterEach(cleanup);

const ALL_ROLES: UserJourneyRole[] = ["customer", "staff", "store-admin", "platform-admin"];

describe("RoleJourneyMaps", () => {
  // #1652 — the default is the shopper view: customer journey only, no tabs, shopper heading.
  it("shows only the customer journey, without tabs, when given no roles", () => {
    render(<RoleJourneyMaps detectedRole="customer" />);
    expect(screen.getByRole("heading", { name: "How shopping works" })).toBeDefined();
    expect(screen.getByRole("heading", { name: /Customer \(Shopper\) Journey/i })).toBeDefined();
    expect(screen.getByText(/Discover Storefront & Trust Badges/i)).toBeDefined();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText(/Store Staff/i)).toBeNull();
  });

  // #1662 — the shopper starting point names this store's own host, never another storefront.
  it("names the store's own host as the shopper starting point", () => {
    render(<RoleJourneyMaps detectedRole="customer" storeHost="shop.example.test" />);
    expect(screen.getByText("This store's homepage (shop.example.test).")).toBeDefined();
    expect(screen.queryByText(/merqify\.com/)).toBeNull();
  });

  it("says only 'This store's homepage' when the store has no canonical host", () => {
    render(<RoleJourneyMaps detectedRole="customer" />);
    expect(screen.getByText("This store's homepage.")).toBeDefined();
    expect(screen.queryByText(/merqify\.com/)).toBeNull();
  });

  it("renders a tab only for each listed role", () => {
    render(<RoleJourneyMaps detectedRole="staff" roles={["customer", "staff"]} />);
    expect(screen.getByRole("heading", { name: "Platform User Journey Maps" })).toBeDefined();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: /Store Admin/i })).toBeNull();
  });

  it("falls back to the first listed role when the detected role is not listed", () => {
    render(<RoleJourneyMaps detectedRole="platform-admin" roles={["customer"]} />);
    expect(screen.getByRole("heading", { name: /Customer \(Shopper\) Journey/i })).toBeDefined();
  });

  it("defaults to store-admin journey when detectedRole is store-admin", () => {
    render(<RoleJourneyMaps detectedRole="store-admin" roles={ALL_ROLES} />);
    expect(screen.getByRole("heading", { name: /Store Admin Journey/i })).toBeDefined();
    expect(screen.getByText(/Brand Storefront & Manage Themes/i)).toBeDefined();
  });

  it("defaults to staff journey when detectedRole is staff", () => {
    render(<RoleJourneyMaps detectedRole="staff" roles={ALL_ROLES} />);
    expect(screen.getByRole("heading", { name: /Store Staff Journey/i })).toBeDefined();
    expect(screen.getByText(/Process Orders in the Queue/i)).toBeDefined();
  });

  it("defaults to platform-admin journey when detectedRole is platform-admin", () => {
    render(<RoleJourneyMaps detectedRole="platform-admin" roles={ALL_ROLES} />);
    expect(screen.getByRole("heading", { name: /Platform Admin Journey/i })).toBeDefined();
    expect(screen.getByText(/Audit Tenant Directory & Readiness/i)).toBeDefined();
  });

  it("switches journey when user clicks on a different role tab", () => {
    render(<RoleJourneyMaps detectedRole="customer" roles={ALL_ROLES} />);
    expect(screen.getByRole("heading", { name: /Customer \(Shopper\) Journey/i })).toBeDefined();

    const staffTab = screen.getByRole("tab", { name: /Store Staff/i });
    fireEvent.click(staffTab);

    expect(screen.getByRole("heading", { name: /Store Staff Journey/i })).toBeDefined();
    expect(screen.getByText(/Live Orders Queue/i)).toBeDefined();

    const adminTab = screen.getByRole("tab", { name: /Store Admin/i });
    fireEvent.click(adminTab);

    expect(screen.getByRole("heading", { name: /Store Admin Journey/i })).toBeDefined();
    expect(screen.getByText(/Storefront & Branding/i)).toBeDefined();
  });
});
