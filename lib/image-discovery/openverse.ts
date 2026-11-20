import type { DiscoveredImage, DiscoveryLicence } from "./types";

interface OpenverseHit {
  id: string;
  title?: string | null;
  creator?: string | null;
  url: string;
  thumbnail?: string | null;
  license: string;
  license_version?: string | null;
  foreign_landing_url?: string | null;
  width?: number;
  height?: number;
}

interface OpenverseResponse {
  results?: OpenverseHit[];
}

export function mapOpenverseLicence(license: string): DiscoveryLicence | null {
  const norm = license.trim().toLowerCase();
  if (norm === "cc0") return "CC0";
  if (norm === "pdm") return "PDM";
  if (norm === "by") return "CC_BY";
  if (norm === "by-sa") return "CC_BY_SA";
  return null;
}

export async function searchOpenverse(
  query: string,
  options?: { limit?: number; fetchFn?: typeof fetch },
): Promise<DiscoveredImage[]> {
  const limit = Math.min(Math.max(options?.limit ?? 15, 1), 50);
  const doFetch = options?.fetchFn ?? fetch;

  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    query,
  )}&license_type=commercial&page_size=${limit}`;

  const res = await doFetch(url, {
    headers: {
      "User-Agent":
        "AheedFoodCentre/1.0 (https://aheedfoodcentre.co.uk; info@aheedfoodcentre.co.uk)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Openverse API returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as OpenverseResponse;
  if (!Array.isArray(data.results)) return [];

  const items: DiscoveredImage[] = [];
  for (const hit of data.results) {
    if (!hit.url) continue;
    const licence = mapOpenverseLicence(hit.license);
    if (!licence) continue; // Skip non-permitted licenses

    const creator = hit.creator?.trim();
    const licVer = hit.license_version ? ` ${hit.license_version}` : "";
    const attribution = creator
      ? `${creator} via Openverse (${hit.license.toUpperCase()}${licVer})`
      : `Openverse contributor (${hit.license.toUpperCase()}${licVer})`;

    items.push({
      id: `openverse-${hit.id}`,
      provider: "OPENVERSE",
      title: hit.title?.trim() || "Untitled photo",
      thumbnailUrl: hit.thumbnail || hit.url,
      originalUrl: hit.foreign_landing_url || hit.url,
      sourceSite: "Openverse",
      licence,
      attribution,
      width: hit.width,
      height: hit.height,
    });
  }

  return items;
}
