import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVendorRole } from "@/lib/auth-rbac";
import { listProductsForAdminPage } from "@/lib/products-service";
import { listCategoriesForAdmin } from "@/lib/categories-service";
import { toCategoryOptionGroups } from "@/lib/catalogue-form";
import { getBrandRepository } from "@/lib/brands-service";
import { getLowStockDefault } from "@/lib/vendor-service";
import { getCachedCatalogueFacets } from "@/lib/cloudflare-metadata";
import { isLowStock } from "@/lib/low-stock";
import { LowStockDefaultForm } from "@/components/staff/LowStockDefaultForm";
import { deriveUnitPriceLabel } from "@/components/product/unit-price";
import {
  BRAND_ALL,
  BRAND_NONE,
  CATEGORY_ALL,
  DEFAULT_PER_PAGE,
  DEFAULT_SORT,
  NEEDS_ALL,
  NEEDS_FILTERS,
  NEEDS_LABELS,
  PER_PAGE_OPTIONS,
  PRODUCT_STATUS_ALL,
  RESTRICTION_ALL,
  SORT_LABELS,
  SORT_OPTIONS,
  STOCK_ALL,
  STOCK_FILTERS,
  type StockFilter,
  parseStaffProductsQuery,
  staffProductsFilterFields,
  staffProductsHref,
} from "@/lib/staff-products-query";
import { StickyBulkActionBar } from "@/components/staff/StickyBulkActionBar";
import { ProductCatalogLayout, FilterToggleBtn } from "@/components/staff/ProductCatalogLayout";
import { SelectAllHeaderCheckbox } from "@/components/staff/SelectAllHeaderCheckbox";
import { Pagination } from "@/components/ui/Pagination";
import { BULK_PRODUCTS_FORM_ID } from "@/lib/product-restriction-form";
import {
  BULK_QUANTITY_FORM_ID,
  MAX_BULK_QUANTITY,
  ORIG_PREFIX,
  QTY_PREFIX,
} from "@/lib/bulk-quantity";
import { RESTRICTION_LABELS, STOCK_MODE_LABELS } from "@/lib/product-restriction";
import { formatPrice } from "@/components/product/format-price";
import { multiBuyLabel, savingLabel } from "@/lib/price-psychology";
import { formatNetContentDisplay } from "@/lib/catalogue-import/net-content";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { BackfillImagesButton } from "@/components/staff/BackfillImagesButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { Icon } from "@/components/icons/Icon";
import { IconMedallion } from "@/components/icons/IconMedallion";

// Reads the session and this vendor's live catalogue — must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Products" };

type Param = string | string[] | undefined;

/**
 * A query-string value as ONE string. A repeated parameter (`?page=2&page=3`) is `string[]` at
 * runtime whatever `searchParams`' type says (specs/architecture.md, #682), and `.trim()` on an
 * array throws. So the first value wins.
 */
function one(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const selectClass =
  "w-full truncate rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary";
const labelClass = "flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-primary";

/**
 * The catalogue product list (P6b1, #159) — the primary admin catalogue surface.
 * Redesigned with a dedicated sidebar filter panel and docked sticky bulk-action bar,
 * keeping the catalogue table above the fold while retaining 100% of existing query,
 * bulk modification, and stock threshold functionality.
 */
export default async function StaffProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, Param>>;
}) {
  const params = await searchParams;
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login");
    return (
      <PanelRefusal
        title="Store admins only"
        message="You're signed in, but your account doesn't have permission to manage this store's catalogue."
      />
    );
  }

  // Categories are fetched BEFORE the product query, not alongside it (#503).
  // Brands, store-wide low-stock default, and metadata facets load together (#1572).
  const [categories, brands, lowStockDefault, facets] = await Promise.all([
    listCategoriesForAdmin(auth.vendorId),
    getBrandRepository().listSummaries(),
    getLowStockDefault(auth.vendorId),
    getCachedCatalogueFacets(auth.vendorId),
  ]);
  const isStoreAdmin = auth.via !== "STAFF";
  const query = parseStaffProductsQuery(
    {
      status: one(params.status),
      q: one(params.q),
      category: one(params.category),
      restriction: one(params.restriction),
      stock: one(params.stock),
      perPage: one(params.perPage),
      sort: one(params.sort),
      needs: one(params.needs),
      brand: one(params.brand),
      page: one(params.page),
    },
    categories,
    brands,
  );

  const facetSet =
    query.status === "active"
      ? facets.active
      : query.status === "archived" || query.status === "inactive"
        ? facets.archived
        : facets.all;

  // Filter categories to only those containing products under current status facet
  const matchingCategoryIds = new Set(facetSet.categoryIds);
  const parentIdsWithMatchingChildren = new Set<string>();
  for (const cat of categories) {
    if (cat.parentId && matchingCategoryIds.has(cat.id)) {
      parentIdsWithMatchingChildren.add(cat.parentId);
    }
  }
  const filteredCategories = categories.filter(
    (c) => matchingCategoryIds.has(c.id) || parentIdsWithMatchingChildren.has(c.id),
  );

  // Filter brands based on current status facet AND selected category (cascading)
  let eligibleBrandIds = new Set(facetSet.brandIds);
  if (query.category !== CATEGORY_ALL) {
    const selectedCategory = categories.find((c) => c.id === query.category);
    const subcategoryIds =
      selectedCategory?.parentId === null
        ? categories.filter((c) => c.parentId === selectedCategory.id).map((c) => c.id)
        : [];
    const allTargetCategoryIds = [query.category, ...subcategoryIds];
    const scopedBrandIds = new Set<string>();
    for (const catId of allTargetCategoryIds) {
      const brandIdsForCat = facetSet.categoryToBrandIds[catId] ?? [];
      for (const bId of brandIdsForCat) scopedBrandIds.add(bId);
    }
    eligibleBrandIds = scopedBrandIds;
  }
  const filteredBrands = brands.filter((b) => eligibleBrandIds.has(b.id));

  // Filter restrictions based on current status facet
  const activeRestrictions = new Set(facetSet.restrictions);
  const availableRestrictions = (
    ["PROHIBITED", "AGE_RESTRICTED", "NOT_DELIVERABLE", "NEEDS_REVIEW"] as const
  ).filter((val) => activeRestrictions.has(val));

  // Filter stock modes based on current status facet
  const activeStockModes = new Set<string>(facetSet.stockModes);
  const availableStockFilters: StockFilter[] = STOCK_FILTERS.filter((mode: StockFilter) =>
    activeStockModes.has(mode),
  );

  const { items, total, page, pageCount } = await listProductsForAdminPage(auth.vendorId, {
    page: query.page,
    perPage: query.perPage,
    sort: query.sort,
    search: query.search,
    isActive: query.isActive,
    categoryIds: query.categoryIds,
    restriction: query.restriction,
    stockMode: query.stockMode,
    needs: query.needs,
    brandId: query.brandId,
  });

  const isFiltered =
    query.search !== null ||
    query.status !== PRODUCT_STATUS_ALL ||
    query.category !== CATEGORY_ALL ||
    query.restriction !== undefined ||
    query.stockMode !== undefined ||
    query.needs !== undefined ||
    query.brandId !== undefined;

  let activeFilterCount = 0;
  if (query.status !== PRODUCT_STATUS_ALL) activeFilterCount++;
  if (query.category !== CATEGORY_ALL) activeFilterCount++;
  if (query.brand !== BRAND_ALL) activeFilterCount++;
  if (query.restrictionFilter !== RESTRICTION_ALL) activeFilterCount++;
  if (query.stockFilter !== STOCK_ALL) activeFilterCount++;
  if (query.needsFilter !== NEEDS_ALL) activeFilterCount++;
  if (query.search) activeFilterCount++;

  return (
    <PageContainer width="wide">
      {/* Dashboard Top Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-primary">
            Products
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-action border border-action/20">
              {total.toLocaleString()} items
            </span>
          </h1>
          <p className="mt-1 text-sm text-primary-muted">
            Manage your product catalogue and inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Store-wide Low Stock Default Setting Popover */}
          <details className="relative group">
            <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-2xl border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-surface-muted list-none">
              <svg
                className="h-4 w-4 text-primary-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Low-stock default: {lowStockDefault}</span>
              <Icon
                name="chevron-down"
                className="h-3.5 w-3.5 text-primary-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="absolute right-0 top-full mt-2 z-30 w-80 rounded-2xl border border-black/10 bg-white p-4 shadow-xl">
              {isStoreAdmin ? (
                <LowStockDefaultForm current={lowStockDefault} />
              ) : (
                <p className="text-sm text-primary-muted">
                  Products show as low stock at or below {lowStockDefault} unless they have their
                  own number. A store admin can change this.
                </p>
              )}
            </div>
          </details>

          {/* More Actions Dropdown */}
          <details className="relative group">
            <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-2xl border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-surface-muted list-none">
              <span>More actions</span>
              <Icon
                name="chevron-down"
                className="h-3.5 w-3.5 text-primary-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="absolute right-0 top-full mt-2 z-30 w-64 rounded-2xl border border-black/10 bg-white p-2 shadow-xl space-y-1">
              <Link
                href="/staff/platform/stock-export"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-surface-muted transition"
              >
                <Icon name="download" className="h-4 w-4 text-primary" />
                <span>Export &amp; Templates</span>
              </Link>
              <div className="border-t border-black/5 pt-1 px-1">
                <BackfillImagesButton />
              </div>
            </div>
          </details>

          {/* Create Product CTA */}
          <Link
            href="/staff/products/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 shadow-sm"
          >
            <Icon name="plus" className="h-4 w-4" />
            <span>New product</span>
          </Link>
        </div>
      </header>

      {/* Main Two-Column Layout: Sidebar Filters + Products Main Area */}
      <ProductCatalogLayout
        activeFilterCount={activeFilterCount}
        isFiltered={isFiltered}
        sidebar={
          <form method="get" action="/staff/products" className="space-y-4">
            {query.search && <input type="hidden" name="q" value={query.search} />}

            {/* Status Radio Filter */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wide text-primary">
                Status
              </legend>
              <div className="space-y-1">
                <label className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm font-medium text-primary hover:bg-surface-muted cursor-pointer transition">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="status"
                      value={PRODUCT_STATUS_ALL}
                      defaultChecked={query.status === PRODUCT_STATUS_ALL}
                      className="h-4 w-4 text-action focus:ring-action"
                    />
                    <span>All statuses</span>
                  </div>
                  {facets.all.count !== undefined && (
                    <span className="text-xs text-primary-muted font-normal">
                      ({facets.all.count.toLocaleString()})
                    </span>
                  )}
                </label>
                <label className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm font-medium text-primary hover:bg-surface-muted cursor-pointer transition">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      defaultChecked={query.status === "active"}
                      className="h-4 w-4 text-action focus:ring-action"
                    />
                    <span>Active</span>
                  </div>
                  {facets.active.count !== undefined && (
                    <span className="text-xs text-primary-muted font-normal">
                      ({facets.active.count.toLocaleString()})
                    </span>
                  )}
                </label>
                <label className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm font-medium text-primary hover:bg-surface-muted cursor-pointer transition">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="status"
                      value="archived"
                      defaultChecked={query.status === "archived" || query.status === "inactive"}
                      className="h-4 w-4 text-action focus:ring-action"
                    />
                    <span>Archived</span>
                  </div>
                  {facets.archived.count !== undefined && (
                    <span className="text-xs text-primary-muted font-normal">
                      ({facets.archived.count.toLocaleString()})
                    </span>
                  )}
                </label>
              </div>
            </fieldset>

            {/* Category Filter */}
            <label className={labelClass}>
              <span>Category</span>
              <select name="category" defaultValue={query.category} className={selectClass}>
                <option value={CATEGORY_ALL}>All categories</option>
                {toCategoryOptionGroups(filteredCategories).map((group) => (
                  <optgroup key={group.parent.id} label={group.parent.name}>
                    <option value={group.parent.id}>All of {group.parent.name}</option>
                    {group.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                        {!child.isActive && " (inactive)"}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {/* Brand Filter */}
            <label className={labelClass}>
              <span>Brand</span>
              <select name="brand" defaultValue={query.brand} className={selectClass}>
                <option value={BRAND_ALL}>All brands</option>
                <option value={BRAND_NONE}>No brand</option>
                {filteredBrands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Restriction Filter */}
            <label className={labelClass}>
              <span>Restriction</span>
              <select
                name="restriction"
                defaultValue={query.restrictionFilter}
                className={selectClass}
              >
                <option value={RESTRICTION_ALL}>Any</option>
                {availableRestrictions.length > 0 && (
                  <>
                    <option value="any">Restricted</option>
                    <option value="none">Not restricted</option>
                    {availableRestrictions.map((value) => (
                      <option key={value} value={value}>
                        {RESTRICTION_LABELS[value]}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            {/* Stock Filter */}
            <label className={labelClass}>
              <span>Stock</span>
              <select name="stock" defaultValue={query.stockFilter} className={selectClass}>
                <option value={STOCK_ALL}>Any</option>
                {(availableStockFilters.length > 0 ? availableStockFilters : STOCK_FILTERS).map(
                  (value) => (
                    <option key={value} value={value}>
                      {STOCK_MODE_LABELS[value]}
                    </option>
                  ),
                )}
              </select>
            </label>

            {/* Needs Attention Filter */}
            <label className={labelClass}>
              <span>Needs attention</span>
              <select name="needs" defaultValue={query.needsFilter} className={selectClass}>
                <option value={NEEDS_ALL}>Any</option>
                {NEEDS_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {NEEDS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            {/* Sort Filter */}
            <label className={labelClass}>
              <span>Sort by</span>
              <select name="sort" defaultValue={query.sort} className={selectClass}>
                {SORT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            {/* Per Page Filter */}
            <label className={labelClass}>
              <span>Per page</span>
              <select name="perPage" defaultValue={String(query.perPage)} className={selectClass}>
                {PER_PAGE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            {/* Apply Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
              >
                Apply filters
              </button>
            </div>
          </form>
        }
      >
        <div className="space-y-4">
          {/* Search Bar & Quick Views Card */}
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm space-y-3">
            <form method="get" action="/staff/products" className="flex gap-2">
              {query.status !== PRODUCT_STATUS_ALL && (
                <input type="hidden" name="status" value={query.status} />
              )}
              {query.category !== CATEGORY_ALL && (
                <input type="hidden" name="category" value={query.category} />
              )}
              {query.brand !== BRAND_ALL && (
                <input type="hidden" name="brand" value={query.brand} />
              )}
              {query.restrictionFilter !== RESTRICTION_ALL && (
                <input type="hidden" name="restriction" value={query.restrictionFilter} />
              )}
              {query.stockFilter !== STOCK_ALL && (
                <input type="hidden" name="stock" value={query.stockFilter} />
              )}
              {query.needsFilter !== NEEDS_ALL && (
                <input type="hidden" name="needs" value={query.needsFilter} />
              )}
              {query.sort !== DEFAULT_SORT && (
                <input type="hidden" name="sort" value={query.sort} />
              )}
              {query.perPage !== DEFAULT_PER_PAGE && (
                <input type="hidden" name="perPage" value={query.perPage} />
              )}

              <label className="sr-only" htmlFor="product-search">
                Search products
              </label>
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-primary-muted"
                />
                <input
                  id="product-search"
                  type="search"
                  name="q"
                  defaultValue={query.search ?? ""}
                  placeholder="Search products by name, PLU or barcode…"
                  className="w-full rounded-2xl border border-black/10 bg-white py-2.5 pr-3 pl-10 text-sm text-primary placeholder:text-primary-muted focus:border-action focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                Search
              </button>
            </form>

            {/* Quick Views */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold uppercase tracking-wide text-primary-muted mr-1">
                  Quick views:
                </span>
                <Link
                  href={staffProductsHref({ ...query, needs: undefined })}
                  className={`rounded-full border px-3 py-1 font-semibold transition ${
                    !query.needs
                      ? "border-primary bg-primary text-white"
                      : "border-black/10 bg-white text-primary hover:bg-surface-muted"
                  }`}
                >
                  All Products
                </Link>
                {NEEDS_FILTERS.map((value) => {
                  const active = query.needs === value;
                  return (
                    <Link
                      key={value}
                      href={staffProductsHref({ ...query, needs: active ? undefined : value })}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 font-semibold transition ${
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-black/10 bg-white text-primary hover:bg-surface-muted"
                      }`}
                    >
                      {NEEDS_LABELS[value]}
                    </Link>
                  );
                })}
              </div>
              <FilterToggleBtn />
            </div>
          </div>

          {/* Subheader: Item Count Info */}
          <div className="flex items-center justify-between px-1 text-sm text-primary-muted font-medium">
            <span>
              Showing {items.length > 0 ? (page - 1) * query.perPage + 1 : 0}–
              {Math.min(page * query.perPage, total)} of {total.toLocaleString()} products
            </span>
          </div>

          {/* Product Data Table View */}
          {items.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-surface-muted p-12 text-center">
              <IconMedallion icon="package" size={40} className="mx-auto mb-3" decorative />
              <p className="text-base font-semibold text-primary">No products found</p>
              <p className="mt-1 text-sm text-primary-muted">
                {isFiltered
                  ? "No products match this view. Clear the filters to see the whole catalogue."
                  : "No products yet. Create a category first, then add your first product."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="border-b border-black/10 bg-surface-muted/40 text-[11px] font-bold uppercase tracking-wider text-primary-muted">
                    <tr>
                      <th scope="col" className="w-10 px-4 py-3 text-center">
                        <SelectAllHeaderCheckbox />
                      </th>
                      <th scope="col" className="px-4 py-3 min-w-[220px]">
                        Product
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Category
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Brand
                      </th>
                      <th scope="col" className="px-4 py-3 min-w-[140px]">
                        Stock
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Price
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                      <th scope="col" className="w-12 px-3 py-3 text-center">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {items.map((product) => {
                      const discountLabel = savingLabel(product.originalPrice, product.basePrice);
                      const tierLabel = multiBuyLabel(product.basePrice, product.tier);
                      const tracked = product.stockMode === "TRACKED";
                      const currentQty = tracked ? String(product.quantity) : "";
                      const low = isLowStock(product);
                      const unitPrice =
                        product.netContentAmount && product.netContentUnit
                          ? deriveUnitPriceLabel(product.basePrice, {
                              amount: product.netContentAmount,
                              unit: product.netContentUnit,
                            })
                          : null;

                      return (
                        <tr key={product.id} className="transition hover:bg-surface-muted/30 group">
                          {/* Row Selection Checkbox */}
                          <td className="px-4 py-3 text-center align-middle">
                            <input
                              type="checkbox"
                              name="productId"
                              value={product.id}
                              form={BULK_PRODUCTS_FORM_ID}
                              aria-label={`Select ${product.name}`}
                              className="h-4 w-4 rounded border-black/20 text-action focus:ring-action cursor-pointer"
                            />
                          </td>

                          {/* Product Identification & Details */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-primary-muted border border-black/5 font-semibold text-xs uppercase">
                                {product.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/staff/products/${product.id}`}
                                  className="font-semibold text-primary hover:underline block truncate"
                                >
                                  {product.name}
                                </Link>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-primary-muted">
                                  {product.netContentAmount && product.netContentUnit && (
                                    <span>
                                      {formatNetContentDisplay({
                                        amount: product.netContentAmount,
                                        unit: product.netContentUnit,
                                      })}
                                    </span>
                                  )}
                                  {product.plu && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono text-[11px] text-black/60">
                                        PLU {product.plu}
                                      </span>
                                    </>
                                  )}
                                  {product.restriction === "AGE_RESTRICTED" && (
                                    <>
                                      <span>·</span>
                                      <span
                                        title="Cannot currently be sold online due to age restrictions"
                                        className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/60 cursor-help"
                                      >
                                        Age Restricted
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3 align-middle text-primary font-medium text-xs">
                            {product.categoryName}
                          </td>

                          {/* Brand */}
                          <td className="px-4 py-3 align-middle text-xs">
                            {product.brandName ? (
                              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                                {product.brandName}
                              </span>
                            ) : (
                              <span className="text-primary-muted">—</span>
                            )}
                          </td>

                          {/* Stock Count & Threshold */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={MAX_BULK_QUANTITY}
                                step={1}
                                name={`${QTY_PREFIX}${product.id}`}
                                form={BULK_QUANTITY_FORM_ID}
                                defaultValue={currentQty}
                                placeholder={tracked ? "0" : "—"}
                                aria-label={`Stock count for ${product.name}`}
                                className="w-16 rounded-xl border border-black/10 bg-white px-2 py-1 text-center text-xs font-semibold text-primary data-changed:border-action data-changed:bg-action-tint focus:outline-none focus:ring-1 focus:ring-action"
                              />
                              <input
                                type="hidden"
                                name={`${ORIG_PREFIX}${product.id}`}
                                form={BULK_QUANTITY_FORM_ID}
                                value={currentQty}
                              />
                              <span className="text-[11px] text-primary-muted">
                                {tracked
                                  ? `Low at ${product.lowStockThreshold}`
                                  : STOCK_MODE_LABELS[product.stockMode]}
                              </span>
                            </div>
                          </td>

                          {/* Price & Psychology */}
                          <td className="px-4 py-3 align-middle text-right">
                            <div className="flex flex-col items-end">
                              <div className="flex items-baseline gap-1.5">
                                {discountLabel && product.originalPrice !== null && (
                                  <span className="text-xs text-black/60 line-through">
                                    {formatPrice(product.originalPrice)}
                                  </span>
                                )}
                                <span className="font-bold text-primary">
                                  {formatPrice(product.basePrice)}
                                </span>
                              </div>
                              {discountLabel && (
                                <span className="text-[10px] font-semibold text-danger">
                                  {discountLabel}
                                </span>
                              )}
                              {tierLabel && (
                                <span className="text-[10px] font-semibold text-action">
                                  {tierLabel}
                                </span>
                              )}
                              {unitPrice && (
                                <span className="text-[10px] text-primary-muted">{unitPrice}</span>
                              )}
                            </div>
                          </td>

                          {/* Status Badges */}
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-wrap items-center gap-1">
                              {product.isActive ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-primary-muted border border-black/10">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary-muted" />
                                  Archived
                                </span>
                              )}

                              {low && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                                  Low stock
                                </span>
                              )}

                              {product.basePrice <= 0 && (
                                <span className="inline-flex items-center rounded-full bg-danger-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
                                  Price needed
                                </span>
                              )}

                              {product.restriction !== null &&
                                product.restriction !== "AGE_RESTRICTED" && (
                                  <span className="inline-flex items-center rounded-full bg-danger-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
                                    {RESTRICTION_LABELS[product.restriction]}
                                  </span>
                                )}

                              {tracked && product.quantity <= 0 && (
                                <span className="inline-flex items-center rounded-full bg-danger-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
                                  Out of stock
                                </span>
                              )}

                              {product.imageNeedsReview && (
                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                                  Image Review
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Row Actions Link */}
                          <td className="px-3 py-3 align-middle text-center">
                            <Link
                              href={`/staff/products/${product.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-primary-muted hover:bg-surface-muted hover:text-primary transition"
                              title={`Edit ${product.name}`}
                            >
                              <span className="font-bold tracking-widest text-primary-muted group-hover:text-primary">
                                •••
                              </span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bottom Pagination */}
          {items.length > 0 && (
            <Pagination
              mode="numbered"
              label="Product pages"
              position="bottom"
              page={page}
              pageCount={pageCount}
              total={total}
              perPage={query.perPage}
              shown={items.length}
              noun={["product", "products"]}
              hrefFor={(target) => staffProductsHref(query, target)}
              jump={{
                action: "/staff/products",
                hidden: staffProductsFilterFields(query),
              }}
            />
          )}
        </div>
      </ProductCatalogLayout>

      {/* Unified Docked Sticky Bulk Action Bar */}
      {items.length > 0 && (
        <StickyBulkActionBar
          categories={categories}
          lowStockDefault={lowStockDefault}
          isStoreAdmin={isStoreAdmin}
        />
      )}
    </PageContainer>
  );
}
