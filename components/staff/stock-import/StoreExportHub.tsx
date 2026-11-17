"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";

export function StoreExportHub() {
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");

  const querySuffix = statusFilter === "all" ? "?status=all" : "?status=active";

  return (
    <div id="export-hub" className="mt-8 rounded-3xl border border-black/10 bg-white p-6 shadow-xs">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/5 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-primary">Templates & Operational Exports</h2>
          <p className="text-sm text-primary-muted">
            Download pre-formatted import templates, master workbooks with native AutoFilters, or
            live catalogue and operational data for backup, audit, and batch edits.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-black/10 bg-surface-muted p-1">
          <span className="px-2 text-xs font-medium text-primary-muted">Export Filter:</span>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              statusFilter === "active"
                ? "bg-primary text-white shadow-xs"
                : "text-primary hover:text-primary-tint"
            }`}
          >
            Active Only (Uncluttered)
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              statusFilter === "all"
                ? "bg-primary text-white shadow-xs"
                : "text-primary hover:text-primary-tint"
            }`}
          >
            All (Include Inactive / Expired)
          </button>
        </div>
      </div>

      {/* Safety Notice regarding Protected Columns & Two-Way Sync */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
        <div className="flex items-start gap-2.5">
          <Icon name="triangle-alert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">
              Two-Way Sync &amp; Protected Columns Notice
            </p>
            <p>
              Columns marked with <code className="font-mono font-semibold">[DO NOT EDIT]</code>{" "}
              (such as <code className="font-mono">Product ID [DO NOT EDIT]</code>) match existing
              records in the database. <strong>Do not modify these IDs</strong> when updating
              existing items. To add a brand-new product, leave the ID cell completely empty. For
              unbranded or fresh butcher meat, leave <code className="font-mono">Brand</code> empty.
            </p>
          </div>
        </div>
      </div>

      {/* Featured Master Multi-Sheet Workbook Card */}
      <div className="mb-6 rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              <Icon name="check" className="h-3.5 w-3.5" />
              All-In-One Master Spreadsheet
            </div>
            <h3 className="text-base font-bold text-primary">
              Aheed Food Centre — Master Operational Workbook (.xlsx)
            </h3>
            <p className="text-xs text-primary-muted max-w-2xl">
              Consolidated Excel spreadsheet with native AutoFilters enabled on every tab. Contains
              7 distinct sheets: <strong>Products</strong> (hierarchically sorted by Department
              &rarr; Category &rarr; Name), <strong>Categories</strong>, <strong>Bundles</strong>,{" "}
              <strong>Promotions</strong>, <strong>Discount Codes</strong>,{" "}
              <strong>Filters &amp; Attributes</strong>, and <strong>Field Instructions</strong>.
            </p>
          </div>
          <a
            href="/templates/aheed-food-centre-master-stock-export.xlsx"
            download="aheed-food-centre-master-stock-export.xlsx"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-primary/90 shrink-0"
          >
            <Icon name="download" className="h-4 w-4" />
            Download Master Excel
          </a>
        </div>
      </div>

      {/* Grid of Sections: Live Exports & Blank Templates */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Section 1: Live Operational Data Exports */}
        <div className="rounded-2xl border border-black/10 bg-surface-muted/30 p-4">
          <h4 className="mb-3 text-sm font-bold text-primary flex items-center gap-2">
            <Icon name="list-checks" className="h-4 w-4 text-primary" />
            Live Catalogue &amp; Operational Exports (CSV / Excel)
          </h4>
          <p className="mb-4 text-xs text-primary-muted">
            Direct real-time exports generated from your live database based on your filter
            selection (<strong>{statusFilter === "active" ? "Active Only" : "All Records"}</strong>
            ):
          </p>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Universal Stock Export</span>
                <span className="block text-[11px] text-primary-muted">
                  All columns, hierarchical category sort
                </span>
              </div>
              <div className="flex gap-1.5">
                <a
                  href={`/api/staff/stock/export${querySuffix}&type=universal`}
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
                >
                  CSV
                </a>
                <a
                  href="/templates/aheed-food-centre-stock-export.xlsx"
                  download
                  className="rounded-lg bg-primary/10 px-2 py-1 font-semibold text-primary hover:bg-primary/20"
                >
                  Excel (.xlsx)
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Essential Stock Export</span>
                <span className="block text-[11px] text-primary-muted">
                  Core 10 columns for quick stock audits
                </span>
              </div>
              <a
                href={`/api/staff/stock/export${querySuffix}&type=essential`}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Categories Hierarchy</span>
                <span className="block text-[11px] text-primary-muted">
                  Departments, parent slugs, product counts
                </span>
              </div>
              <a
                href={`/api/staff/categories/export${querySuffix}`}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Curated Bundles</span>
                <span className="block text-[11px] text-primary-muted">
                  Constituent products, quantities, specs
                </span>
              </div>
              <a
                href={`/api/staff/bundles/export${querySuffix}`}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Marketing Promotions</span>
                <span className="block text-[11px] text-primary-muted">
                  Banners, priority, dates, target associations
                </span>
              </div>
              <a
                href={`/api/staff/promotions/export${querySuffix}`}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Discount Codes</span>
                <span className="block text-[11px] text-primary-muted">
                  Voucher codes, percentage/pence, spend limits
                </span>
              </div>
              <a
                href={`/api/staff/discounts/export${querySuffix}`}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">
                  Filters &amp; Storefront Attributes
                </span>
                <span className="block text-[11px] text-primary-muted">
                  Facet filters, options, and units
                </span>
              </div>
              <a
                href="/api/staff/filters/export"
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>
          </div>
        </div>

        {/* Section 2: Blank Formatted Import Templates */}
        <div className="rounded-2xl border border-black/10 bg-surface-muted/30 p-4">
          <h4 className="mb-3 text-sm font-bold text-primary flex items-center gap-2">
            <Icon name="download" className="h-4 w-4 text-primary" />
            Blank Formatted Templates (For New Uploads)
          </h4>
          <p className="mb-4 text-xs text-primary-muted">
            Clean, pre-formatted templates with exact header matching and instructions to populate
            and upload new data without errors:
          </p>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Universal Product Template</span>
                <span className="block text-[11px] text-primary-muted">
                  Complete 40-column specification
                </span>
              </div>
              <div className="flex gap-1.5">
                <a
                  href="/templates/universal-product-template.csv"
                  download
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
                >
                  CSV
                </a>
                <a
                  href="/templates/universal-product-template.xlsx"
                  download
                  className="rounded-lg bg-primary/10 px-2 py-1 font-semibold text-primary hover:bg-primary/20"
                >
                  Excel
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Essential Product Template</span>
                <span className="block text-[11px] text-primary-muted">
                  Simple 10-column fast import
                </span>
              </div>
              <div className="flex gap-1.5">
                <a
                  href="/templates/essential-product-template.csv"
                  download
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
                >
                  CSV
                </a>
                <a
                  href="/templates/essential-product-template.xlsx"
                  download
                  className="rounded-lg bg-primary/10 px-2 py-1 font-semibold text-primary hover:bg-primary/20"
                >
                  Excel
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Blank Bundle Template</span>
                <span className="block text-[11px] text-primary-muted">Name, slug, items spec</span>
              </div>
              <a
                href="/templates/bundle-template.csv"
                download
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Blank Promotion Template</span>
                <span className="block text-[11px] text-primary-muted">
                  Banners, priorities, targets
                </span>
              </div>
              <a
                href="/templates/promotion-template.csv"
                download
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Blank Category Template</span>
                <span className="block text-[11px] text-primary-muted">
                  Categories &amp; department tree
                </span>
              </div>
              <a
                href="/templates/category-template.csv"
                download
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">Blank Discount Code Template</span>
                <span className="block text-[11px] text-primary-muted">
                  Vouchers, percentages, rules
                </span>
              </div>
              <a
                href="/templates/discount-code-template.csv"
                download
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-primary">
                  Blank Filter &amp; Attributes Template
                </span>
                <span className="block text-[11px] text-primary-muted">
                  Attribute definitions and options
                </span>
              </div>
              <a
                href="/templates/filter-template.csv"
                download
                className="rounded-lg border border-black/10 bg-white px-2 py-1 font-medium text-primary hover:bg-surface-muted"
              >
                CSV
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
