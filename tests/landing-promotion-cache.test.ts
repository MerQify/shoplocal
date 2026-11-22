import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PromotionRow } from "@/lib/repositories/promotions";
import { openLandingPromotionCache } from "@/lib/landing-promotion-cache";

const platform = vi.hoisted(() => ({
  environment: "staging",
  host: "staging.aheedfoodcentre.co.uk",
  waitUntil: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: { APP_ENV: platform.environment },
    ctx: { waitUntil: platform.waitUntil },
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: platform.host }),
}));

const start = new Date("2026-11-22T10:00:00Z");
const row = (vendorId: string, endsAt: Date | null = null) =>
  ({ vendorId, endsAt, startsAt: null, createdAt: start, updatedAt: start }) as PromotionRow;

describe("Aheed staging homepage promotion cache", () => {
  const entries = new Map<string, Response>();
  const open = vi.fn(async () => ({
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, value: Response) => {
      entries.set(key.url, value);
    },
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.clearAllMocks();
    entries.clear();
    platform.environment = "staging";
    platform.host = "staging.aheedfoodcentre.co.uk";
    vi.stubGlobal("caches", { open });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reuses only the same tenant's eligible data and restores dates", async () => {
    const first = await openLandingPromotionCache("vendor-a");
    first?.write([row("vendor-a")], start, null);
    const second = await openLandingPromotionCache("vendor-b");

    expect(await first?.read()).toEqual([row("vendor-a")]);
    expect(await second?.read()).toBeNull();
    expect(platform.waitUntil).toHaveBeenCalledOnce();
  });

  it.each(["starts", "ends"])(
    "expires the cached results when a promotion %s",
    async (transition) => {
      const boundary = new Date(start.getTime() + 8_000);
      const cache = await openLandingPromotionCache("vendor-a");
      cache?.write(
        [row("vendor-a", transition === "ends" ? boundary : null)],
        start,
        transition === "starts" ? boundary : null,
      );

      vi.setSystemTime(boundary.getTime() - 1);
      expect(await cache?.read()).toHaveLength(1);
      vi.setSystemTime(boundary);
      expect(await cache?.read()).toBeNull();
    },
  );

  it("bounds how long an empty promotion list can be reused", async () => {
    const cache = await openLandingPromotionCache("vendor-a");
    cache?.write([], start, null);
    expect(await cache?.read()).toEqual([]);
    vi.advanceTimersByTime(30_000);
    expect(await cache?.read()).toBeNull();
  });

  it("does not enable the cache on production or another staging host", async () => {
    platform.environment = "production";
    expect(await openLandingPromotionCache("vendor-a")).toBeNull();
    platform.environment = "staging";
    platform.host = "srimart-staging.merqify.com";
    expect(await openLandingPromotionCache("vendor-a")).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});
