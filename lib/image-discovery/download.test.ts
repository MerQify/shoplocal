import { describe, expect, it, vi } from "vitest";
import { MAX_IMAGE_BYTES } from "../product-image";
import { downloadDiscoveredImage } from "./download";
import type { DiscoveredImage } from "./types";

const image: DiscoveredImage = {
  id: "commons-1",
  provider: "WIKIMEDIA",
  title: "Apple",
  thumbnailUrl: "https://upload.wikimedia.org/apple.jpg",
  originalUrl: "https://commons.wikimedia.org/wiki/File:Apple.jpg",
  sourceSite: "Wikimedia Commons",
  licence: "CC_BY",
  attribution: "Example photographer",
};

describe("downloadDiscoveredImage", () => {
  it.each([
    "http://upload.wikimedia.org/apple.jpg",
    "https://upload.wikimedia.org.example.invalid/apple.jpg",
    "https://upload.wikimedia.org:8443/apple.jpg",
    "https://user@upload.wikimedia.org/apple.jpg",
  ])("rejects %s before fetching", async (downloadUrl) => {
    const fetchImage = vi.fn<typeof fetch>();
    await expect(downloadDiscoveredImage({ ...image, downloadUrl }, fetchImage)).rejects.toThrow(
      "host is not supported",
    );
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("disables redirects and passes the abort signal to fetch", async () => {
    const signal = AbortSignal.timeout(100);
    const fetchImage = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.redirect("https://example.invalid"));
    await expect(downloadDiscoveredImage(image, fetchImage, signal)).rejects.toThrow();
    expect(fetchImage).toHaveBeenCalledOnce();
    expect(fetchImage).toHaveBeenCalledWith(
      new URL(image.thumbnailUrl),
      expect.objectContaining({
        redirect: "error",
        signal,
      }),
    );
  });

  it("cancels a stream that exceeds the byte cap without a content-length header", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES + 1));
      },
      cancel,
    });
    const fetchImage = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(body, {
        headers: { "content-type": "image/jpeg" },
      }),
    );
    await expect(downloadDiscoveredImage(image, fetchImage)).rejects.toThrow("size limit");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("propagates an aborted download", async () => {
    const controller = new AbortController();
    const fetchImage = vi.fn<typeof fetch>(
      async (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          });
        }),
    );
    const download = downloadDiscoveredImage(image, fetchImage, controller.signal);
    controller.abort();
    await expect(download).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects bytes that do not match the declared format", async () => {
    const fetchImage = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not an image", {
        headers: { "content-type": "image/jpeg" },
      }),
    );
    await expect(downloadDiscoveredImage(image, fetchImage)).rejects.toThrow("declared format");
  });
});
