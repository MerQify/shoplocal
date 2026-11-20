import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #1671 R18 — removing a product image that came from the Image Hub also removes its hub usage,
 * best effort. The real `removeProductImage` action and the real `lib/image-hub-service` run here;
 * only their dependencies are mocked, and the hub is a stubbed `fetch`.
 *
 * Also guards the new `"use server"` module's export shape: such a file may export only async
 * functions, and anything else fails at RUNTIME with every build-time check green (CLAUDE.md).
 */

const mocks = vi.hoisted(() => ({
  removeProductImage: vi.fn(),
  getProductForAdmin: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPrisma: () => ({}), getPrismaWs: () => ({}) }));
vi.mock("@/lib/auth-rbac", () => ({
  requireVendorRole: async () => ({
    ok: true,
    user: { id: "user-1", email: "u@test", name: "U" },
    vendorId: "vendor-1",
    via: "STAFF",
  }),
}));
vi.mock("@/lib/config", () => ({
  getImageHubEnv: () => ({ configured: true, url: "https://hub.test", apiKey: "mih_stg_KEY" }),
}));
vi.mock("@/lib/vendor-service", () => ({
  fetchVendorProfile: async () => ({ slug: "aheed-food-centre" }),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ deleteObject: mocks.deleteObject, publicUrl: (k: string) => k }),
}));
vi.mock("@/lib/products-service", () => ({
  removeProductImage: mocks.removeProductImage,
  getProductForAdmin: mocks.getProductForAdmin,
}));
vi.mock("@/lib/categories-service", () => ({}));
vi.mock("@/lib/category-assets-service", () => ({}));

import { removeProductImage } from "@/features/admin/product-image";
import * as libraryActions from "@/features/admin/image-library";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.getProductForAdmin.mockResolvedValue({ id: "p1", slug: "p" });
  mocks.deleteObject.mockResolvedValue(undefined);
  mocks.removeProductImage.mockResolvedValue({
    ok: true,
    storageKey: "products/p1/x.webp",
    hubRef: { hubAssetId: "asset-1", hubUsageId: "usage-1" },
  });
});

describe("removeProductImage releases the hub usage (#1671 R18)", () => {
  it("deletes the usage in the hub", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await removeProductImage("p1", "img-1");

    expect(result).toEqual({ ok: true, value: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hub.test/v1/assets/asset-1/usages/usage-1");
    expect(init.method).toBe("DELETE");
  });

  it("still succeeds, and logs, when the hub fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await removeProductImage("p1", "img-1");

    expect(result).toEqual({ ok: true, value: null });
    expect(mocks.deleteObject).toHaveBeenCalledWith("products/p1/x.webp");
    expect(log).toHaveBeenCalledWith(
      "[image-hub] usage not removed",
      expect.objectContaining({ assetId: "asset-1", usageId: "usage-1" }),
    );
  });

  it("makes no hub call for an image that did not come from the hub", async () => {
    mocks.removeProductImage.mockResolvedValue({
      ok: true,
      storageKey: "products/p1/x.webp",
      hubRef: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await removeProductImage("p1", "img-1");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('features/admin/image-library.ts is a valid "use server" module', () => {
  it("exports only async functions", () => {
    for (const [name, value] of Object.entries(libraryActions)) {
      expect(typeof value, name).toBe("function");
      expect((value as () => unknown).constructor.name, name).toBe("AsyncFunction");
    }
  });
});
