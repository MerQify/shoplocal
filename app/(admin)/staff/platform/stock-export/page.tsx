import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireVendorRole } from "@/lib/auth-rbac";
import { PageContainer } from "@/components/layout/PageContainer";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { Icon } from "@/components/icons/Icon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock & Template Export — Platform Admin",
};

/**
 * #1634 — Standardised Product Import/Export Templates and Platform Admin Stock Export.
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

  return (
    <PageContainer width="wide">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
            Platform Admin
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Stock & Template Export</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Export existing stock records with full metadata, or download standardized bulk creation
          templates for all grocery categories.
        </p>
      </div>

      <div className="space-y-8">
        {/* 1. Live Catalogue Stock Export Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-100 p-2 text-emerald-700">
                  <Icon name="download" className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">
                  Export Existing Catalogue Stock
                </h2>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Exports all live and staged catalogue records mapped into the Universal Product
                Template. Contains complete metadata including brands, categories, current stock,
                base pricing, VAT rates, dietary flags, and speciality attributes.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-1">6,300+ Products</span>
                <span className="rounded bg-slate-100 px-2 py-1">Two-Way Update Sync</span>
                <span className="rounded bg-slate-100 px-2 py-1">Zero Data Loss</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <a
                href="/staff/platform/stock-export/export?type=stock&format=xlsx"
                download
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <Icon name="download" className="h-4 w-4" />
                Export Excel (.xlsx)
              </a>
              <a
                href="/staff/platform/stock-export/export?type=stock&format=csv"
                download
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <Icon name="download" className="h-4 w-4" />
                Export CSV (.csv)
              </a>
            </div>
          </div>
        </div>

        {/* Bundles & Promotions Export */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Bundles & Promotions Exports
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Export all active and draft bundles and homepage hero promotions for bulk review and offline records.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/staff/platform/stock-export/export?type=bundles&format=csv"
              download
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Icon name="download" className="h-4 w-4" />
              Export Bundles (.csv)
            </a>
            <a
              href="/staff/platform/stock-export/export?type=promotions&format=csv"
              download
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Icon name="download" className="h-4 w-4" />
              Export Promotions (.csv)
            </a>
          </div>
        </div>

        {/* 2. Standardised Templates Section */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Standardised Product Creation Templates
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Universal Template */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                    Comprehensive
                  </span>
                  <span className="text-xs text-slate-500">40 Fields</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Universal Product Template
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Complete schema containing all available product fields: mandatory, optional, and
                  category-specific attributes (Cut, Variety, Grain, Form, Storage), dietary
                  certifications, HMC references, tax rates, and multi-buy promotions.
                </p>
                <ul className="mt-4 space-y-1 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Mandatory fields clearly marked with asterisks (
                    <code className="text-slate-700">*</code>)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Includes separate &quot;Field Instructions&quot; worksheet
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Ideal for bulk catalogue migrations & deep imports
                  </li>
                </ul>
              </div>

              <div className="mt-6 flex gap-2 pt-4 border-t border-slate-100">
                <a
                  href="/staff/platform/stock-export/export?type=universal&format=xlsx"
                  download
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  <Icon name="download" className="h-3.5 w-3.5" />
                  Template (.xlsx)
                </a>
                <a
                  href="/staff/platform/stock-export/export?type=universal&format=csv"
                  download
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Icon name="download" className="h-3.5 w-3.5" />
                  CSV
                </a>
              </div>
            </div>

            {/* Essential Template */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Streamlined
                  </span>
                  <span className="text-xs text-slate-500">11 Fields</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Essential Product Template
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Simplified schema containing only mandatory fields plus Brand and key identifiers.
                  Engineered for rapid, zero-decision bulk imports without requiring manual field
                  mapping or decisions.
                </p>
                <ul className="mt-4 space-y-1 text-xs text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Includes: Product Name*, Brand*, Category*, Price (£)*, Unit/Pack Size*
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Automated zero-decision matching (ID / Barcode / PLU)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Immediate creation or update in a single click
                  </li>
                </ul>
              </div>

              <div className="mt-6 flex gap-2 pt-4 border-t border-slate-100">
                <a
                  href="/staff/platform/stock-export/export?type=essential&format=xlsx"
                  download
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition"
                >
                  <Icon name="download" className="h-3.5 w-3.5" />
                  Template (.xlsx)
                </a>
                <a
                  href="/staff/platform/stock-export/export?type=essential&format=csv"
                  download
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Icon name="download" className="h-3.5 w-3.5" />
                  CSV
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Two-Way Sync & Zero-Decision Guide */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-semibold text-slate-900">How Two-Way Import/Export Works</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 text-xs text-slate-600">
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">
                1. Export Existing Stock
              </span>
              Download the current stock export. Rows have their unique{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded">Product ID</code> populated.
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">
                2. Edit Prices & Stock
              </span>
              Update any prices, sizes, or attributes in Excel. To add new products, append rows
              with a blank Product ID.
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
