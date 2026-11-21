"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icon";

export interface PlatformExportHubProps {
  categories?: { id: string; name: string; slug: string }[];
}

export function PlatformExportHub({ categories = [] }: PlatformExportHubProps) {
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "archived">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // #1714 — appended after `type=…&format=…`, so it starts with `&`. It began with `?` until #1714,
  // which made every link send `format=csv?status=…` and the route answer 400.
  const querySuffix = `&status=${statusFilter}${categoryFilter ? `&category=${encodeURIComponent(categoryFilter)}` : ""}`;

  const selectedCategoryName = categories.find((c) => c.slug === categoryFilter)?.name;

  return (
    <div id="export-hub" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Templates &amp; Operational Exports</h2>
          <p className="text-sm text-slate-600">
            Download pre-formatted import templates, master workbooks with native AutoFilters and
            in-cell dropdowns, or live catalogue data for backup, audit, and batch edits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Metadata Dropdown: Status Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
            <label htmlFor="status-filter-select" className="text-xs font-semibold text-slate-600">
              Status:
            </label>
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "active" | "all" | "archived")}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-2xs focus:border-slate-900 focus:outline-hidden"
            >
              <option value="active">Active Only (Uncluttered)</option>
              <option value="all">All Records (Active &amp; Inactive)</option>
              <option value="archived">Archived / Inactive Only</option>
            </select>
          </div>

          {/* Metadata Dropdown: Category / Department Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
            <label
              htmlFor="category-filter-select"
              className="text-xs font-semibold text-slate-600"
            >
              Category:
            </label>
            <select
              id="category-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-2xs focus:border-slate-900 focus:outline-hidden max-w-[200px]"
            >
              <option value="">All Departments &amp; Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Safety Notice regarding Protected Columns & Two-Way Sync */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
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
      <div className="mb-6 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/40 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              <Icon name="check" className="h-3.5 w-3.5" />
              All-In-One Master Spreadsheet
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Master Operational Workbook (.xlsx)
            </h3>
            <p className="text-xs text-slate-600 max-w-2xl">
              Consolidated Excel spreadsheet with native AutoFilters enabled on every tab. Contains
              7 distinct sheets: <strong>Products</strong> (hierarchically sorted by Department
              &rarr; Category &rarr; Name), <strong>Categories</strong>, <strong>Bundles</strong>,{" "}
              <strong>Promotions</strong>, <strong>Discount Codes</strong>,{" "}
              <strong>Filters &amp; Attributes</strong>, and <strong>Field Instructions</strong>.
            </p>
            <p className="text-xs text-slate-600 max-w-2xl">
              Built live from your database when you click. <strong>Products</strong> follows both
              the status and category filters above; Categories, Bundles, Promotions and Discount
              Codes follow the status filter only; Filters &amp; Attributes is always complete.
            </p>
          </div>
          <a
            href={`/staff/platform/stock-export/export?type=master&format=xlsx${querySuffix}`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-800 shrink-0"
          >
            <Icon name="download" className="h-4 w-4" />
            Download Master Excel
          </a>
        </div>
      </div>

      {/* Grid of Sections: Live Exports & Blank Templates */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Section 1: Live Operational Data Exports */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-bold text-slate-900 flex items-center gap-2">
            <Icon name="list-checks" className="h-4 w-4 text-slate-700" />
            Live Catalogue &amp; Operational Exports (CSV / Excel)
          </h4>
          <p className="mb-4 text-xs text-slate-500">
            Direct real-time exports generated from your live database based on your filter
            selection:{" "}
            <strong>
              {statusFilter === "active"
                ? "Active Only"
                : statusFilter === "archived"
                  ? "Archived Only"
                  : "All Records"}
            </strong>
            {selectedCategoryName && (
              <>
                {" "}
                in <strong>{selectedCategoryName}</strong>
              </>
            )}
            .
          </p>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Universal Stock Export</span>
                <span className="block text-[11px] text-slate-500">
                  All 40 columns, hierarchical category sort
                </span>
              </div>
              <div className="flex gap-1.5">
                <a
                  href={`/staff/platform/stock-export/export?type=stock&format=csv${querySuffix}`}
                  download
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
                >
                  CSV
                </a>
                <a
                  href={`/staff/platform/stock-export/export?type=stock&format=xlsx${querySuffix}`}
                  download
                  className="rounded-lg bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-200"
                >
                  Excel (.xlsx)
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Essential Stock Export</span>
                <span className="block text-[11px] text-slate-500">
                  Core 10 columns for quick stock audits
                </span>
              </div>
              <div className="flex gap-1.5">
                <a
                  href={`/staff/platform/stock-export/export?type=essential&format=csv${querySuffix}`}
                  download
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
                >
                  CSV
                </a>
                <a
                  href={`/staff/platform/stock-export/export?type=essential&format=xlsx${querySuffix}`}
                  download
                  className="rounded-lg bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-200"
                >
                  Excel (.xlsx)
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Categories Hierarchy</span>
                <span className="block text-[11px] text-slate-500">
                  Departments, parent slugs, product counts
                </span>
              </div>
              <a
                href={`/staff/platform/stock-export/export?type=categories&format=csv${querySuffix}`}
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Curated Bundles</span>
                <span className="block text-[11px] text-slate-500">
                  Constituent products, quantities, specs
                </span>
              </div>
              <a
                href={`/staff/platform/stock-export/export?type=bundles&format=csv${querySuffix}`}
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Marketing Promotions</span>
                <span className="block text-[11px] text-slate-500">
                  Banners, priority, dates, target associations
                </span>
              </div>
              <a
                href={`/staff/platform/stock-export/export?type=promotions&format=csv${querySuffix}`}
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Discount Codes</span>
                <span className="block text-[11px] text-slate-500">
                  Voucher codes, percentage/pence, spend limits
                </span>
              </div>
              <a
                href={`/staff/platform/stock-export/export?type=discounts&format=csv${querySuffix}`}
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">
                  Filters &amp; Storefront Attributes
                </span>
                <span className="block text-[11px] text-slate-500">
                  Facet filters, options, and units
                </span>
              </div>
              <a
                href="/staff/platform/stock-export/export?type=filters&format=csv"
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>
          </div>
        </div>

        {/* Section 2: Blank Formatted Import Templates */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-bold text-slate-900 flex items-center gap-2">
            <Icon name="download" className="h-4 w-4 text-slate-700" />
            Blank Formatted Templates (For New Uploads)
          </h4>
          <p className="mb-4 text-xs text-slate-500">
            Clean, pre-formatted templates with exact header matching and instructions to populate
            and upload new data without errors:
          </p>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Universal Product Template</span>
                <span className="block text-[11px] text-slate-500">
                  Complete 40-column specification
                </span>
              </div>
              <div className="flex gap-1.5">
                <a
                  href="/templates/universal-product-template.csv"
                  download
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
                >
                  CSV
                </a>
                <a
                  href="/templates/universal-product-template.xlsx"
                  download
                  className="rounded-lg bg-blue-100 px-2 py-1 font-semibold text-blue-800 hover:bg-blue-200"
                >
                  Excel
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Essential Product Template</span>
                <span className="block text-[11px] text-slate-500">
                  Simple 10-column fast import
                </span>
              </div>
              <div className="flex gap-1.5">
                <a
                  href="/templates/essential-product-template.csv"
                  download
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
                >
                  CSV
                </a>
                <a
                  href="/templates/essential-product-template.xlsx"
                  download
                  className="rounded-lg bg-amber-100 px-2 py-1 font-semibold text-amber-800 hover:bg-amber-200"
                >
                  Excel
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Blank Bundle Template</span>
                <span className="block text-[11px] text-slate-500">Name, slug, items spec</span>
              </div>
              <a
                href="/templates/bundle-template.csv"
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Blank Promotion Template</span>
                <span className="block text-[11px] text-slate-500">
                  Banners, priorities, targets
                </span>
              </div>
              <a
                href="/templates/promotion-template.csv"
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Blank Category Template</span>
                <span className="block text-[11px] text-slate-500">
                  Categories &amp; department tree
                </span>
              </div>
              <a
                href="/templates/category-template.csv"
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">Blank Discount Code Template</span>
                <span className="block text-[11px] text-slate-500">
                  Vouchers, percentages, rules
                </span>
              </div>
              <a
                href="/templates/discount-code-template.csv"
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                CSV
              </a>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div>
                <span className="font-semibold text-slate-900">
                  Blank Filter &amp; Attributes Template
                </span>
                <span className="block text-[11px] text-slate-500">
                  Attribute definitions and options
                </span>
              </div>
              <a
                href="/templates/filter-template.csv"
                download
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
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
