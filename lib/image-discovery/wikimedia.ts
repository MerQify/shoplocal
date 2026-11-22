import type { DiscoveredImage, DiscoveryLicence } from "./types";

interface WikimediaImageInfo {
  url?: string;
  thumburl?: string;
  width?: number;
  height?: number;
  descriptionurl?: string;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
    Credit?: { value?: string };
    ObjectName?: { value?: string };
  };
}

interface WikimediaPage {
  pageid: number;
  title: string;
  imageinfo?: WikimediaImageInfo[];
}

interface WikimediaResponse {
  error?: unknown;
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapWikimediaLicence(rawLicense?: string): DiscoveryLicence | null {
  if (!rawLicense) return null;
  const norm = rawLicense.trim().toLowerCase();
  if (norm.includes("cc0") || norm === "zero") return "CC0";
  if (
    norm.includes("public domain") ||
    norm === "pd" ||
    norm.startsWith("pd-") ||
    norm.includes("pdm")
  ) {
    return "PDM";
  }
  if (/^cc[ -]by[ -]sa(?:[ -]\d+(?:\.\d+)?)?$/.test(norm)) return "CC_BY_SA";
  if (/^cc[ -]by(?:[ -]\d+(?:\.\d+)?)?$/.test(norm)) return "CC_BY";
  return null;
}

export async function searchWikimedia(
  query: string,
  options?: { limit?: number; fetchFn?: typeof fetch },
): Promise<DiscoveredImage[]> {
  const limit = Math.min(Math.max(options?.limit ?? 15, 1), 50);
  const trimmed = query.trim();
  const filter = /^File:/i.test(trimmed)
    ? `titles=${encodeURIComponent(trimmed)}`
    : `generator=search&gsrsearch=${encodeURIComponent(trimmed)}&gsrnamespace=6&gsrlimit=${limit}`;
  return fetchWikimediaImages(filter, options?.fetchFn ?? fetch);
}

export async function getWikimediaImage(
  id: string,
  fetchFn = fetch,
): Promise<DiscoveredImage | null> {
  const pageId = /^wikimedia-(\d{1,12})$/.exec(id)?.[1];
  if (!pageId) return null;
  const items = await fetchWikimediaImages(`pageids=${pageId}`, fetchFn);
  return items.find((item) => item.id === id) ?? null;
}

async function fetchWikimediaImages(
  filter: string,
  doFetch: typeof fetch,
): Promise<DiscoveredImage[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&${filter}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=360&format=json`;

  const res = await doFetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent":
        "AheedFoodCentre/1.0 (https://aheedfoodcentre.co.uk; info@aheedfoodcentre.co.uk)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Wikimedia Commons API returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as WikimediaResponse;
  if (data.error) throw new Error("Wikimedia Commons returned an API error.");
  const pages = data.query?.pages;
  if (!pages) return [];

  const items: DiscoveredImage[] = [];

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;

    // Imageinfo appends attribution tracking parameters to the original URL.
    const imageUrl = info.url.split(/[?#]/, 1)[0];
    if (!/\.(jpe?g|png|webp)$/i.test(imageUrl)) continue;

    const rawLicense = info.extmetadata?.LicenseShortName?.value;
    const licence = mapWikimediaLicence(rawLicense);
    if (!licence) continue; // Only accept permitted open licenses

    const rawArtist =
      info.extmetadata?.Artist?.value || info.extmetadata?.Credit?.value || "Wikimedia Commons";
    const artist = stripHtml(rawArtist) || "Wikimedia Commons contributor";
    const cleanLic = stripHtml(rawLicense || licence);
    const attribution = `${artist} via Wikimedia Commons (${cleanLic})`;

    const rawTitle = info.extmetadata?.ObjectName?.value || page.title.replace(/^File:/, "");
    const cleanTitle = stripHtml(rawTitle);

    items.push({
      id: `wikimedia-${page.pageid}`,
      provider: "WIKIMEDIA",
      title: cleanTitle || "Wikimedia image",
      thumbnailUrl: info.thumburl || imageUrl,
      originalUrl: info.descriptionurl || imageUrl,
      downloadUrl: imageUrl,
      sourceSite: "Wikimedia Commons",
      licence,
      attribution,
      width: info.width,
      height: info.height,
    });
  }

  return items;
}
