/**
 * Purge Cloudflare's edge cache for the hosts one deploy just shipped (#1644, #1664).
 *
 * Usage:
 *   npx tsx scripts/purge-cloudflare-cache.ts --env <staging|production|afc-staging|afc-production>
 *
 * Reads `CLOUDFLARE_API_TOKEN` from the environment. The token needs Zone → Zone → Read and
 * Zone → Cache Purge → Purge on the zone that serves the hosts (`merqify.com`; Cloudflare for SaaS
 * custom hostnames such as `staging.aheedfoodcentre.co.uk` are purged through that same zone).
 *
 * #1664 — three changes over #1644's version:
 *   1. PER HOST, not `purge_everything`. The hosts are the deployed environment's `wrangler.toml`
 *      routes (`parseRoutePatterns`, SaaS origin hosts excluded), so a staging deploy no longer
 *      empties production's cache.
 *   2. VISIBLE on failure. Under GitHub Actions a failure is a `::warning::` annotation on the run
 *      summary, not a log line nobody reads — #1644's purge failed on every deploy for its whole
 *      life (token lacked Cache Purge) and every run was green.
 *   3. VERIFIED. After purging, each host's `/help` is requested once; an edge `HIT` older than the
 *      purge means the purge did not take, and that is a warning too.
 *
 * It still always exits 0: the Worker deployed fine, and a cache problem must not fail that.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseRoutePatterns } from "./verify-worker-routes";

const API = "https://api.cloudflare.com/client/v4";
/** The zone every deployed host is served through (custom domains and SaaS custom hostnames). */
export const PURGE_ZONE = "merqify.com";
/** Cloudflare's per-request limit for purge-by-hostname. */
const HOSTS_PER_REQUEST = 30;
/** The page the verification requests — public, rendered on every vendor. */
const VERIFY_PATH = "/help";

interface CloudflareResponse<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: T;
}

function errorText(data: CloudflareResponse<unknown> | null, fallback: string): string {
  return data?.errors?.map((e) => `${e.code}: ${e.message}`).join(", ") || fallback;
}

/** A warning that lands on the GitHub run summary under Actions, and a plain line otherwise. */
export function warn(message: string, env: Record<string, string | undefined> = process.env): void {
  if (env.GITHUB_ACTIONS === "true") {
    console.log(`::warning title=Cloudflare cache purge::${message.replace(/\r?\n/g, " ")}`);
  } else {
    console.warn(`[purge-cache] ⚠ ${message}`);
  }
}

/** The bare hosts `envName` routes, deduplicated; wildcard hosts are skipped (not purgeable). */
export function hostsForEnv(toml: string, envName: string): string[] {
  return [...new Set(parseRoutePatterns(toml, envName))].filter(
    (h) => !h.includes("*") && !h.includes("/"),
  );
}

export async function findZoneId(
  zoneName: string,
  token: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API}/zones?name=${encodeURIComponent(zoneName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => null)) as CloudflareResponse<
      Array<{ id: string; name: string }>
    > | null;
    const zone = data?.result?.find((z) => z.name === zoneName);
    if (res.ok && data?.success && zone) return { ok: true, id: zone.id };
    return {
      ok: false,
      message: `Could not find zone ${zoneName} (${errorText(data, `HTTP ${res.status}`)}). The token needs Zone → Zone → Read on it.`,
    };
  } catch (err) {
    return { ok: false, message: `Network error looking up zone ${zoneName}: ${String(err)}` };
  }
}

export async function purgeHosts(
  zoneId: string,
  hosts: string[],
  token: string,
): Promise<{ ok: boolean; message: string }> {
  for (let i = 0; i < hosts.length; i += HOSTS_PER_REQUEST) {
    const batch = hosts.slice(i, i + HOSTS_PER_REQUEST);
    try {
      const res = await fetch(`${API}/zones/${zoneId}/purge_cache`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hosts: batch }),
      });
      const data = (await res.json().catch(() => null)) as CloudflareResponse<unknown> | null;
      if (!res.ok || !data?.success) {
        return {
          ok: false,
          message: `Failed to purge ${batch.join(", ")}: ${errorText(data, `HTTP ${res.status}`)}. The token needs Zone → Cache Purge → Purge on ${PURGE_ZONE}.`,
        };
      }
    } catch (err) {
      return { ok: false, message: `Network error purging ${batch.join(", ")}: ${String(err)}` };
    }
  }
  return { ok: true, message: `Purged ${hosts.join(", ")}` };
}

/**
 * Is `host` still serving a copy cached before `purgedAt`? Only a `HIT` whose `Age` reaches back
 * past the purge counts — `MISS`, `EXPIRED`, `DYNAMIC` or a fresh `HIT` all mean the purge took.
 */
export async function verifyFresh(
  host: string,
  purgedAt: number,
  now: () => number = Date.now,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`https://${host}${VERIFY_PATH}`, { redirect: "manual" });
    const status = res.headers.get("cf-cache-status") ?? "none";
    const age = Number(res.headers.get("age") ?? "0");
    const cachedBeforePurge = now() - age * 1000 < purgedAt;
    if (status.toUpperCase() === "HIT" && cachedBeforePurge) {
      return {
        ok: false,
        message: `${host}${VERIFY_PATH} is still served from a copy cached ${age}s ago, before the purge.`,
      };
    }
    return { ok: true, message: `${host}${VERIFY_PATH}: cf-cache-status ${status}` };
  } catch (err) {
    // Unreachable is not "stale"; the route check and smoke tests own reachability.
    return { ok: true, message: `${host}${VERIFY_PATH}: not checked (${String(err)})` };
  }
}

export async function purgeEnvironment(
  envName: string,
  token: string,
  toml: string,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const hosts = hostsForEnv(toml, envName);
  if (hosts.length === 0) {
    warn(`No routed hosts found for env "${envName}" in wrangler.toml; nothing purged.`, env);
    return;
  }

  const zone = await findZoneId(PURGE_ZONE, token);
  if (!zone.ok) return warn(zone.message, env);

  const purgedAt = Date.now();
  const purge = await purgeHosts(zone.id, hosts, token);
  if (!purge.ok) return warn(purge.message, env);
  console.log(`[purge-cache] ✓ ${purge.message}`);

  for (const host of hosts) {
    const check = await verifyFresh(host, purgedAt);
    if (check.ok) console.log(`[purge-cache] ✓ ${check.message}`);
    else warn(check.message, env);
  }
}

export function envArg(argv: string[]): string | null {
  const i = argv.indexOf("--env");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}

async function main(): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return warn("CLOUDFLARE_API_TOKEN is not set; cache not purged.");
  const envName = envArg(process.argv.slice(2));
  if (!envName) return warn("No --env given; cache not purged.");
  await purgeEnvironment(envName, token, readFileSync("wrangler.toml", "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    warn(`Unexpected error during cache purge: ${String(err)}`);
    process.exit(0); // never fail a deployment on the cache step
  });
}
