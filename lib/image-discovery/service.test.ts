import { describe, expect, it } from "vitest";
import { searchDiscoveredImages } from "./service";

describe("image discovery aggregator service", () => {
  it("aggregates results from multiple providers", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("openverse")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "ov-1",
                title: "OV Item",
                url: "https://example.com/1.jpg",
                license: "cc0",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("wikimedia")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "1": {
                  pageid: 1,
                  title: "File:WM.jpg",
                  imageinfo: [
                    {
                      url: "https://example.com/2.jpg",
                      extmetadata: { LicenseShortName: { value: "CC0" } },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("openfoodfacts")) {
        return new Response(
          JSON.stringify({
            products: [
              {
                code: "999",
                product_name: "OFF Item",
                image_url: "https://example.com/3.jpg",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await searchDiscoveredImages({ query: "bread" }, { fetchFn: mockFetch });
    expect(res.items).toHaveLength(3);
    const providers = res.items.map((i) => i.provider);
    expect(providers).toContain("OPENVERSE");
    expect(providers).toContain("WIKIMEDIA");
    expect(providers).toContain("OPEN_FOOD_FACTS");
  });

  it("survives when one provider fails", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("openverse")) {
        throw new Error("Openverse network down");
      }
      if (url.includes("wikimedia")) {
        return new Response(JSON.stringify({ query: {} }), { status: 200 });
      }
      if (url.includes("openfoodfacts")) {
        return new Response(
          JSON.stringify({
            products: [
              {
                code: "100",
                product_name: "Resilient Bread",
                image_url: "https://example.com/bread.jpg",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await searchDiscoveredImages({ query: "bread" }, { fetchFn: mockFetch });
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.provider).toBe("OPEN_FOOD_FACTS");
    expect(res.errors?.Openverse).toContain("Openverse network down");
  });
});
