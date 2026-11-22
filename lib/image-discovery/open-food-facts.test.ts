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

it("resolves barcode searches from the exact provider product", async () => {
  const code = "3017620422003";
  const fetchFn = async (input: URL | RequestInfo) => {
    expect(new URL(String(input)).pathname).toBe(`/api/v2/product/${code}`);
    return Response.json({
      status: 1,
      product: { code, image_front_url: "https://images.openfoodfacts.org/front.jpg" },
    });
  };
  await expect(searchOpenFoodFacts(code, { fetchFn })).resolves.toMatchObject([
    { id: `off-${code}`, provider: "OPEN_FOOD_FACTS" },
  ]);
});
