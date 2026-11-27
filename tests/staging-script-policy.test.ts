import { describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({ initOpenNextCloudflareForDev: vi.fn() }));

describe("staging browser policy", () => {
  it("trials strict scripts on staging hosts while preserving staff cache controls", async () => {
    const { default: config } = await import("../next.config.mjs");
    const rules = await config.headers();
    const trial = rules.find((rule) =>
      rule.headers.some((h) => h.key === "Content-Security-Policy-Report-Only"),
    );
    expect(trial?.headers[0].value).toContain("script-src 'self';");
    const hosts = new RegExp("^(?:" + trial?.has?.[0].value + ")$");
    expect(hosts.test("staging.aheedfoodcentre.co.uk")).toBe(true);
    expect(hosts.test("www.aheedfoodcentre.co.uk")).toBe(false);
    expect(hosts.test("merqify.com")).toBe(false);
    expect(rules.find((rule) => rule.source === "/staff/:path*")?.headers).toContainEqual({
      key: "Cache-Control",
      value: "private, no-store, must-revalidate",
    });
  });
});
