import { describe, it, expect, vi, beforeEach } from "vitest";
import { STORAGE_CACHE_CONTROL_IMMUTABLE, getStorage } from "@/lib/storage";

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
const signMock = vi.fn(async (url: string, opts?: any) => ({
  url: `${url}&X-Amz-Signature=mock-sig`,
  method: opts?.method,
  headers: opts?.headers,
}));

vi.mock("aws4fetch", () => {
  class MockAwsClient {
    fetch = fetchMock;
    sign = signMock;
  }
  return {
    AwsClient: MockAwsClient,
  };
});

describe("#1630 R1/R2 — storage cache headers", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    signMock.mockClear();
  });

  it("exports immutable cache control constant", () => {
    expect(STORAGE_CACHE_CONTROL_IMMUTABLE).toBe("public, max-age=31536000, immutable");
  });

  it("R1 — putObject passes immutable cache-control header", async () => {
    const storage = getStorage();
    await storage.putObject("test/key.webp", new Uint8Array([1, 2, 3]), "image/webp");

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, init] = call;
    expect(init.headers).toEqual({
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    });
  });

  it("R2 — presignPut signs immutable cache-control header", async () => {
    const storage = getStorage();
    const signedUrl = await storage.presignPut("test/key.webp", "image/webp", 300);

    expect(signMock).toHaveBeenCalledOnce();
    const call = signMock.mock.calls[0] as unknown as [string, any];
    const [, init] = call;
    expect(init.headers).toEqual({
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    });
    expect(init.aws).toEqual({
      signQuery: true,
      allHeaders: true,
    });
    expect(signedUrl).toContain("X-Amz-Signature=mock-sig");
  });
});
