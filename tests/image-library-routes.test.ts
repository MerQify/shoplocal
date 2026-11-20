import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #1671 R9/R11 — the two `/api/admin/image-library/*` route handlers, run for real over the real
 * `lib/image-hub-service`, with auth, config and the hub (`fetch`) stubbed.
 */

const auth = vi.hoisted(() => ({ result: null as unknown }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", () => ({ getPrisma: () => ({}), getPrismaWs: () => ({}) }));
vi.mock("@/lib/auth-rbac", () => ({ requireVendorRole: async () => auth.result }));
vi.mock("@/lib/config", () => ({
  getImageHubEnv: () => ({ configured: true, url: "https://hub.test", apiKey: "mih_stg_KEY" }),
}));
vi.mock("@/lib/vendor-service", () => ({
  fetchVendorProfile: async () => ({ slug: "aheed-food-centre" }),
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({}) }));
vi.mock("@/lib/products-service", () => ({}));
vi.mock("@/lib/categories-service", () => ({}));
vi.mock("@/lib/category-assets-service", () => ({}));

import { POST as upload } from "@/app/api/admin/image-library/upload/route";
import { GET as content } from "@/app/api/admin/image-library/[id]/content/route";

const STAFF = {
  ok: true,
  user: { id: "user-1", email: "u@test", name: "U" },
  vendorId: "vendor-1",
  via: "STAFF",
};
const NO_SESSION = { ok: false, status: 401, reason: "unauthenticated" };
const CUSTOMER = { ok: false, status: 403, reason: "forbidden" };

function form(overrides: Record<string, string | Blob | null> = {}): Request {
  const body = new FormData();
  const fields: Record<string, string | Blob | null> = {
    file: new Blob([new Uint8Array(10)], { type: "image/webp" }),
    title: "Title",
    licence: "OWNER_SUPPLIED",
    rightsConfirmed: "true",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== null) body.set(key, value);
  return new Request("https://store.test/api/admin/image-library/upload", { method: "POST", body });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  auth.result = STAFF;
});

describe("POST /api/admin/image-library/upload (R11)", () => {
  it("answers 401 without a session and 403 for a customer", async () => {
    auth.result = NO_SESSION;
    expect((await upload(form())).status).toBe(401);
    auth.result = CUSTOMER;
    expect((await upload(form())).status).toBe(403);
  });

  it.each([
    ["non-WebP", { file: new Blob(["x"], { type: "image/png" }) }],
    [
      "over 2 MB",
      { file: new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/webp" }) },
    ],
    ["bad licence", { licence: "CC_BY" }],
    ["no rights confirmation", { rightsConfirmed: null }],
    ["empty title", { title: "" }],
  ])("answers 400 for %s", async (_label, override) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await upload(form(override))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a valid upload and returns 201 with the pending asset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: "a1", status: "PENDING_REVIEW" }), { status: 201 }),
      ),
    );
    const response = await upload(form());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ status: "PENDING_REVIEW" });
  });

  it("maps a hub duplicate to 409 with the already-in-the-library message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "duplicate", message: "dup" } }), {
            status: 409,
          }),
      ),
    );
    const response = await upload(form());
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain("already in the library");
  });
});

describe("GET /api/admin/image-library/[id]/content (R9)", () => {
  const params = { params: Promise.resolve({ id: "a1" }) };
  const request = new Request("https://store.test/api/admin/image-library/a1/content");

  it("answers 401 without a session and 403 for a customer", async () => {
    auth.result = NO_SESSION;
    expect((await content(request, params)).status).toBe(401);
    auth.result = CUSTOMER;
    expect((await content(request, params)).status).toBe(403);
  });

  it("streams the hub bytes with the hub's type and a private cache header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("bytes", { status: 200, headers: { "content-type": "image/jpeg" } }),
      ),
    );
    const response = await content(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await response.text()).toBe("bytes");
  });

  it("answers 404 when the hub has no such asset for this tenant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "not_found", message: "No such image" } }), {
            status: 404,
          }),
      ),
    );
    expect((await content(request, params)).status).toBe(404);
  });
});
