import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  envArg,
  findZoneId,
  hostsForEnv,
  purgeEnvironment,
  purgeHosts,
  verifyFresh,
  warn,
} from "@/scripts/purge-cloudflare-cache";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const TOML = `
[[env.staging.routes]]
pattern = "aheed-staging.merqify.com"
custom_domain = true

[[env.afc-staging.routes]]
pattern = "staging.aheedfoodcentre.co.uk/*"
zone_name = "merqify.com"

[[env.afc-staging.routes]]
pattern = "afc-staging-origin.merqify.com"
custom_domain = true
`;

describe("purge-cloudflare-cache (#1644, #1664)", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("purges only the deployed environment's routed hosts, never the SaaS origin", () => {
    expect(hostsForEnv(TOML, "afc-staging")).toEqual(["staging.aheedfoodcentre.co.uk"]);
    expect(hostsForEnv(TOML, "staging")).toEqual(["aheed-staging.merqify.com"]);
    expect(hostsForEnv(TOML, "production")).toEqual([]);
  });

  it("purges by hostname, not purge_everything", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ success: true }));
    const res = await purgeHosts("zone-1", ["staging.aheedfoodcentre.co.uk"], "t");
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ hosts: ["staging.aheedfoodcentre.co.uk"] }),
      }),
    );
  });

  it("reports an authentication failure with the missing permission named", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }, 403),
    );
    const res = await purgeHosts("zone-1", ["a.example"], "bad");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Authentication error");
    expect(res.message).toContain("Cache Purge");
  });

  it("finds the zone id by exact name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json({ success: true, result: [{ id: "z1", name: "merqify.com" }] }),
    );
    expect(await findZoneId("merqify.com", "t")).toEqual({ ok: true, id: "z1" });
  });

  it("flags a HIT cached before the purge as stale, and accepts anything fresher", async () => {
    const purgedAt = 1_000_000;
    const now = () => purgedAt + 5_000;
    const resp = (status: string, age: string) =>
      new Response("", { headers: { "cf-cache-status": status, age } });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resp("HIT", "9356"));
    expect((await verifyFresh("h.example", purgedAt, now)).ok).toBe(false);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resp("HIT", "2"));
    expect((await verifyFresh("h.example", purgedAt, now)).ok).toBe(true);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resp("EXPIRED", "9356"));
    expect((await verifyFresh("h.example", purgedAt, now)).ok).toBe(true);
  });

  it("emits a GitHub warning annotation under Actions", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    warn("purge failed", { GITHUB_ACTIONS: "true" });
    expect(log).toHaveBeenCalledWith("::warning title=Cloudflare cache purge::purge failed");
  });

  it("warns, and does not throw, when the purge is refused", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ success: true, result: [{ id: "z1", name: "merqify.com" }] }))
      .mockResolvedValueOnce(
        json({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }, 403),
      );
    await expect(
      purgeEnvironment("afc-staging", "t", TOML, { GITHUB_ACTIONS: "true" }),
    ).resolves.toBeUndefined();
    expect(log.mock.calls.flat().join("\n")).toMatch(/::warning .*Authentication error/);
  });

  it("reads --env from argv", () => {
    expect(envArg(["--env", "afc-production"])).toBe("afc-production");
    expect(envArg([])).toBeNull();
  });
});
