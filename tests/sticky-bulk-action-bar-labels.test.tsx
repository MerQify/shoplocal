/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StickyBulkActionBar } from "@/components/staff/StickyBulkActionBar";
import { BULK_PRODUCTS_FORM_ID } from "@/lib/product-restriction-form";
import type { AdminProductListRow } from "@/lib/repositories/products";

// Mock server actions
vi.mock("@/features/admin/product-restrictions", () => ({
  bulkProductAction: vi.fn().mockReturnValue({ phase: "idle", error: null }),
}));
vi.mock("@/features/admin/product-quantities", () => ({
  saveBulkQuantities: vi.fn().mockReturnValue({ phase: "idle", error: null, saved: 0 }),
}));
vi.mock("@/features/admin/catalogue", () => ({
  bulkSetLowStockThresholdAction: vi.fn().mockReturnValue({ status: "idle", message: null }),
  bulkUpdateLabelsAndVisibilityAction: vi.fn().mockReturnValue({ status: "idle", message: null }),
}));

afterEach(() => {
  cleanup();
});

const mockProducts: AdminProductListRow[] = [
  {
    id: "prod-1",
    name: "Halal Fresh Chicken",
    slug: "halal-fresh-chicken",
    basePrice: 500,
    originalPrice: null,
    plu: null,
    isActive: true,
    categoryName: "Meat",
    imageNeedsReview: false,
    brandName: "Aheed",
    restriction: null,
    stockMode: "TRACKED",
    quantity: 10,
    lowStockThreshold: 3,
    tier: null,
    isHalal: true,
    isFresh: true,
    isOrganic: false,
    isVegetarian: false,
    isGlutenFree: false,
    isFeatured: true,
    allowsCustomNote: true,
  },
  {
    id: "prod-2",
    name: "Organic Apple",
    slug: "organic-apple",
    basePrice: 150,
    originalPrice: null,
    plu: null,
    isActive: false,
    categoryName: "Fruit",
    imageNeedsReview: false,
    brandName: null,
    restriction: null,
    stockMode: "TRACKED",
    quantity: 20,
    lowStockThreshold: 5,
    tier: null,
    isHalal: false,
    isFresh: true,
    isOrganic: true,
    isVegetarian: true,
    isGlutenFree: true,
    isFeatured: false,
    allowsCustomNote: false,
  },
];

describe("StickyBulkActionBar — Labels & Visibility Option", () => {
  it("renders Labels & visibility button in toolbar and toggles popover card on click", () => {
    render(
      <div>
        <StickyBulkActionBar products={mockProducts} />
        <input
          type="checkbox"
          name="productId"
          value="prod-1"
          form={BULK_PRODUCTS_FORM_ID}
          data-testid="cb-1"
        />
      </div>,
    );

    // Find the trigger button
    const triggerBtn = screen.getByRole("button", {
      name: /Labels & visibility/i,
    }) as HTMLButtonElement;
    expect(triggerBtn).not.toBeNull();
    expect(triggerBtn.disabled).toBe(true);

    // Select product 1
    const cb1 = screen.getByTestId("cb-1");
    fireEvent.click(cb1);

    // Button should now be enabled
    expect(triggerBtn.disabled).toBe(false);

    // Popover is not open initially
    expect(screen.queryByRole("dialog")).toBeNull();

    // Click to open popover
    fireEvent.click(triggerBtn);

    // Popover card is displayed
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toBeNull();
    expect(screen.getByRole("heading", { name: /Labels & visibility/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Save changes/i })).not.toBeNull();

    // All 8 checkboxes should be rendered
    const halalCb = screen.getByLabelText("Halal") as HTMLInputElement;
    const freshCb = screen.getByLabelText("Fresh") as HTMLInputElement;
    const organicCb = screen.getByLabelText("Organic") as HTMLInputElement;
    const vegCb = screen.getByLabelText("Vegetarian") as HTMLInputElement;
    const gfCb = screen.getByLabelText("Gluten free") as HTMLInputElement;
    const featuredCb = screen.getByLabelText("Featured on homepage") as HTMLInputElement;
    const activeCb = screen.getByLabelText("Visible in the shop") as HTMLInputElement;
    const noteCb = screen.getByLabelText(
      "Customers can add a note to this item",
    ) as HTMLInputElement;

    expect(halalCb).not.toBeNull();
    expect(freshCb).not.toBeNull();
    expect(organicCb).not.toBeNull();
    expect(vegCb).not.toBeNull();
    expect(gfCb).not.toBeNull();
    expect(featuredCb).not.toBeNull();
    expect(activeCb).not.toBeNull();
    expect(noteCb).not.toBeNull();

    // For single selected product (prod-1), values should match prod-1
    expect(halalCb.checked).toBe(true);
    expect(freshCb.checked).toBe(true);
    expect(organicCb.checked).toBe(false);
    expect(vegCb.checked).toBe(false);
    expect(gfCb.checked).toBe(false);
    expect(featuredCb.checked).toBe(true);
    expect(activeCb.checked).toBe(true);
    expect(noteCb.checked).toBe(true);

    // Close button dismisses dialog
    const closeBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports tri-state cycling (Keep -> Yes -> No -> Keep) in bulk mode when multiple products are selected", () => {
    render(
      <div>
        <StickyBulkActionBar products={mockProducts} />
        <input
          type="checkbox"
          name="productId"
          value="prod-1"
          form={BULK_PRODUCTS_FORM_ID}
          data-testid="cb-1"
        />
        <input
          type="checkbox"
          name="productId"
          value="prod-2"
          form={BULK_PRODUCTS_FORM_ID}
          data-testid="cb-2"
        />
      </div>,
    );

    // Select both products
    fireEvent.click(screen.getByTestId("cb-1"));
    fireEvent.click(screen.getByTestId("cb-2"));

    const triggerBtn = screen.getByRole("button", {
      name: /Labels & visibility/i,
    });
    fireEvent.click(triggerBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toBeNull();
    expect(screen.getByText("2 selected")).not.toBeNull();

    const saveBtn = screen.getByRole("button", { name: /Save changes/i }) as HTMLButtonElement;
    // Initially disabled because all fields default to Keep current (no changes)
    expect(saveBtn.disabled).toBe(true);

    const halalInput = screen.getByLabelText("Halal") as HTMLInputElement;
    expect(halalInput.getAttribute("aria-checked")).toBe("mixed");
    expect(screen.getAllByText("— Keep current")).toHaveLength(8);

    // 1st click: cycles to Set to Yes
    fireEvent.click(halalInput);
    expect(halalInput.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("✓ Set to Yes")).not.toBeNull();
    expect(saveBtn.disabled).toBe(false);
    expect(saveBtn.textContent).toContain("Save changes (1 update)");

    // 2nd click: cycles to Set to No
    fireEvent.click(halalInput);
    expect(halalInput.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("✕ Set to No")).not.toBeNull();
    expect(saveBtn.disabled).toBe(false);
    expect(saveBtn.textContent).toContain("Save changes (1 update)");

    // 3rd click: cycles back to Keep current
    fireEvent.click(halalInput);
    expect(halalInput.getAttribute("aria-checked")).toBe("mixed");
    expect(screen.getAllByText("— Keep current")).toHaveLength(8);
    expect(saveBtn.disabled).toBe(true);

    // Toggle Halal to Yes and Fresh to No
    fireEvent.click(halalInput); // Halal -> Set to Yes
    const freshInput = screen.getByLabelText("Fresh") as HTMLInputElement;
    fireEvent.click(freshInput); // Fresh -> Set to Yes
    fireEvent.click(freshInput); // Fresh -> Set to No
    expect(saveBtn.textContent).toContain("Save changes (2 updates)");

    // Click "Reset all"
    const resetBtn = screen.getByRole("button", { name: /Reset all/i });
    fireEvent.click(resetBtn);

    // Both should be back to mixed / Keep current
    expect(halalInput.getAttribute("aria-checked")).toBe("mixed");
    expect(freshInput.getAttribute("aria-checked")).toBe("mixed");
    expect(saveBtn.disabled).toBe(true);
  });
});
