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

const headers = {
  "User-Agent": "AheedFoodCentre/1.0 (https://aheedfoodcentre.co.uk; info@aheedfoodcentre.co.uk)",
  Accept: "application/json",
};

function toDiscoveredImage(product: OpenFoodFactsProduct): DiscoveredImage | null {
  const image = product.image_front_url || product.image_url;
  const code = product.code;
  if (!image || !code) return null;

  const brand = product.brands ? ` (${product.brands})` : "";
  return {
    id: `off-${code}`,
    provider: "OPEN_FOOD_FACTS",
    title: `${product.product_name?.trim() || "Food product"}${brand}`,
    thumbnailUrl: product.image_front_small_url || image,
    originalUrl: `https://world.openfoodfacts.org/product/${code}`,
    downloadUrl: image,
    sourceSite: "Open Food Facts",
    licence: "CC_BY_SA",
    attribution: "Open Food Facts contributors (CC BY-SA)",
  };
}

export async function getOpenFoodFactsImage(
  id: string,
  fetchFn = fetch,
): Promise<DiscoveredImage | null> {
  const code = /^off-(\d{8,14})$/.exec(id)?.[1];
  if (!code) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}?fields=code,product_name,brands,image_url,image_front_url,image_front_small_url`;
  const response = await fetchFn(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Food Facts API returned HTTP ${response.status}`);
  const data = (await response.json()) as { status?: number; product?: OpenFoodFactsProduct };
  if (data.status !== 1 || data.product?.code !== code) return null;
  return toDiscoveredImage(data.product);
}

export async function searchOpenFoodFacts(
  query: string,
  options?: { limit?: number; fetchFn?: typeof fetch },
): Promise<DiscoveredImage[]> {
  const limit = Math.min(Math.max(options?.limit ?? 15, 1), 50);
  const doFetch = options?.fetchFn ?? fetch;
  const trimmed = query.trim();
  if (/^\d{8,14}$/.test(trimmed)) {
    const image = await getOpenFoodFactsImage(`off-${trimmed}`, doFetch);
    return image ? [image] : [];
  }

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}`;
  const response = await doFetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Open Food Facts API returned HTTP ${response.status}`);
  const data = (await response.json()) as OpenFoodFactsResponse;
  if (!Array.isArray(data.products)) return [];
  return data.products
    .map(toDiscoveredImage)
    .filter((item): item is DiscoveredImage => item !== null)
    .slice(0, limit);
}
