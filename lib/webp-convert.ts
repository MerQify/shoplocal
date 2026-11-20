import {
  IMAGE_CONTENT_TYPE,
  IMAGE_QUALITY,
  MAX_IMAGE_EDGE_PX,
  fitWithinEdge,
} from "@/lib/product-image";

/**
 * Decode, downscale and re-encode an image to WebP, in the browser (P6b2 #167; shared since #1671).
 *
 * THE one place the store converts images. `ProductImageUploader` uses it for staff uploads; the
 * image library uses it for library uploads and for assigning a hub image that is not already a
 * WebP within the cap. One implementation means storage only ever receives what this produces, so
 * the `.webp` key convention holds literally rather than by hope.
 *
 * `imageOrientation: "from-image"` applies the EXIF rotation, which is the difference between a
 * phone photo appearing upright and appearing on its side — a canvas drawn from a raw bitmap
 * ignores EXIF entirely.
 *
 * Browser-only at call time (`createImageBitmap`, `document`), and importing only the pure
 * constants in `lib/product-image` — never `lib/storage` or `lib/config`, which carry the signer
 * and the secret-reading loader and must not reach a client bundle.
 */
export async function convertToWebp(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithinEdge(bitmap.width, bitmap.height, MAX_IMAGE_EDGE_PX);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't process images.");
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, IMAGE_CONTENT_TYPE, IMAGE_QUALITY),
    );
    if (!blob) throw new Error("This browser can't produce WebP images.");
    return blob;
  } finally {
    bitmap.close();
  }
}
