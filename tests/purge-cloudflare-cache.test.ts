import { describe, it, expect, vi, beforeEach } from "vitest";
import { purgeZoneCache, purgeAllRelevantZones } from "@/scripts/purge-cloudflare-cache";

describe("purge-cloudflare-cache (#1644)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully purges zone cache when API returns success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: { id: "zone-123" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await purgeZoneCache("zone-123", "aheedfoodcentre.co.uk", "test-token");
    expect(res.ok).toBe(true);
    expect(res.message).toContain("Successfully purged cache for aheedfoodcentre.co.uk");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-123/purge_cache",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ purge_everything: true }),
      }),
    );
  });

  it("handles purge failure gracefully without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10000, message: "Authentication error" }],
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await purgeZoneCache("zone-123", "aheedfoodcentre.co.uk", "bad-token");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Authentication error");
  });

  it("lists and purges matching zones", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        // GET zones
        new Response(
          JSON.stringify({
            success: true,
            result: [
              { id: "z1", name: "merqify.com", status: "active" },
              { id: "z2", name: "other.com", status: "active" },
              { id: "z3", name: "aheedfoodcentre.co.uk", status: "active" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        // POST purge z1
        new Response(JSON.stringify({ success: true, result: { id: "z1" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        // POST purge z3
        new Response(JSON.stringify({ success: true, result: { id: "z3" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await purgeAllRelevantZones("test-token", ["merqify.com", "aheedfoodcentre.co.uk"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
