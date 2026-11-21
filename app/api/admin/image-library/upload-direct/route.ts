import { NextResponse } from "next/server";
import { requireVendorRole } from "@/lib/auth-rbac";
import { getStorage } from "@/lib/storage";
import { IMAGE_CONTENT_TYPE, MAX_IMAGE_BYTES, isProductImageKey } from "@/lib/product-image";
import { getProductForAdmin } from "@/lib/products-service";
import { getCategoryForAdmin } from "@/lib/categories-service";

export const dynamic = "force-dynamic";

/**
 * Same-origin fallback for browser-converted image uploads (e.g. from library assign or product edit).
 *
 * Used when direct browser presigned PUT to object storage is blocked by CORS or storage policies.
 * The client converts to WebP, requests a ticket, and attempts direct PUT. If that is blocked,
 * it posts here so the Worker writes via server-to-server `putObject`.
 */
export async function POST(request: Request) {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.reason, message: "Unauthorized" } },
      { status: auth.status },
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: { code: "validation", message: "Send the image as a form upload." } },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const key = String(form.get("key") ?? "");
  const targetKind = String(form.get("targetKind") ?? "");
  const targetId = String(form.get("targetId") ?? "");

  if (!(file instanceof Blob) || !key || !targetKind || !targetId) {
    return NextResponse.json(
      { error: { code: "validation", message: "Missing required upload parameters." } },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: {
          code: "validation",
          message: `Images must be under ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`,
        },
      },
      { status: 400 },
    );
  }

  if (targetKind === "product") {
    const product = await getProductForAdmin(auth.vendorId, targetId);
    if (!product || !isProductImageKey(key, product.id)) {
      return NextResponse.json(
        {
          error: {
            code: "validation",
            message: "That upload key does not belong to this product.",
          },
        },
        { status: 400 },
      );
    }
  } else if (targetKind === "category") {
    if (auth.via !== "ADMIN" && auth.via !== "platform-admin") {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Only store admins can upload category images." } },
        { status: 403 },
      );
    }
    const category = await getCategoryForAdmin(auth.vendorId, targetId);
    if (!category) {
      return NextResponse.json(
        { error: { code: "not_found", message: "That category does not exist." } },
        { status: 404 },
      );
    }
  } else {
    return NextResponse.json(
      { error: { code: "validation", message: "Invalid target kind." } },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  await getStorage().putObject(key, bytes, IMAGE_CONTENT_TYPE);

  return NextResponse.json({ ok: true, key }, { status: 200 });
}
