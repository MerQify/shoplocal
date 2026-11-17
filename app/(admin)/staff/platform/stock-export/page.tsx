import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireVendorRole } from "@/lib/auth-rbac";
import { listCategoriesForAdmin } from "@/lib/categories-service";
import { PageContainer } from "@/components/layout/PageContainer";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { PlatformExportHub } from "@/components/staff/platform-stock-export/PlatformExportHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock & Template Export — Platform Admin",
};

/**
 * #1634, #1638, #1640 — Standardised Product Import/Export Templates and Operational Stock Export.
 * Exclusively restricted to platform administrators (auth.via === 'platform-admin').
 */
export default async function PlatformStockExportPage() {
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login");
    return (
      <PanelRefusal
        title="Platform admin only"
        message="This area is restricted to platform administrators."
      />
    );
  }

  if (auth.via !== "platform-admin") {
    return (
      <PanelRefusal
        title="Platform admin only"
        message="This area is restricted to platform administrators. Store admins cannot access platform stock exports."
      />
    );
  }

  const categories = await listCategoriesForAdmin(auth.vendorId);

  return (
    <PageContainer width="wide">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
            Platform Admin
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Stock &amp; Template Export</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Export existing stock records with full metadata, download the all-in-one Master
          Operational Workbook with native AutoFilters, or download standardized bulk creation
          templates for all grocery categories.
        </p>
      </div>

      <div className="space-y-8">
        {/* Templates & Operational Exports Section */}
        <PlatformExportHub categories={categories} />

        {/* Two-Way Sync & Zero-Decision Guide */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-semibold text-slate-900">How Two-Way Import/Export Works</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 text-xs text-slate-600">
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">
                1. Export Existing Stock
              </span>
              Download the current stock export. Rows have their unique{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded">Product ID [DO NOT EDIT]</code>{" "}
              populated.
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">
                2. Edit Prices &amp; Stock
              </span>
              Update any prices, sizes, or attributes in Excel. To add new products, append rows
              with a blank Product ID. Leave Brand blank for unbranded items.
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">3. Re-Upload to Apply</span>
              Upload via{" "}
              <Link href="/staff/products/import" className="text-action font-medium underline">
                Staff Product Import
              </Link>
              . Standard template headers are auto-detected and processed with zero decisions.
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
