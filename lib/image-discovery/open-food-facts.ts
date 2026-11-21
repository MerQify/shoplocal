import type { DiscoveredImage } from "./types";

interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
}

interface OpenFoodFactsResponse {
  products?: OpenFoodFactsProduct[];
}

export async function searchOpenFoodFacts(
  query: string,
  options?: { limit?: number; fetchFn?: typeof fetch },
): Promise<DiscoveredImage[]> {
  const limit = Math.min(Math.max(options?.limit ?? 15, 1), 50);
  const doFetch = options?.fetchFn ?? fetch;

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    query,
  )}&search_simple=1&action=process&json=1&page_size=${limit}`;

  const res = await doFetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent":
        "AheedFoodCentre/1.0 (https://aheedfoodcentre.co.uk; info@aheedfoodcentre.co.uk)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Open Food Facts API returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as OpenFoodFactsResponse;
  if (!Array.isArray(data.products)) return [];

  const items: DiscoveredImage[] = [];

  for (const p of data.products) {
    const imgUrl = p.image_front_url || p.image_url;
    if (!imgUrl) continue;

    const brandStr = p.brands ? ` (${p.brands})` : "";
    const name = p.product_name?.trim() || "Food product";
    const title = `${name}${brandStr}`;
    const code = p.code;
    if (!code) continue;

    items.push({
      id: `off-${code}`,
      provider: "OPEN_FOOD_FACTS",
      title,
      thumbnailUrl: p.image_front_small_url || imgUrl,
      originalUrl: `https://world.openfoodfacts.org/product/${code}`,
      downloadUrl: imgUrl,
      sourceSite: "Open Food Facts",
      licence: "CC_BY_SA",
      attribution: "Open Food Facts contributors (CC BY-SA)",
    });
  }

  return items;
}
