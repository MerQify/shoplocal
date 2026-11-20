import { describe, expect, it, vi } from "vitest";
import {
  approveAsset,
  deleteUsage,
  getAsset,
  getAssetContent,
  recordUsage,
  rejectAsset,
  searchAssets,
  uploadAsset,
  type HubCaller,
  type HubResult,
} from "./client";
import { storeSourceForHubSource } from "./source";

const ASSET = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Lamb chops",
  alt: null,
  status: "APPROVED",
  source: "UPLOAD",
  licence: "OWNER_SUPPLIED",
  attribution: null,
  originalUrl: null,
  sourceSite: null,
  contentType: "image/webp",
  byteSize: 1000,
  width: 10,
  height: 10,
  storageKey: "tenants/t/x.webp",
  createdAt: "2026-11-20T00:00:00Z",
  rejectionReason: null,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function caller(fetchImpl: typeof fetch): HubCaller {
  return {
    config: { url: "https://hub.test", apiKey: "mih_stg_KEY" },
    tenant: "aheed-food-centre",
    actor: "user-1",
    fetch: fetchImpl,
  };
}

function stub(response: Response) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response);
}

function sentHeaders(fetchMock: ReturnType<typeof stub>): Record<string, string> {
  return fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
}

function expectHeaders(fetchMock: ReturnType<typeof stub>) {
  const h = sentHeaders(fetchMock);
  expect(h.authorization).toBe("Bearer mih_stg_KEY");
  expect(h["x-image-hub-tenant"]).toBe("aheed-food-centre");
  expect(h["x-image-hub-actor"]).toBe("user-1");
}

const HUB_ERROR = { error: { code: "not_found", message: "No such image" } };

function expectHubError(result: HubResult<unknown>) {
  expect(result).toEqual({ ok: false, code: "not_found", message: "No such image", status: 404 });
}

// One case per R3 function: [name, call, expected method, expected path, success body/status].
const cases: Array<{
  name: string;
  call: (c: HubCaller) => Promise<HubResult<unknown>>;
  method: string;
  path: string;
  success: () => Response;
}> = [
  {
    name: "searchAssets",
    call: (c) => searchAssets(c, { q: "lamb", status: "APPROVED", cursor: "abc", limit: 24 }),
    method: "GET",
    path: "/v1/assets?q=lamb&status=APPROVED&cursor=abc&limit=24",
    success: () => jsonResponse(200, { items: [ASSET], nextCursor: null }),
  },
  {
    name: "searchAssets (sort, #1678 R1)",
    call: (c) => searchAssets(c, { q: "basmati rice", status: "APPROVED", sort: "relevance" }),
    method: "GET",
    path: "/v1/assets?q=basmati+rice&status=APPROVED&sort=relevance",
    success: () => jsonResponse(200, { items: [{ ...ASSET, relevance: 5 }], nextCursor: null }),
  },
  {
    name: "getAsset",
    call: (c) => getAsset(c, ASSET.id),
    method: "GET",
    path: `/v1/assets/${ASSET.id}`,
    success: () => jsonResponse(200, ASSET),
  },
  {
    name: "getAssetContent",
    call: (c) => getAssetContent(c, ASSET.id),
    method: "GET",
    path: `/v1/assets/${ASSET.id}/content`,
    success: () =>
      new Response("bytes", { status: 200, headers: { "content-type": "image/webp" } }),
  },
  {
    name: "uploadAsset",
    call: (c) =>
      uploadAsset(c, {
        file: new Blob(["x"], { type: "image/webp" }),
        fileName: "x.webp",
        title: "Lamb",
        licence: "OWNER_SUPPLIED",
      }),
    method: "POST",
    path: "/v1/assets",
    success: () => jsonResponse(201, { ...ASSET, status: "PENDING_REVIEW" }),
  },
  {
    name: "approveAsset",
    call: (c) => approveAsset(c, ASSET.id),
    method: "POST",
    path: `/v1/assets/${ASSET.id}/approve`,
    success: () => jsonResponse(200, ASSET),
  },
  {
    name: "rejectAsset",
    call: (c) => rejectAsset(c, ASSET.id, "Blurry"),
    method: "POST",
    path: `/v1/assets/${ASSET.id}/reject`,
    success: () => jsonResponse(200, { ...ASSET, status: "REJECTED" }),
  },
  {
    name: "recordUsage",
    call: (c) => recordUsage(c, ASSET.id, { kind: "PRODUCT", externalId: "p1" }),
    method: "POST",
    path: `/v1/assets/${ASSET.id}/usages`,
    success: () =>
      jsonResponse(201, { id: "u1", kind: "PRODUCT", externalId: "p1", createdAt: "x" }),
  },
  {
    name: "deleteUsage",
    call: (c) => deleteUsage(c, ASSET.id, "u1"),
    method: "DELETE",
    path: `/v1/assets/${ASSET.id}/usages/u1`,
    success: () => new Response(null, { status: 204 }),
  },
];

describe("image hub client (#1671 R3/R4)", () => {
  for (const testCase of cases) {
    describe(testCase.name, () => {
      it("sends the method, path and three headers, and returns ok on success", async () => {
        const fetchMock = stub(testCase.success());
        const result = await testCase.call(caller(fetchMock as unknown as typeof fetch));
        expect(result.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]![0]).toBe(`https://hub.test${testCase.path}`);
        expect(fetchMock.mock.calls[0]![1]!.method).toBe(testCase.method);
        expectHeaders(fetchMock);
      });

      it("passes the hub's error code through", async () => {
        const fetchMock = stub(jsonResponse(404, HUB_ERROR));
        expectHubError(await testCase.call(caller(fetchMock as unknown as typeof fetch)));
      });
    });
  }

  it("reports a rejected fetch as unreachable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const result = await searchAssets(caller(fetchMock as unknown as typeof fetch));
    expect(result).toMatchObject({ ok: false, code: "unreachable" });
  });

  it("falls back to http_error when the body is not the hub envelope", async () => {
    const fetchMock = stub(new Response("<html>", { status: 502 }));
    const result = await getAsset(caller(fetchMock as unknown as typeof fetch), ASSET.id);
    expect(result).toMatchObject({ ok: false, code: "http_error", status: 502 });
  });

  it("sends the upload as multipart with rightsConfirmed=true and the licence", async () => {
    const fetchMock = stub(jsonResponse(201, ASSET));
    await uploadAsset(caller(fetchMock as unknown as typeof fetch), {
      file: new Blob(["x"], { type: "image/webp" }),
      fileName: "x.webp",
      title: "Lamb",
      licence: "SUPPLIER_PERMISSION",
    });
    const body = fetchMock.mock.calls[0]![1]!.body as FormData;
    expect(body.get("rightsConfirmed")).toBe("true");
    expect(body.get("licence")).toBe("SUPPLIER_PERMISSION");
    expect(body.get("title")).toBe("Lamb");
  });

  it("sends the reject reason and usage as JSON", async () => {
    const rejectFetch = stub(jsonResponse(200, ASSET));
    await rejectAsset(caller(rejectFetch as unknown as typeof fetch), ASSET.id, "Blurry");
    expect(JSON.parse(rejectFetch.mock.calls[0]![1]!.body as string)).toEqual({ reason: "Blurry" });

    const usageFetch = stub(jsonResponse(201, {}));
    await recordUsage(caller(usageFetch as unknown as typeof fetch), ASSET.id, {
      kind: "CATEGORY",
      externalId: "c1",
    });
    expect(JSON.parse(usageFetch.mock.calls[0]![1]!.body as string)).toEqual({
      kind: "CATEGORY",
      externalId: "c1",
    });
  });
});

describe("storeSourceForHubSource (#1671 R17)", () => {
  it.each([
    ["UPLOAD", "UNKNOWN"],
    ["AI_GENERATED", "AI_GENERATED"],
    ["OPEN_FOOD_FACTS", "OPEN_FOOD_FACTS"],
    ["OPENVERSE", "UNKNOWN"],
    ["WIKIMEDIA", "UNKNOWN"],
    ["SUPPLIER", "UNKNOWN"],
  ] as const)("maps %s to %s", (hub, store) => {
    expect(storeSourceForHubSource(hub)).toBe(store);
  });
});
