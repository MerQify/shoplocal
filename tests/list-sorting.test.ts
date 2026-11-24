import { describe, expect, it } from "vitest";
import {
  compareAlphabetical,
  filterActiveOrArchived,
  filterVisibleEntities,
  paginateList,
  searchNamedEntities,
  sortAlphabetical,
  sortBrandsAlphabetical,
  sortCategoryOptionGroups,
  sortCategoryTreeAlphabetical,
  sortNamedEntities,
} from "@/lib/list-sorting";

describe("compareAlphabetical", () => {
  it("sorts strings case-insensitively", () => {
    expect(compareAlphabetical("apple", "Apple")).toBe(0);
    expect(compareAlphabetical("banana", "Apple")).toBeGreaterThan(0);
    expect(compareAlphabetical("Apple", "banana")).toBeLessThan(0);
  });

  it("handles natural number ordering (e.g. Item 2 before Item 10)", () => {
    expect(compareAlphabetical("Item 2", "Item 10")).toBeLessThan(0);
    expect(compareAlphabetical("Item 10", "Item 2")).toBeGreaterThan(0);
    expect(compareAlphabetical("Tilapia 500", "Tilapia 800")).toBeLessThan(0);
    expect(compareAlphabetical("1kg", "2kg")).toBeLessThan(0);
    expect(compareAlphabetical("2kg", "10kg")).toBeLessThan(0);
  });

  it("handles whitespace, null, and undefined values cleanly", () => {
    expect(compareAlphabetical("  Apple  ", "apple")).toBe(0);
    expect(compareAlphabetical(null, "Apple")).toBeGreaterThan(0);
    expect(compareAlphabetical("Apple", undefined)).toBeLessThan(0);
    expect(compareAlphabetical(null, null)).toBe(0);
    expect(compareAlphabetical("", "Apple")).toBeGreaterThan(0);
  });

  it("handles special characters and symbols consistently", () => {
    expect(compareAlphabetical("Fruit & veg", "Fruit and veg")).toBeLessThan(0);
    expect(compareAlphabetical("Fish & Seafood", "Fish & Seafood")).toBe(0);
  });
});

describe("sortAlphabetical and sortNamedEntities", () => {
  it("sorts string arrays naturally without mutating original", () => {
    const raw = ["Item 10", "Item 2", "item 1", "Item 20"];
    const sorted = sortAlphabetical(raw);
    expect(sorted).toEqual(["item 1", "Item 2", "Item 10", "Item 20"]);
    expect(raw[0]).toBe("Item 10"); // Unmutated
  });

  it("sorts named entities alphabetically A-Z", () => {
    const brands = [
      { id: "1", name: "Tilda" },
      { id: "2", name: "ani" },
      { id: "3", name: "Daawat" },
      { id: "4", name: "Ani" },
    ];
    const sorted = sortBrandsAlphabetical(brands);
    expect(sorted.map((b) => b.name.toLowerCase())).toEqual(["ani", "ani", "daawat", "tilda"]);
  });
});

describe("sortCategoryTreeAlphabetical", () => {
  it("sorts parent departments A-Z and children inside each department A-Z", () => {
    const categories = [
      { id: "veg", name: "Vegetables", parentId: null },
      { id: "fruit", name: "Fruit", parentId: null },
      { id: "apple", name: "Apple", parentId: "fruit" },
      { id: "banana", name: "Banana", parentId: "fruit" },
      { id: "potato", name: "Potato", parentId: "veg" },
      { id: "carrot", name: "Carrot", parentId: "veg" },
    ];

    const sorted = sortCategoryTreeAlphabetical(categories);

    expect(sorted.map((c) => c.id)).toEqual([
      "fruit",
      "apple",
      "banana",
      "veg",
      "carrot",
      "potato",
    ]);
  });

  it("handles childless departments and orphan categories", () => {
    const categories = [
      { id: "bakery", name: "Bakery", parentId: null },
      { id: "orphan", name: "Orphan Subcategory", parentId: "non-existent" },
      { id: "dairy", name: "Dairy", parentId: null },
    ];

    const sorted = sortCategoryTreeAlphabetical(categories);

    // Bakery, Dairy, and Orphan Subcategory all at top tier, sorted A-Z
    expect(sorted.map((c) => c.id)).toEqual(["bakery", "dairy", "orphan"]);
  });

  it("supports prioritizeSortOrder option when explicitly requested", () => {
    const categories = [
      { id: "b", name: "B", parentId: null, sortOrder: 2 },
      { id: "a", name: "A", parentId: null, sortOrder: 1 },
      { id: "c", name: "C", parentId: null, sortOrder: 0 },
    ];

    const naturalSorted = sortCategoryTreeAlphabetical(categories);
    expect(naturalSorted.map((c) => c.id)).toEqual(["a", "b", "c"]);

    const orderSorted = sortCategoryTreeAlphabetical(categories, { prioritizeSortOrder: true });
    expect(orderSorted.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });
});

describe("sortCategoryOptionGroups", () => {
  it("sorts groups by parent name A-Z and children within each group A-Z", () => {
    const groups = [
      {
        parent: { name: "Vegetables" },
        children: [{ name: "Potato" }, { name: "Carrot" }, { name: "Aubergine" }],
      },
      {
        parent: { name: "Bakery" },
        children: [{ name: "Naan" }, { name: "Bread" }, { name: "Bagel" }],
      },
    ];

    const sorted = sortCategoryOptionGroups(groups);

    expect(sorted[0].parent.name).toBe("Bakery");
    expect(sorted[0].children.map((c) => c.name)).toEqual(["Bagel", "Bread", "Naan"]);

    expect(sorted[1].parent.name).toBe("Vegetables");
    expect(sorted[1].children.map((c) => c.name)).toEqual(["Aubergine", "Carrot", "Potato"]);
  });
});

describe("shared list management helpers", () => {
  it("filterVisibleEntities only retains isActive: true items", () => {
    const items = [
      { id: "1", name: "A", isActive: true },
      { id: "2", name: "B", isActive: false },
      { id: "3", name: "C", isActive: true },
    ];
    expect(filterVisibleEntities(items).map((i) => i.id)).toEqual(["1", "3"]);
  });

  it("filterActiveOrArchived handles all status options", () => {
    const items = [
      { id: "1", name: "A", isActive: true },
      { id: "2", name: "B", isActive: false },
    ];
    expect(filterActiveOrArchived(items, "all")).toHaveLength(2);
    expect(filterActiveOrArchived(items, "active").map((i) => i.id)).toEqual(["1"]);
    expect(filterActiveOrArchived(items, "archived").map((i) => i.id)).toEqual(["2"]);
    expect(filterActiveOrArchived(items, "inactive").map((i) => i.id)).toEqual(["2"]);
  });

  it("searchNamedEntities filters case-insensitively", () => {
    const items = [{ name: "Basmati Rice" }, { name: "Brown Rice" }, { name: "Wheat Flour" }];
    expect(searchNamedEntities(items, "rice").map((i) => i.name)).toEqual([
      "Basmati Rice",
      "Brown Rice",
    ]);
    expect(searchNamedEntities(items, "  FLOUR  ").map((i) => i.name)).toEqual(["Wheat Flour"]);
  });

  it("paginateList computes correct slices and metadata", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const p1 = paginateList(items, 1, 3);
    expect(p1.items).toEqual(["a", "b", "c"]);
    expect(p1.total).toBe(7);
    expect(p1.totalPages).toBe(3);
    expect(p1.currentPage).toBe(1);

    const p3 = paginateList(items, 3, 3);
    expect(p3.items).toEqual(["g"]);
    expect(p3.currentPage).toBe(3);
  });
});
