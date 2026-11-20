import { describe, expect, it } from "vitest";
import { searchOpenFoodFacts } from "./open-food-facts";

describe("open-food-facts provider", () => {
  it("parses Open Food Facts product photos", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      expect(url).toContain("world.openfoodfacts.org");
      expect(url).toContain("search_terms=basmati");

      return new Response(
        JSON.stringify({
          products: [
            {
              code: "5012345678901",
              product_name: "Basmati Rice",
              brands: "Tilda",
              image_url: "https://images.openfoodfacts.org/images/1.jpg",
              image_front_small_url: "https://images.openfoodfacts.org/images/1.small.jpg",
            },
            {
              code: "5012345678902",
              product_name: "No image item",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const results = await searchOpenFoodFacts("basmati", { fetchFn: mockFetch });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "off-5012345678901",
      provider: "OPEN_FOOD_FACTS",
      title: "Basmati Rice (Tilda)",
      thumbnailUrl: "https://images.openfoodfacts.org/images/1.small.jpg",
      originalUrl: "https://world.openfoodfacts.org/product/5012345678901",
      sourceSite: "Open Food Facts",
      licence: "CC_BY_SA",
      attribution: "Open Food Facts contributors (CC BY-SA)",
    });
  });
});
