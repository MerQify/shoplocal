import { requireVendorRole } from "@/lib/auth-rbac";
import { fetchBundlesForExport, exportBundlesToCsv } from "@/lib/bundle-templates/export";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    return new Response(auth.status === 401 ? "Sign in required" : "Staff only", {
      status: auth.status,
    });
  }

  const bundles = await fetchBundlesForExport(auth.vendorId);
  const csvContent = exportBundlesToCsv(bundles);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `bundles-export-${dateStr}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
