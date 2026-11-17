import { requireVendorRole } from "@/lib/auth-rbac";
import { fetchDiscountsForExport, exportDiscountsToCsv } from "@/lib/discount-templates/export";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    return new Response(auth.status === 401 ? "Sign in required" : "Staff only", {
      status: auth.status,
    });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusParam === "all" || statusParam === "archived" ? statusParam : "active";

  const discounts = await fetchDiscountsForExport(auth.vendorId, { status });
  const csvContent = exportDiscountsToCsv(discounts);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `discount-codes-${status}-export-${dateStr}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
