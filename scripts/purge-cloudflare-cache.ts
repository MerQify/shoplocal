/**
 * Purge Cloudflare Edge Cache post-deployment (#1644).
 *
 * Usage:
 *   npx tsx scripts/purge-cloudflare-cache.ts [--env <staging|production>]
 *
 * Reads `CLOUDFLARE_API_TOKEN` (and optionally `CLOUDFLARE_ACCOUNT_ID`) from environment.
 * Lists accessible Cloudflare zones (e.g. `merqify.com`, `aheedfoodcentre.co.uk`) and
 * triggers `POST /zones/{zone_id}/purge_cache` with `{"purge_everything": true}`.
 *
 * Designed to degrade gracefully: if credentials are missing or token lacks Zone Purge
 * permission, prints a clear diagnostic log and exits cleanly (exit code 0) rather than
 * blocking or failing an otherwise successful Worker deployment.
 */

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

interface CloudflareZonesResponse {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: CloudflareZone[];
}

interface CloudflarePurgeResponse {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: { id: string };
}

export async function purgeZoneCache(
  zoneId: string,
  zoneName: string,
  token: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ purge_everything: true }),
    });

    const data = (await res.json()) as CloudflarePurgeResponse;
    if (res.ok && data.success) {
      return { ok: true, message: `Successfully purged cache for ${zoneName} (${zoneId})` };
    }

    const errDetails =
      data.errors?.map((e) => `${e.code}: ${e.message}`).join(", ") ?? res.statusText;
    return {
      ok: false,
      message: `Failed to purge cache for ${zoneName} (${zoneId}): ${errDetails}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Network error purging ${zoneName} (${zoneId}): ${msg}` };
  }
}

export async function purgeAllRelevantZones(
  token: string,
  targetDomains: string[] = ["merqify.com", "aheedfoodcentre.co.uk"],
): Promise<void> {
  let zones: CloudflareZone[] = [];

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn(
        `[purge-cache] Could not list Cloudflare zones (${res.status} ${res.statusText}). Token may lack Zone:Read permission.`,
      );
      return;
    }

    const data = (await res.json()) as CloudflareZonesResponse;
    if (!data.success || !data.result) {
      const errDetails =
        data.errors?.map((e) => `${e.code}: ${e.message}`).join(", ") ?? "Unknown error";
      console.warn(`[purge-cache] Cloudflare API error listing zones: ${errDetails}`);
      return;
    }

    zones = data.result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[purge-cache] Network error contacting Cloudflare API: ${msg}`);
    return;
  }

  const matchingZones = zones.filter((z) =>
    targetDomains.some((domain) => z.name === domain || z.name.endsWith(`.${domain}`)),
  );

  if (matchingZones.length === 0) {
    console.log(`[purge-cache] No matching zones found for domains: ${targetDomains.join(", ")}`);
    return;
  }

  console.log(
    `[purge-cache] Found ${matchingZones.length} matching zone(s): ${matchingZones.map((z) => z.name).join(", ")}`,
  );

  for (const zone of matchingZones) {
    const result = await purgeZoneCache(zone.id, zone.name, token);
    if (result.ok) {
      console.log(`[purge-cache] ✓ ${result.message}`);
    } else {
      console.warn(`[purge-cache] ⚠ ${result.message}`);
    }
  }
}

async function main(): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.log(
      "[purge-cache] CLOUDFLARE_API_TOKEN is not set; skipping Cloudflare edge cache purge.",
    );
    return;
  }

  await purgeAllRelevantZones(token);
}

if (process.argv[1]?.endsWith("purge-cloudflare-cache.ts")) {
  main().catch((err) => {
    console.error("[purge-cache] Unexpected error during cache purge:", err);
    process.exit(0); // Do not fail deployment on cache purge exception
  });
}
