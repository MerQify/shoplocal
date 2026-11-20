/**
 * #1671 R21 — read-only check that a store env file can reach the Merqify Image Hub with its key.
 *
 *   npx tsx scripts/verify-image-hub.ts --env-file secrets/merqify-staging.vars
 *
 * Runs exactly two GET requests with the file's IMAGE_HUB_URL and IMAGE_HUB_API_KEY:
 *   1. GET /v1/health                       → prints `health ok (<env>)`
 *   2. GET /v1/assets?limit=1 for tenant aheed-food-centre → prints `search ok`
 * and exits 0 when both succeed, non-zero naming the failing call otherwise.
 *
 * It never prints the key, and makes no write request. Green means the key is accepted and can
 * read; it says nothing about write or review scope, which only a real upload proves.
 */
import { parseEnvFile } from "./lib/env-file";

const TENANT = "aheed-food-centre";

/** One GET, retried up to three times on a network error only (this machine drops connections). */
async function get(url: string, headers: Record<string, string> = {}): Promise<Response | Error> {
  let last: Error = new Error("not attempted");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(url, { method: "GET", headers });
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
    }
  }
  return last;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<number> {
  const file = argValue("--env-file");
  if (!file) {
    console.error("Usage: npx tsx scripts/verify-image-hub.ts --env-file <path>");
    return 2;
  }
  const vars = parseEnvFile(file);
  const url = vars.IMAGE_HUB_URL?.replace(/\/+$/, "");
  const key = vars.IMAGE_HUB_API_KEY;
  if (!url || !key) {
    console.error(`IMAGE_HUB_URL and IMAGE_HUB_API_KEY must both be set in ${file}`);
    return 2;
  }

  const health = await get(`${url}/v1/health`);
  if (health instanceof Error || !health.ok) {
    console.error(`health FAILED (${health instanceof Error ? health.message : health.status})`);
    return 1;
  }
  const body = (await health.json().catch(() => ({}))) as { status?: string; env?: string };
  if (body.status !== "ok") {
    console.error(`health FAILED (status ${body.status ?? "unknown"})`);
    return 1;
  }
  console.log(`health ok (${body.env ?? "unknown"})`);

  const search = await get(`${url}/v1/assets?limit=1`, {
    authorization: `Bearer ${key}`,
    "x-image-hub-tenant": TENANT,
  });
  if (search instanceof Error || !search.ok) {
    const detail =
      search instanceof Error
        ? search.message
        : `${search.status} ${((await search.json().catch(() => ({}))) as { error?: { code?: string } }).error?.code ?? ""}`.trim();
    console.error(`search FAILED (${detail})`);
    return 1;
  }
  console.log("search ok");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
