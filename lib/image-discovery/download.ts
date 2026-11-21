import { MAX_IMAGE_BYTES } from "../product-image";
import type { DiscoveredImage, DiscoveryProvider } from "./types";

const hosts: Record<DiscoveryProvider, readonly string[]> = {
  OPENVERSE: [
    "live.staticflickr.com",
    "farm1.staticflickr.com",
    "upload.wikimedia.org",
    "images.pexels.com",
    "images.unsplash.com",
  ],
  WIKIMEDIA: ["upload.wikimedia.org"],
  OPEN_FOOD_FACTS: ["images.openfoodfacts.org", "static.openfoodfacts.org"],
};

export async function downloadDiscoveredImage(
  image: DiscoveredImage,
  fetchImage = fetch,
  signal = AbortSignal.timeout(10_000),
): Promise<{ file: Blob; extension: string }> {
  const url = new URL(image.downloadUrl ?? image.thumbnailUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !hosts[image.provider]?.includes(url.hostname)
  ) {
    throw new Error("This image host is not supported for imports.");
  }

  const response = await fetchImage(url, {
    redirect: "manual",
    signal,
    headers: {
      "User-Agent":
        "AheedFoodCentre/1.0 (https://aheedfoodcentre.co.uk; info@aheedfoodcentre.co.uk)",
      Accept: "image/jpeg,image/png,image/webp",
    },
  });
  const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("The image source did not return a downloadable image.");
  }
  const extension =
    type === "image/jpeg"
      ? "jpg"
      : type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : null;
  if (!extension || Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    await response.body.cancel().catch(() => undefined);
    throw new Error("The source image has an unsupported format or exceeds the size limit.");
  }

  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  const header = new Uint8Array(12);
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > MAX_IMAGE_BYTES) {
        throw new Error("The source image exceeds the size limit.");
      }
      if (size < header.length) header.set(value.subarray(0, header.length - size), size);
      size += value.byteLength;
      chunks.push(new Uint8Array(value).buffer);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  const matches = (offset: number, signature: number[]) =>
    size >= offset + signature.length &&
    signature.every((byte, index) => header[offset + index] === byte);
  const valid =
    extension === "jpg"
      ? matches(0, [255, 216, 255])
      : extension === "png"
        ? matches(0, [137, 80, 78, 71, 13, 10, 26, 10])
        : matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80]);
  if (!valid) throw new Error("The source image does not match its declared format.");
  return { file: new Blob(chunks, { type }), extension };
}
