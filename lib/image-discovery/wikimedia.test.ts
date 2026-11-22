import { describe, expect, it } from "vitest";
import { getWikimediaImage, mapWikimediaLicence, searchWikimedia } from "./wikimedia";

describe("wikimedia provider", () => {
  it("maps valid Wikimedia licences", () => {
    expect(mapWikimediaLicence("CC0")).toBe("CC0");
    expect(mapWikimediaLicence("Public domain")).toBe("PDM");
    expect(mapWikimediaLicence("PD-self")).toBe("PDM");
    expect(mapWikimediaLicence("CC-BY-4.0")).toBe("CC_BY");
    expect(mapWikimediaLicence("CC BY-SA 3.0")).toBe("CC_BY_SA");
    expect(mapWikimediaLicence("All rights reserved")).toBeNull();
    expect(mapWikimediaLicence("CC BY-NC 4.0")).toBeNull();
    expect(mapWikimediaLicence("CC BY-ND 3.0")).toBeNull();
  });

  it("parses Wikimedia Commons search results and strips HTML", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      expect(url).toContain("commons.wikimedia.org");
      expect(url).toContain("gsrsearch=apple");

      return new Response(
        JSON.stringify({
          query: {
            pages: {
              "101": {
                pageid: 101,
                title: "File:Red Apple.jpg",
                imageinfo: [
                  {
                    url: "https://upload.wikimedia.org/apple.jpg",
                    thumburl: "https://upload.wikimedia.org/apple-thumb.jpg",
                    width: 1200,
                    height: 900,
                    descriptionurl: "https://commons.wikimedia.org/wiki/File:Red_Apple.jpg",
                    extmetadata: {
                      Artist: { value: '<a href="https://example.com">John Doe</a>' },
                      LicenseShortName: { value: "CC BY-SA 4.0" },
                      ObjectName: { value: "Red Apple Fruit" },
                    },
                  },
                ],
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const results = await searchWikimedia("apple", { fetchFn: mockFetch });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "wikimedia-101",
      provider: "WIKIMEDIA",
      title: "Red Apple Fruit",
      thumbnailUrl: "https://upload.wikimedia.org/apple-thumb.jpg",
      originalUrl: "https://commons.wikimedia.org/wiki/File:Red_Apple.jpg",
      sourceSite: "Wikimedia Commons",
      licence: "CC_BY_SA",
      attribution: "John Doe via Wikimedia Commons (CC BY-SA 4.0)",
      width: 1200,
      height: 900,
    });
  });

  it("uses a file-title lookup and reports API errors", async () => {
    const fetchFn = async (input: URL | RequestInfo) => {
      expect(String(input)).toContain("titles=File%3ABanana-Single.jpg");
      return Response.json({ error: { code: "internal_api_error" } });
    };
    await expect(searchWikimedia("File:Banana-Single.jpg", { fetchFn })).rejects.toThrow(
      "Wikimedia Commons returned an API error",
    );
  });

  it("does not make a provider request for an invalid page ID", async () => {
    const fetchFn = async () => {
      throw new Error("unexpected fetch");
    };
    await expect(getWikimediaImage("wikimedia-42&other=1", fetchFn)).resolves.toBeNull();
  });
});
