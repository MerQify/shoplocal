import { describe, expect, it } from "vitest";
import { mapOpenverseLicence, searchOpenverse } from "./openverse";

describe("openverse provider", () => {
  it("maps valid Openverse licences", () => {
    expect(mapOpenverseLicence("cc0")).toBe("CC0");
    expect(mapOpenverseLicence("pdm")).toBe("PDM");
    expect(mapOpenverseLicence("by")).toBe("CC_BY");
    expect(mapOpenverseLicence("by-sa")).toBe("CC_BY_SA");
    expect(mapOpenverseLicence("nc")).toBeNull();
  });

  it("parses Openverse search results", async () => {
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      expect(url).toContain("q=mango");
      expect(url).toContain("license_type=commercial");

      return new Response(
        JSON.stringify({
          results: [
            {
              id: "123",
              title: "Fresh Mango",
              creator: "Alice Photographer",
              url: "https://example.com/mango.jpg",
              thumbnail: "https://example.com/mango-thumb.jpg",
              license: "by",
              license_version: "4.0",
              foreign_landing_url: "https://openverse.org/image/123",
              width: 800,
              height: 600,
            },
            {
              id: "456",
              title: "Non-commercial Mango",
              license: "nc",
              url: "https://example.com/mango-nc.jpg",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const results = await searchOpenverse("mango", { fetchFn: mockFetch });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "openverse-123",
      provider: "OPENVERSE",
      title: "Fresh Mango",
      thumbnailUrl: "https://example.com/mango-thumb.jpg",
      originalUrl: "https://openverse.org/image/123",
      sourceSite: "Openverse",
      licence: "CC_BY",
      attribution: "Alice Photographer via Openverse (BY 4.0)",
      width: 800,
      height: 600,
    });
  });
});
