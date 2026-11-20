import { NextResponse } from "next/server";
import { uploadToImageLibrary } from "@/lib/image-hub-service";
import { libraryErrorStatus } from "@/lib/image-hub/http";

/**
 * #1671 R11 — a staff upload into the Image Hub library.
 *
 * A route handler rather than a server action because a server action's request body is capped at
 * 1 MB, under the store's 2 MB image cap. The browser has already converted the file to WebP; the
 * service re-checks type, size, licence, rights confirmation and title before anything reaches the
 * hub.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: { code: "validation", message: "Send the image as a form upload." } },
      { status: 400 },
    );
  }
  const file = form.get("file");
  const result = await uploadToImageLibrary({
    file: file instanceof Blob ? file : new Blob([]),
    fileName: file instanceof File ? file.name : "image.webp",
    title: String(form.get("title") ?? ""),
    alt: String(form.get("alt") ?? ""),
    licence: String(form.get("licence") ?? ""),
    rightsConfirmed: form.get("rightsConfirmed") === "true",
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: libraryErrorStatus(result) },
    );
  }
  return NextResponse.json(result.value, { status: 201 });
}
