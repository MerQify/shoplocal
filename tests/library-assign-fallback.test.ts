import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignLibraryAsset } from "@/components/staff/library-assign";

const mockAssignToProductAction = vi.fn();
const mockFinalizeProductAssignAction = vi.fn();
const mockRequestImageUpload = vi.fn();
const mockConvertToWebp = vi.fn();

vi.mock("@/features/admin/image-library", () => ({
  assignToProductAction: (...args: unknown[]) => mockAssignToProductAction(...args),
  finalizeProductAssignAction: (...args: unknown[]) => mockFinalizeProductAssignAction(...args),
  assignToCategoryAction: vi.fn(),
  finalizeCategoryAssignAction: vi.fn(),
  requestCategoryImageUpload: vi.fn(),
}));

vi.mock("@/features/admin/product-image", () => ({
  requestImageUpload: (...args: unknown[]) => mockRequestImageUpload(...args),
}));

vi.mock("@/lib/webp-convert", () => ({
  convertToWebp: (...args: unknown[]) => mockConvertToWebp(...args),
}));

describe("assignLibraryAsset with storage fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to /api/admin/image-library/upload-direct when direct PUT fails", async () => {
    mockAssignToProductAction.mockResolvedValue({
      ok: true,
      value: { status: "needs_conversion" },
    });

    // Mock fetch for library content route, direct R2 PUT, and fallback route
    const originalFetch = global.fetch;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/admin/image-library/ast-1/content")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (urlStr.includes("r2.cloudflarestorage.com")) {
        // Simulate CORS preflight or network rejection
        throw new TypeError("Failed to fetch (CORS error)");
      }
      if (urlStr.includes("/api/admin/image-library/upload-direct")) {
        return new Response(JSON.stringify({ ok: true, key: "products/p1/img.webp" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 404 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    mockConvertToWebp.mockResolvedValue(
      new Blob([new Uint8Array([4, 5, 6])], { type: "image/webp" }),
    );
    mockRequestImageUpload.mockResolvedValue({
      ok: true,
      value: {
        url: "https://acc.r2.cloudflarestorage.com/afc-images-production/products/p1/img.webp",
        key: "products/p1/img.webp",
      },
    });
    mockFinalizeProductAssignAction.mockResolvedValue({
      ok: true,
      value: {
        status: "assigned",
        url: "https://images.aheedfoodcentre.co.uk/products/p1/img.webp",
        warning: null,
      },
    });

    try {
      const result = await assignLibraryAsset(
        "ast-1",
        { kind: "product", id: "p1", name: "Test Product" },
        "primary",
      );

      expect(result.ok).toBe(true);
      // Verify direct PUT was attempted and failed
      expect(fetchMock).toHaveBeenCalledWith(
        "https://acc.r2.cloudflarestorage.com/afc-images-production/products/p1/img.webp",
        expect.anything(),
      );
      // Verify fallback was called
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/image-library/upload-direct",
        expect.objectContaining({ method: "POST" }),
      );
      // Verify finalize was called
      expect(mockFinalizeProductAssignAction).toHaveBeenCalledWith({
        assetId: "ast-1",
        productId: "p1",
        mode: "primary",
        storageKey: "products/p1/img.webp",
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
