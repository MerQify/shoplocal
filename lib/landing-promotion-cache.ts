import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import type { PromotionRow } from "@/lib/repositories/promotions";

const HOST = "staging.aheedfoodcentre.co.uk";
const MAX_AGE_MS = 30_000;

export async function openLandingPromotionCache(vendorId: string) {
  try {
    const { env, ctx } = getCloudflareContext();
    if ((env as { APP_ENV?: string }).APP_ENV !== "staging") return null;
    if ((await headers()).get("host") !== HOST) return null;

    const cache = await caches.open("aheed-landing-promotions-v1");
    const key = new Request(
      `https://${HOST}/api/landing-promotion-cache/${encodeURIComponent(vendorId)}`,
    );

    return {
      async read(): Promise<PromotionRow[] | null> {
        try {
          const hit = await cache.match(key);
          if (!hit) return null;
          const expiresAt = Number(hit.headers.get("x-promotion-cache-expires"));
          const rows = JSON.parse(await hit.text(), (field, value) =>
            ["createdAt", "updatedAt", "startsAt", "endsAt"].includes(field) &&
            typeof value === "string"
              ? new Date(value)
              : value,
          ) as PromotionRow[];
          if (expiresAt <= Date.now() || !Array.isArray(rows)) return null;
          return rows.every((row) => row.vendorId === vendorId) ? rows : null;
        } catch {
          return null;
        }
      },
      write(rows: PromotionRow[], asOf: Date, nextStart: Date | null): void {
        const expiresAt = Math.min(
          asOf.getTime() + MAX_AGE_MS,
          nextStart?.getTime() ?? Infinity,
          ...rows.map((row) => row.endsAt?.getTime() ?? Infinity),
        );
        const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
        if (maxAge < 1) return;
        const response = Response.json(rows, {
          headers: {
            "cache-control": `public, max-age=${maxAge}`,
            "x-promotion-cache-expires": String(expiresAt),
          },
        });
        ctx.waitUntil(cache.put(key, response).catch(() => {}));
      },
    };
  } catch {
    return null;
  }
}
