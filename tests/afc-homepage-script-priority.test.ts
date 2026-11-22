import { afterEach, describe, expect, it, vi } from "vitest";
import { applyHomepageScriptPriority } from "@/workers/afc-homepage-priority/priority.mjs";

const root = "https://staging.aheedfoodcentre.co.uk/";
const html = () => new Response("<h1>Shop</h1>", { headers: { "Content-Type": "text/html" } });

afterEach(() => vi.unstubAllGlobals());

describe("Aheed homepage priority experiment", () => {
  it("leaves production, other hosts, non-homepage and RSC responses alone", () => {
    const response = html();
    expect(applyHomepageScriptPriority(new Request(root), "production", response)).toBe(response);
    expect(
      applyHomepageScriptPriority(
        new Request("https://srimart-staging.merqify.com/"),
        "staging",
        response,
      ),
    ).toBe(response);
    expect(applyHomepageScriptPriority(new Request(root + "cart"), "staging", response)).toBe(
      response,
    );
    const rsc = new Response("payload", { headers: { "Content-Type": "text/x-component" } });
    expect(applyHomepageScriptPriority(new Request(root), "staging", rsc)).toBe(rsc);
  });

  it("opts into an unmodified same-build control", async () => {
    const request = new Request(root, { headers: { "x-afc-homepage-script-priority": "control" } });
    const response = applyHomepageScriptPriority(request, "staging", html());
    expect(response.headers.get("x-afc-homepage-script-priority")).toBe("control");
    expect(await response.text()).toBe("<h1>Shop</h1>");
  });

  it("lowers only the priority of Next.js script requests", () => {
    const selectors = new Map<
      string,
      (element: { getAttribute: () => string; setAttribute: ReturnType<typeof vi.fn> }) => void
    >();
    vi.stubGlobal(
      "HTMLRewriter",
      class {
        on(selector: string, handler: { element: NonNullable<ReturnType<typeof selectors.get>> }) {
          selectors.set(selector, handler.element);
          return this;
        }
        transform(response: Response) {
          return response;
        }
      },
    );
    const response = applyHomepageScriptPriority(new Request(root), "staging", html());
    expect(response.headers.get("x-afc-homepage-script-priority")).toBe("low");
    expect([...selectors.keys()]).toEqual([
      "script[src]",
      'link[rel="preload"][as="script"][href]',
    ]);
    for (const handler of selectors.values()) {
      const setAttribute = vi.fn();
      handler({ getAttribute: () => "/_next/static/chunks/app.js?v=1", setAttribute });
      handler({ getAttribute: () => "/_next/static/css/app.css", setAttribute });
      handler({ getAttribute: () => "https://example.com/tracking.js", setAttribute });
      expect(setAttribute.mock.calls).toEqual([["fetchpriority", "low"]]);
    }
  });
});
