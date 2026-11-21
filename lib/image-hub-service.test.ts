import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVendorRole: vi.fn(),
  getImageHubEnv: vi.fn(),
  fetchVendorProfile: vi.fn(),
  getProductForAdmin: vi.fn(),
  listProductsForAdmin: vi.fn(),
  setPrimaryProductImage: vi.fn(),
  addProductImage: vi.fn(),
  setProductImageHubUsage: vi.fn(),
  getCategoryForAdmin: vi.fn(),
  createCategoryAssetForVendor: vi.fn(),
  setCategoryAssetHubUsageForVendor: vi.fn(),
  getVendorAiMeter: vi.fn(),
  getImageGenerationService: vi.fn(),
  storage: {
    putObject: vi.fn(),
    headObject: vi.fn(),
    presignPut: vi.fn(),
    publicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
  },
}));

vi.mock("@/lib/auth-rbac", () => ({ requireVendorRole: mocks.requireVendorRole }));
vi.mock("@/lib/config", () => ({ getImageHubEnv: mocks.getImageHubEnv }));
vi.mock("@/lib/storage", () => ({ getStorage: () => mocks.storage }));
vi.mock("@/lib/vendor-service", () => ({ fetchVendorProfile: mocks.fetchVendorProfile }));
vi.mock("@/lib/products-service", () => ({
  getProductForAdmin: mocks.getProductForAdmin,
  listProductsForAdmin: mocks.listProductsForAdmin,
  setPrimaryProductImage: mocks.setPrimaryProductImage,
  addProductImage: mocks.addProductImage,
  setProductImageHubUsage: mocks.setProductImageHubUsage,
}));
vi.mock("@/lib/categories-service", () => ({ getCategoryForAdmin: mocks.getCategoryForAdmin }));
vi.mock("@/lib/category-assets-service", () => ({
  createCategoryAssetForVendor: mocks.createCategoryAssetForVendor,
  setCategoryAssetHubUsageForVendor: mocks.setCategoryAssetHubUsageForVendor,
}));
vi.mock("@/lib/ai-meter-service", () => ({
  getVendorAiMeter: mocks.getVendorAiMeter,
}));
vi.mock("@/lib/image-generation", () => ({
  getImageGenerationService: mocks.getImageGenerationService,
  IMAGE_GENERATION_MODEL: "@cf/black-forest-labs/flux-1-schnell",
}));

import {
  approveImageLibraryAsset,
  assignLibraryAssetToCategory,
  assignLibraryAssetToProduct,
  finalizeCategoryAssign,
  finalizeProductAssign,
  generateAiImageForLibrary,
  listProductsForAiPrompt,
  rejectImageLibraryAsset,
  releaseHubUsage,
  requestCategoryImageUploadTicket,
  searchDiscoveredImagesForStaff,
  importDiscoveredImageToHub,
  searchImageLibrary,
  uploadToImageLibrary,
} from "./image-hub-service";

const VENDOR = "vendor-1";
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_ID,
    title: "Library image",
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
    storageKey: "tenants/aheed/hub-key.webp",
    createdAt: "2026-11-20T00:00:00Z",
    rejectionReason: null,
    ...overrides,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Routes stubbed hub responses by method + path suffix. */
function hub(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace("https://hub.test", "");
    const method = init?.method ?? "GET";
    const key = Object.keys(routes).find((k) => {
      const [m, p] = k.split(" ");
      return m === method && path.startsWith(p!);
    });
    if (!key) throw new Error(`unexpected hub call ${method} ${path}`);
    return routes[key]!();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function asRole(via: "STAFF" | "ADMIN") {
  mocks.requireVendorRole.mockImplementation(async (...allowed: string[]) =>
    allowed.includes(via)
      ? { ok: true, user: { id: "user-1", email: "u@test", name: "U" }, vendorId: VENDOR, via }
      : { ok: false, status: 403, reason: "forbidden" },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.getImageHubEnv.mockReturnValue({
    configured: true,
    url: "https://hub.test",
    apiKey: "mih_stg_KEY",
  });
  mocks.fetchVendorProfile.mockResolvedValue({ slug: "aheed-food-centre" });
  mocks.getProductForAdmin.mockResolvedValue({ id: PRODUCT, slug: "p" });
  mocks.getCategoryForAdmin.mockResolvedValue({ id: "cat-1", slug: "fresh-produce" });
  mocks.setPrimaryProductImage.mockResolvedValue({
    ok: true,
    id: PRODUCT,
    imageId: "img-1",
    replacedHubRef: null,
  });
  mocks.addProductImage.mockResolvedValue({
    ok: true,
    id: PRODUCT,
    imageId: "img-2",
    replacedHubRef: null,
  });
  mocks.createCategoryAssetForVendor.mockResolvedValue({ id: "ca-1" });
  mocks.storage.putObject.mockResolvedValue(undefined);
  mocks.listProductsForAdmin.mockResolvedValue({ items: [], nextCursor: null });
  mocks.getVendorAiMeter.mockReturnValue({
    check: vi.fn().mockResolvedValue({ allowed: true }),
    recordImage: vi.fn().mockResolvedValue(undefined),
  });
  mocks.getImageGenerationService.mockReturnValue({
    generateImage: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
  });
  asRole("ADMIN");
});

describe("R5 — unconfigured hub", () => {
  it("returns not_configured without calling fetch", async () => {
    mocks.getImageHubEnv.mockReturnValue({ configured: false });
    const fetchMock = hub({});
    const result = await searchImageLibrary({});
    expect(result).toMatchObject({ ok: false, code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the vendor slug as tenant and the user id as actor", async () => {
    const fetchMock = hub({ "GET /v1/assets": () => json(200, { items: [], nextCursor: null }) });
    await searchImageLibrary({ q: "x" });
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["x-image-hub-tenant"]).toBe("aheed-food-centre");
    expect(headers["x-image-hub-actor"]).toBe("user-1");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("limit=24");
  });

  it("passes sort through to the hub (#1678 R2)", async () => {
    const fetchMock = hub({ "GET /v1/assets": () => json(200, { items: [], nextCursor: null }) });
    await searchImageLibrary({ q: "rice", status: "APPROVED", sort: "relevance" });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("sort=relevance");
    await searchImageLibrary({ q: "rice" });
    expect(String(fetchMock.mock.calls[1]![0])).not.toContain("sort=");
  });
});

describe("R12 — review is store-admin only", () => {
  it("refuses approve and reject for staff without calling the hub", async () => {
    asRole("STAFF");
    const fetchMock = hub({});
    expect(await approveImageLibraryAsset(ASSET_ID)).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(await rejectImageLibraryAsset(ASSET_ID, "Blurry")).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a reject with an empty reason", async () => {
    const fetchMock = hub({});
    expect(await rejectImageLibraryAsset(ASSET_ID, "   ")).toMatchObject({
      ok: false,
      code: "validation",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("R11 — upload validation", () => {
  const base = {
    file: new Blob([new Uint8Array(10)], { type: "image/webp" }),
    fileName: "x.webp",
    title: "Title",
    licence: "OWNER_SUPPLIED",
    rightsConfirmed: true,
  };

  it.each([
    ["a non-WebP file", { file: new Blob(["x"], { type: "image/png" }) }],
    [
      "a file over 2 MB",
      { file: new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/webp" }) },
    ],
    ["a licence the store may not claim", { licence: "CC_BY" }],
    ["no rights confirmation", { rightsConfirmed: false }],
    ["an empty title", { title: "  " }],
  ])("refuses %s with 400 and no hub call", async (_label, override) => {
    const fetchMock = hub({});
    const result = await uploadToImageLibrary({ ...base, ...override });
    expect(result).toMatchObject({ ok: false, code: "validation", status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a hub duplicate (409) to the already-in-the-library message", async () => {
    hub({
      "POST /v1/assets": () =>
        json(409, { error: { code: "duplicate", message: "Exact duplicate" } }),
    });
    const result = await uploadToImageLibrary(base);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(!result.ok && result.message).toContain("already in the library");
  });
});

describe("R13 — assign preconditions", () => {
  it.each(["PENDING_REVIEW", "REJECTED"])(
    "refuses a %s asset with no storage write",
    async (status) => {
      hub({ "GET /v1/assets/": () => json(200, asset({ status })) });
      const result = await assignLibraryAssetToProduct({
        assetId: ASSET_ID,
        productId: PRODUCT,
        mode: "primary",
      });
      expect(result).toMatchObject({ ok: false, code: "not_approved" });
      expect(mocks.storage.putObject).not.toHaveBeenCalled();
    },
  );

  it("refuses another vendor's product", async () => {
    mocks.getProductForAdmin.mockResolvedValue(null);
    const fetchMock = hub({});
    const result = await assignLibraryAssetToProduct({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "primary",
    });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses category assignment for staff", async () => {
    asRole("STAFF");
    const fetchMock = hub({});
    const result = await assignLibraryAssetToCategory({ assetId: ASSET_ID, categoryId: "cat-1" });
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("R14/R16/R17 — server copy", () => {
  function copyRoutes(usage: () => Response) {
    return hub({
      "GET /v1/assets/22222222-2222-4222-8222-222222222222/content": () =>
        new Response(new Uint8Array(1000), {
          status: 200,
          headers: { "content-type": "image/webp" },
        }),
      "POST /v1/assets/22222222-2222-4222-8222-222222222222/usages": usage,
      "GET /v1/assets/": () => json(200, asset()),
    });
  }

  it("copies under a store product key, then writes the row, then records the usage", async () => {
    const order: string[] = [];
    mocks.storage.putObject.mockImplementation(async () => void order.push("put"));
    mocks.setPrimaryProductImage.mockImplementation(async () => {
      order.push("row");
      return { ok: true, id: PRODUCT, imageId: "img-1", replacedHubRef: null };
    });
    copyRoutes(() =>
      json(201, { id: "usage-1", kind: "PRODUCT", externalId: PRODUCT, createdAt: "x" }),
    );

    const result = await assignLibraryAssetToProduct({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "primary",
    });

    expect(result).toMatchObject({ ok: true, value: { status: "assigned", warning: null } });
    expect(order).toEqual(["put", "row"]);
    const key = mocks.storage.putObject.mock.calls[0]![0] as string;
    expect(key).toMatch(new RegExp(`^products/${PRODUCT}/[0-9a-f-]{36}\\.webp$`));
    expect(key).not.toContain("hub-key");
    // R17: a hub UPLOAD becomes UNKNOWN, with the hub asset id recorded.
    expect(mocks.setPrimaryProductImage.mock.calls[0]![4]).toEqual({
      source: "UNKNOWN",
      hubAssetId: ASSET_ID,
    });
    expect(mocks.setProductImageHubUsage).toHaveBeenCalledWith(VENDOR, "img-1", "usage-1");
  });

  it("writes no row when putObject fails", async () => {
    mocks.storage.putObject.mockRejectedValue(new Error("storage down"));
    copyRoutes(() => json(201, {}));
    await expect(
      assignLibraryAssetToProduct({ assetId: ASSET_ID, productId: PRODUCT, mode: "primary" }),
    ).rejects.toThrow("storage down");
    expect(mocks.setPrimaryProductImage).not.toHaveBeenCalled();
  });

  it("keeps the assignment and warns when the usage cannot be recorded", async () => {
    copyRoutes(() => json(500, { error: { code: "internal", message: "boom" } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await assignLibraryAssetToProduct({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "additional",
    });
    expect(result).toMatchObject({ ok: true, value: { status: "assigned" } });
    expect(result.ok && result.value.status === "assigned" && result.value.warning).toBeTruthy();
    expect(mocks.addProductImage).toHaveBeenCalled();
    expect(mocks.setProductImageHubUsage).not.toHaveBeenCalled();
  });

  it("releases the old usage when a hub primary is replaced", async () => {
    mocks.setPrimaryProductImage.mockResolvedValue({
      ok: true,
      id: PRODUCT,
      imageId: "img-1",
      replacedHubRef: { hubAssetId: "old-asset", hubUsageId: "old-usage" },
    });
    const fetchMock = hub({
      "GET /v1/assets/22222222-2222-4222-8222-222222222222/content": () =>
        new Response(new Uint8Array(1000), {
          status: 200,
          headers: { "content-type": "image/webp" },
        }),
      "POST /v1/assets/22222222-2222-4222-8222-222222222222/usages": () =>
        json(201, { id: "usage-1", kind: "PRODUCT", externalId: PRODUCT, createdAt: "x" }),
      "DELETE /v1/assets/old-asset/usages/old-usage": () => new Response(null, { status: 204 }),
      "GET /v1/assets/": () => json(200, asset()),
    });
    await assignLibraryAssetToProduct({ assetId: ASSET_ID, productId: PRODUCT, mode: "primary" });
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) => i?.method === "DELETE" && String(u).endsWith("/old-asset/usages/old-usage"),
      ),
    ).toBe(true);
  });

  it("copies a category image under a categories/<vendor>/ key and selects it", async () => {
    copyRoutes(() =>
      json(201, { id: "usage-2", kind: "CATEGORY", externalId: "cat-1", createdAt: "x" }),
    );
    const result = await assignLibraryAssetToCategory({ assetId: ASSET_ID, categoryId: "cat-1" });
    expect(result).toMatchObject({ ok: true, value: { status: "assigned" } });
    const key = mocks.storage.putObject.mock.calls[0]![0] as string;
    expect(key).toMatch(new RegExp(`^categories/${VENDOR}/fresh-produce-[0-9a-f]{8}\\.webp$`));
    expect(mocks.createCategoryAssetForVendor).toHaveBeenCalledWith(VENDOR, {
      categoryId: "cat-1",
      storageKey: key,
      style: "photo",
      isSelected: true,
      hubAssetId: ASSET_ID,
    });
    expect(mocks.setCategoryAssetHubUsageForVendor).toHaveBeenCalledWith(VENDOR, "ca-1", "usage-2");
  });
});

describe("R15 — browser conversion", () => {
  it("answers needs_conversion for a JPEG asset without writing anything", async () => {
    hub({ "GET /v1/assets/": () => json(200, asset({ contentType: "image/jpeg" })) });
    const result = await assignLibraryAssetToProduct({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "primary",
    });
    expect(result).toEqual({ ok: true, value: { status: "needs_conversion" } });
    expect(mocks.storage.putObject).not.toHaveBeenCalled();
    expect(mocks.setPrimaryProductImage).not.toHaveBeenCalled();
  });

  it("answers needs_conversion for a WebP over the cap", async () => {
    hub({ "GET /v1/assets/": () => json(200, asset({ byteSize: 3 * 1024 * 1024 })) });
    const result = await assignLibraryAssetToProduct({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "primary",
    });
    expect(result).toEqual({ ok: true, value: { status: "needs_conversion" } });
  });

  const key = `products/${PRODUCT}/33333333-3333-4333-8333-333333333333.webp`;

  it.each([
    ["a missing object", null],
    ["a non-WebP object", { contentType: "image/png", contentLength: 10 }],
    ["an over-cap object", { contentType: "image/webp", contentLength: 3 * 1024 * 1024 }],
  ])("finalize refuses %s with no row", async (_label, head) => {
    mocks.storage.headObject.mockResolvedValue(head);
    hub({ "GET /v1/assets/": () => json(200, asset({ contentType: "image/jpeg" })) });
    const result = await finalizeProductAssign({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "primary",
      storageKey: key,
    });
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(mocks.setPrimaryProductImage).not.toHaveBeenCalled();
  });

  it("finalize refuses a key that is not this product's", async () => {
    const result = await finalizeProductAssign({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "primary",
      storageKey: "products/other/33333333-3333-4333-8333-333333333333.webp",
    });
    expect(result).toMatchObject({ ok: false, code: "validation" });
  });

  it("finalize writes the row once the converted object has landed", async () => {
    mocks.storage.headObject.mockResolvedValue({ contentType: "image/webp", contentLength: 500 });
    hub({
      "POST /v1/assets/22222222-2222-4222-8222-222222222222/usages": () =>
        json(201, { id: "usage-3", kind: "PRODUCT", externalId: PRODUCT, createdAt: "x" }),
      "GET /v1/assets/": () => json(200, asset({ contentType: "image/jpeg" })),
    });
    const result = await finalizeProductAssign({
      assetId: ASSET_ID,
      productId: PRODUCT,
      mode: "primary",
      storageKey: key,
    });
    expect(result).toMatchObject({ ok: true, value: { status: "assigned" } });
    expect(mocks.setPrimaryProductImage.mock.calls[0]![2]).toBe(key);
  });

  it("category finalize refuses a key for another category", async () => {
    const result = await finalizeCategoryAssign({
      assetId: ASSET_ID,
      categoryId: "cat-1",
      storageKey: `categories/${VENDOR}/other-slug-abcdef12.webp`,
    });
    expect(result).toMatchObject({ ok: false, code: "validation" });
  });

  describe("requestCategoryImageUploadTicket", () => {
    it("refuses staff", async () => {
      asRole("STAFF");
      expect(await requestCategoryImageUploadTicket("cat-1", 100)).toMatchObject({
        ok: false,
        code: "forbidden",
      });
    });

    it("refuses another vendor's category", async () => {
      mocks.getCategoryForAdmin.mockResolvedValue(null);
      expect(await requestCategoryImageUploadTicket("cat-1", 100)).toMatchObject({
        ok: false,
        code: "not_found",
      });
    });

    it("refuses an over-cap size", async () => {
      expect(await requestCategoryImageUploadTicket("cat-1", 3 * 1024 * 1024)).toMatchObject({
        ok: false,
        code: "validation",
      });
    });

    it("signs a categories/<vendorId>/ key", async () => {
      mocks.storage.presignPut.mockResolvedValue("https://bucket.test/signed");
      const result = await requestCategoryImageUploadTicket("cat-1", 100);
      expect(result.ok).toBe(true);
      expect(result.ok && result.value.key).toMatch(
        new RegExp(`^categories/${VENDOR}/fresh-produce-[0-9a-f]{8}\\.webp$`),
      );
    });
  });
});

describe("R18 — releaseHubUsage", () => {
  it("deletes the usage", async () => {
    const fetchMock = hub({
      "DELETE /v1/assets/a1/usages/u1": () => new Response(null, { status: 204 }),
    });
    await releaseHubUsage({ hubAssetId: "a1", hubUsageId: "u1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws and logs when the hub fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    hub({
      "DELETE /v1/assets/a1/usages/u1": () =>
        json(500, { error: { code: "internal", message: "x" } }),
    });
    await expect(releaseHubUsage({ hubAssetId: "a1", hubUsageId: "u1" })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      "[image-hub] usage not removed",
      expect.objectContaining({ assetId: "a1", usageId: "u1" }),
    );
  });

  it("does nothing for a row with no usage id", async () => {
    const fetchMock = hub({});
    await releaseHubUsage({ hubAssetId: "a1", hubUsageId: null });
    await releaseHubUsage(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("image discovery facade", () => {
  it("enforces STAFF role for searchDiscoveredImagesForStaff", async () => {
    mocks.requireVendorRole.mockResolvedValue({ ok: false, reason: "forbidden", status: 403 });
    const res = await searchDiscoveredImagesForStaff({ query: "mango" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("forbidden");
    }
  });

  it("imports a discovered image and calls importAsset", async () => {
    mocks.requireVendorRole.mockResolvedValue({
      ok: true,
      vendorId: VENDOR,
      user: { id: "user-1" },
      via: "STAFF",
    });
    mocks.getImageHubEnv.mockReturnValue({
      configured: true,
      url: "https://hub.test",
      apiKey: "mih_key",
    });
    mocks.fetchVendorProfile.mockResolvedValue({ slug: "aheed" });

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://example.com/mango.jpg") {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (url.includes("/v1/assets/import")) {
        return new Response(
          JSON.stringify({
            ok: true,
            asset: asset({ title: "Discovered Mango", status: "PENDING_REVIEW" }),
            duplicate: false,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = fetchMock;

    try {
      const res = await importDiscoveredImageToHub({
        id: "openverse-123",
        provider: "OPENVERSE",
        title: "Discovered Mango",
        thumbnailUrl: "https://example.com/mango-thumb.jpg",
        originalUrl: "https://example.com/mango.jpg",
        sourceSite: "Openverse",
        licence: "CC_BY",
        attribution: "Photographer via Openverse",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.title).toBe("Discovered Mango");
      }
      expect(fetchMock).toHaveBeenCalledWith("https://example.com/mango.jpg", expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith(
        "https://hub.test/v1/assets/import",
        expect.any(Object),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe("listProductsForAiPrompt", () => {
    it("returns both active and inactive products matching query", async () => {
      mocks.listProductsForAdmin.mockResolvedValue({
        items: [
          {
            id: "prod-1",
            name: "Halal Lamb Chops",
            slug: "halal-lamb-chops",
            isActive: true,
            categoryName: "Meat & Poultry",
          },
          {
            id: "prod-2",
            name: "Fresh Whole Chicken",
            slug: "fresh-whole-chicken",
            isActive: false,
            categoryName: "Meat & Poultry",
          },
        ],
        nextCursor: null,
      });

      const products = await listProductsForAiPrompt(VENDOR, "lamb");
      expect(products).toEqual([
        {
          id: "prod-1",
          name: "Halal Lamb Chops",
          slug: "halal-lamb-chops",
          isActive: true,
          categoryName: "Meat & Poultry",
        },
        {
          id: "prod-2",
          name: "Fresh Whole Chicken",
          slug: "fresh-whole-chicken",
          isActive: false,
          categoryName: "Meat & Poultry",
        },
      ]);
      expect(mocks.listProductsForAdmin).toHaveBeenCalledWith(VENDOR, {
        take: 15,
        search: "lamb",
      });
    });
  });

  describe("generateAiImageForLibrary", () => {
    it("refuses callers without staff or admin role", async () => {
      mocks.requireVendorRole.mockResolvedValue({
        ok: false,
        status: 401,
        reason: "unauthenticated",
      });

      const res = await generateAiImageForLibrary({ prompt: "Lamb chops" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("unauthenticated");
      }
    });

    it("refuses when prompt is empty or whitespace", async () => {
      asRole("STAFF");
      const res = await generateAiImageForLibrary({ prompt: "   " });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("validation");
      }
    });

    it("refuses when AI budget is exhausted", async () => {
      asRole("STAFF");
      mocks.getVendorAiMeter.mockReturnValue({
        check: vi.fn().mockResolvedValue({
          allowed: false,
          reason: "vendor_budget_exhausted",
          usedNeurons: 10000,
          budgetNeurons: 10000,
        }),
        recordImage: vi.fn(),
      });

      const res = await generateAiImageForLibrary({ prompt: "Fresh Lamb Chops" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("budget_exceeded");
        expect(res.status).toBe(429);
      }
    });

    it("generates image, records usage, and imports to Hub as PENDING_REVIEW", async () => {
      asRole("STAFF");
      const recordImage = vi.fn().mockResolvedValue(undefined);
      mocks.getVendorAiMeter.mockReturnValue({
        check: vi.fn().mockResolvedValue({ allowed: true }),
        recordImage,
      });

      const generateImage = vi.fn().mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer);
      mocks.getImageGenerationService.mockReturnValue({ generateImage });

      const originalFetch = globalThis.fetch;
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/v1/assets/import")) {
          return new Response(
            JSON.stringify({
              ok: true,
              asset: asset({
                title: "Fresh Lamb Chops",
                source: "AI_GENERATED",
                licence: "AI_GENERATED",
                status: "PENDING_REVIEW",
              }),
              duplicate: false,
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      });
      globalThis.fetch = fetchMock;

      try {
        const res = await generateAiImageForLibrary({
          prompt:
            "Studio product photograph of Fresh Lamb Chops, Meat, clean plain white background, 4k",
          title: "Fresh Lamb Chops",
        });

        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.title).toBe("Fresh Lamb Chops");
          expect(res.value.source).toBe("AI_GENERATED");
          expect(res.value.status).toBe("PENDING_REVIEW");
        }
        expect(generateImage).toHaveBeenCalled();
        expect(recordImage).toHaveBeenCalledWith({
          model: "@cf/black-forest-labs/flux-1-schnell",
        });
        expect(fetchMock).toHaveBeenCalledWith(
          "https://hub.test/v1/assets/import",
          expect.any(Object),
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
