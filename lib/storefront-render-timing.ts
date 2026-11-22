import { cache } from "react";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const getProbeId = cache(async () => {
  try {
    const { env } = getCloudflareContext();
    if ((env as { APP_ENV?: string }).APP_ENV !== "staging") return null;
  } catch {
    return null;
  }
  const requestHeaders = await headers();
  if (requestHeaders.get("host") !== "staging.aheedfoodcentre.co.uk") return null;
  const id = requestHeaders.get("x-storefront-render-probe");
  return id && /^[a-f0-9]{16}$/.test(id) ? id : null;
});

export async function timeStorefrontRender<T>(phase: string, read: () => Promise<T>): Promise<T> {
  const probe = await getProbeId();
  if (!probe) return read();

  const start = performance.now();
  let failed = true;
  try {
    const result = await read();
    failed = false;
    return result;
  } finally {
    console.log(
      "storefront-render-timing",
      JSON.stringify({
        probe,
        phase,
        start: Math.round(start),
        finish: Math.round(performance.now()),
        failed,
      }),
    );
  }
}
