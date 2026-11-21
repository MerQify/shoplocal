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
  if (norm.includes("cc-by-sa") || norm.includes("cc by-sa")) return "CC_BY_SA";
  if (norm.includes("cc-by") || norm.includes("cc by")) return "CC_BY";
  return null;
}

export async function searchWikimedia(
  query: string,
  options?: { limit?: number; fetchFn?: typeof fetch },
): Promise<DiscoveredImage[]> {
  const limit = Math.min(Math.max(options?.limit ?? 15, 1), 50);
  const doFetch = options?.fetchFn ?? fetch;

  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query,
  )}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|size|extmetadata&format=json&origin=*`;

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
  const pages = data.query?.pages;
  if (!pages) return [];

  const items: DiscoveredImage[] = [];

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;

    // Reject non-image media (PDFs, audio, video)
    if (!/\.(jpe?g|png|webp|svg)$/i.test(info.url)) continue;

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
      thumbnailUrl: info.thumburl || info.url,
      originalUrl: info.descriptionurl || info.url,
      downloadUrl: info.url,
      sourceSite: "Wikimedia Commons",
      licence,
      attribution,
      width: info.width,
      height: info.height,
    });
  }

  return items;
}
