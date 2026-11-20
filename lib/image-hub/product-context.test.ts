import { describe, expect, it } from "vitest";
import { HUB_QUERY_MAX, productContextQuery } from "./product-context";

describe("productContextQuery (#1678 R3)", () => {
  it("(a) joins name, brand and category, leaving out blank parts", () => {
    expect(
      productContextQuery({ name: "Basmati Rice", brandName: "Tilda", categoryName: "Rice" }),
    ).toBe("Basmati Rice Tilda Rice");
    expect(productContextQuery({ name: "Basmati Rice", brandName: null, categoryName: "" })).toBe(
      "Basmati Rice",
    );
  });

  it("(b) leaves out a brand the name already contains, ignoring case", () => {
    expect(
      productContextQuery({ name: "Tilda Basmati Rice", brandName: "tilda", categoryName: "Rice" }),
    ).toBe("Tilda Basmati Rice Rice");
  });

  it("(c) collapses whitespace and trims", () => {
    expect(
      productContextQuery({
        name: "  Basmati \n  Rice ",
        brandName: " Tilda ",
        categoryName: "  ",
      }),
    ).toBe("Basmati Rice Tilda");
  });

  it("(d) cuts at the last space at or before 200 characters", () => {
    const word = "abcdefghi"; // 9 letters + a space = 10 per word
    const name = Array.from({ length: 30 }, () => word).join(" ");
    const result = productContextQuery({ name });
    expect(result.length).toBeLessThanOrEqual(HUB_QUERY_MAX);
    expect(result.endsWith(word)).toBe(true);
    expect(result.split(" ").every((w) => w === word)).toBe(true);
  });
});
