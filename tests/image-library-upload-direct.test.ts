import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/admin/image-library/upload-direct/route";
import { IMAGE_CONTENT_TYPE, MAX_IMAGE_BYTES } from "@/lib/product-image";

const mockRequireVendorRole = vi.fn();
const mockGetProductForAdmin = vi.fn();
const mockGetCategoryForAdmin = vi.fn();
const mockPutObject = vi.fn();

vi.mock("@/lib/auth-rbac", () => ({
  requireVendorRole: (...args: unknown[]) => mockRequireVendorRole(...args),
}));

vi.mock("@/lib/products-service", () => ({
  getProductForAdmin: (...args: unknown[]) => mockGetProductForAdmin(...args),
}));

vi.mock("@/lib/categories-service", () => ({
  getCategoryForAdmin: (...args: unknown[]) => mockGetCategoryForAdmin(...args),
}));

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    putObject: mockPutObject,
  }),
}));

describe("POST /api/admin/image-library/upload-direct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses unauthorized requests", async () => {
    mockRequireVendorRole.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
      status: 401,
    });

    const req = new Request("http://localhost/api/admin/image-library/upload-direct", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("refuses mismatched product key", async () => {
    mockRequireVendorRole.mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "staff@test.com", name: "Staff" },
      vendorId: "v-1",
      via: "STAFF",
    });
    mockGetProductForAdmin.mockResolvedValue({ id: "prod-1", vendorId: "v-1" });

    const form = new FormData();
    form.set("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }), "image.webp");
    form.set("key", "products/other-prod/00000000-0000-0000-0000-000000000000.webp");
    form.set("targetKind", "product");
    form.set("targetId", "prod-1");

    const req = new Request("http://localhost/api/admin/image-library/upload-direct", {
      method: "POST",
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("That upload key does not belong to this product");
  });

  it("uploads successfully for a valid product key", async () => {
    mockRequireVendorRole.mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "staff@test.com", name: "Staff" },
      vendorId: "v-1",
      via: "STAFF",
    });
    mockGetProductForAdmin.mockResolvedValue({ id: "prod-1", vendorId: "v-1" });
    mockPutObject.mockResolvedValue(undefined);

    const key = "products/prod-1/12345678-1234-1234-1234-123456789abc.webp";
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }), "image.webp");
    form.set("key", key);
    form.set("targetKind", "product");
    form.set("targetId", "prod-1");

    const req = new Request("http://localhost/api/admin/image-library/upload-direct", {
      method: "POST",
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPutObject).toHaveBeenCalledWith(key, expect.any(ArrayBuffer), IMAGE_CONTENT_TYPE);
  });
});
