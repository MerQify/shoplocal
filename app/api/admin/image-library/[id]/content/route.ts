import { NextResponse } from "next/server";
import { getImageLibraryContent } from "@/lib/image-hub-service";
import { libraryErrorStatus } from "@/lib/image-hub/http";

export const dynamic = "force-dynamic";

/**
 * #1671 R9 — streams a library image's bytes from the Image Hub, same-origin.
 *
 * Used for thumbnails and previews, and by the browser-conversion assign path, which needs the
 * bytes on this origin to draw them onto a canvas. Same-origin is the point: a presigned hub URL
 * would need the hub bucket's host in the CSP's `img-src`, and canvas reads would need CORS on a
 * bucket that deliberately has none.
 *
 * `private`: the bytes are tenant-scoped and staff-only, so no shared cache may hold them.
 */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const result = await getImageLibraryContent(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: libraryErrorStatus(result) },
    );
  }
  const upstream = result.value;
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
    },
  });
}
