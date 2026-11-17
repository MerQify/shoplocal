import { requireVendorRole } from "@/lib/auth-rbac";
import {
  generateUniversalStockCsv,
  generateEssentialStockCsv,
} from "@/lib/product-templates/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    return new Response(auth.status === 401 ? "Sign in required" : "Staff only", {
      status: auth.status,
    });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") === "essential" ? "essential" : "universal";
  const statusParam = searchParams.get("status");
  const status = statusParam === "all" || statusParam === "archived" ? statusParam : "active";

  const dateStr = new Date().toISOString().slice(0, 10);
  let csvContent = "";
  let filename = "";

  if (type === "essential") {
    csvContent = await generateEssentialStockCsv(auth.vendorId, { status });
    filename = `stock-essential-${status}-export-${dateStr}.csv`;
  } else {
    csvContent = await generateUniversalStockCsv(auth.vendorId, { status });
    filename = `stock-universal-${status}-export-${dateStr}.csv`;
  }

  return new Response(csvContent, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
