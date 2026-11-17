import { describe, expect, it } from "vitest";
import {
  BUNDLE_EXPORT_COLUMNS,
  bundleToExportRow,
  exportBundlesToCsv,
  type BundleForExport,
} from "@/lib/bundle-templates/export";
import {
  PROMOTION_EXPORT_COLUMNS,
  promotionToExportRow,
  exportPromotionsToCsv,
  type PromotionForExport,
} from "@/lib/promotion-templates/export";
import { parseCsvGrid } from "@/lib/product-templates/csv";

describe("Bundles Export Templates", () => {
  it("includes non-editable notice in the bundle system ID column header", () => {
    expect(BUNDLE_EXPORT_COLUMNS[0]).toBe("Bundle ID [DO NOT EDIT]");
  });

  it("serializes bundle entity with items into export row correctly", () => {
    const bundle: BundleForExport = {
      id: "bundle-123",
      name: "Biryani Feast Bundle",
      slug: "biryani-feast-bundle",
      tagline: "Everything you need for perfect biryani",
      isActive: true,
      sortOrder: 1,
      items: [
        {
          productId: "prod-1",
          quantity: 2,
          product: { name: "Daawat Basmati Rice", unitLabel: "5kg" },
        },
        {
          productId: "prod-2",
          quantity: 1,
          product: { name: "Shan Biryani Masala", unitLabel: "50g" },
        },
      ],
    };

    const row = bundleToExportRow(bundle);

    expect(row["Bundle ID [DO NOT EDIT]"]).toBe("bundle-123");
    expect(row["Bundle Name*"]).toBe("Biryani Feast Bundle");
    expect(row["Slug*"]).toBe("biryani-feast-bundle");
    expect(row["Is Active"]).toBe("TRUE");
    expect(row["Sort Order"]).toBe("1");
    expect(row["Total Items"]).toBe("2");
    expect(row["Items Summary"]).toBe("2x Daawat Basmati Rice 5kg; 1x Shan Biryani Masala 50g");
    expect(row["Items Specification [productId:quantity]"]).toBe("prod-1:2;prod-2:1");
  });

  it("exports bundles to valid RFC-4180 CSV string with UTF-8 BOM", () => {
    const bundles: BundleForExport[] = [
      {
        id: "b-1",
        name: "Weekly Veg Box, Medium",
        slug: "weekly-veg-box",
        tagline: "Fresh produce box",
        isActive: true,
        sortOrder: 0,
        items: [],
      },
    ];

    const csvText = exportBundlesToCsv(bundles);
    expect(csvText.startsWith("\uFEFF")).toBe(true);

    const grid = parseCsvGrid(csvText);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual([...BUNDLE_EXPORT_COLUMNS]);
    expect(grid[1][0]).toBe("b-1");
    expect(grid[1][1]).toBe("Weekly Veg Box, Medium");
  });
});

describe("Promotions Export Templates", () => {
  it("includes non-editable notice in the promotion system ID column header", () => {
    expect(PROMOTION_EXPORT_COLUMNS[0]).toBe("Promotion ID [DO NOT EDIT]");
  });

  it("serializes promotion with product target correctly", () => {
    const promo: PromotionForExport = {
      id: "promo-456",
      headline: "50% Off Chicken",
      subtitle: "Weekend butchery special",
      badgeText: "Weekend Special",
      callToActionText: "Shop Butchery",
      linkUrl: "/categories/chicken-poultry",
      priority: 10,
      isActive: true,
      startsAt: new Date("2026-11-20T08:00:00Z"),
      endsAt: new Date("2026-11-22T20:00:00Z"),
      channel: "WEBSITE",
      categoryId: null,
      bundleId: null,
      discountCodeId: null,
      productId: "prod-chicken-1",
      product: { name: "Fresh Baby Chicken 1kg" },
    };

    const row = promotionToExportRow(promo);

    expect(row["Promotion ID [DO NOT EDIT]"]).toBe("promo-456");
    expect(row["Headline*"]).toBe("50% Off Chicken");
    expect(row["Priority"]).toBe("10");
    expect(row["Is Active"]).toBe("TRUE");
    expect(row["Target Type"]).toBe("PRODUCT");
    expect(row["Target Name"]).toBe("Product: Fresh Baby Chicken 1kg");
    expect(row["Target ID"]).toBe("prod-chicken-1");
  });

  it("serializes store-wide promotion correctly", () => {
    const promo: PromotionForExport = {
      id: "promo-storewide-1",
      headline: "Welcome to Aheed Online Store",
      subtitle: "Fresh groceries delivered daily",
      badgeText: null,
      callToActionText: "Order Now",
      linkUrl: "/categories",
      priority: 0,
      isActive: true,
      startsAt: null,
      endsAt: null,
      channel: "WEBSITE",
      categoryId: null,
      bundleId: null,
      discountCodeId: null,
      productId: null,
    };

    const row = promotionToExportRow(promo);
    expect(row["Target Type"]).toBe("STORE_WIDE");
    expect(row["Target Name"]).toBe("Store-wide");
    expect(row["Target ID"]).toBe("");
  });

  it("exports promotions to valid RFC-4180 CSV string with UTF-8 BOM", () => {
    const promos: PromotionForExport[] = [
      {
        id: "promo-1",
        headline: 'Big Save on "Atta" Flour',
        subtitle: null,
        badgeText: null,
        callToActionText: null,
        linkUrl: null,
        priority: 1,
        isActive: true,
        startsAt: null,
        endsAt: null,
        channel: "WEBSITE",
        categoryId: null,
        bundleId: null,
        discountCodeId: null,
        productId: null,
      },
    ];

    const csvText = exportPromotionsToCsv(promos);
    expect(csvText.startsWith("\uFEFF")).toBe(true);

    const grid = parseCsvGrid(csvText);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual([...PROMOTION_EXPORT_COLUMNS]);
    expect(grid[1][0]).toBe("promo-1");
    expect(grid[1][1]).toBe('Big Save on "Atta" Flour');
  });
});
