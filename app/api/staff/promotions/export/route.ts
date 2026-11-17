import { requireVendorRole } from "@/lib/auth-rbac";
import { fetchPromotionsForExport, exportPromotionsToCsv } from "@/lib/promotion-templates/export";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    return new Response(auth.status === 401 ? "Sign in required" : "Staff only", {
      status: auth.status,
    });
  }

  const promotions = await fetchPromotionsForExport(auth.vendorId);
  const csvContent = exportPromotionsToCsv(promotions);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `promotions-export-${dateStr}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
