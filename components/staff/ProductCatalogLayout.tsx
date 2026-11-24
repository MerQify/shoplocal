"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";

const COLLAPSED_STORAGE_KEY = "staff_products_filters_collapsed";

function readCollapsePreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeCollapse(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function writeCollapsePreference(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Ignore storage write failures
  }
}

interface FilterSidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  activeFilterCount: number;
}

const FilterSidebarContext = createContext<FilterSidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  activeFilterCount: 0,
});

export function useFilterSidebar() {
  return useContext(FilterSidebarContext);
}

/**
 * Toggle button for the filter sidebar. Can be placed anywhere inside ProductCatalogLayout
 * (e.g., in the Quick Views bar or search toolbar).
 */
export function FilterToggleBtn() {
  const { collapsed, toggle, activeFilterCount } = useFilterSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-primary hover:bg-surface-muted transition motion-reduce:active:scale-100"
      title={collapsed ? "Show filters sidebar" : "Collapse filters sidebar to maximize space"}
      aria-expanded={!collapsed}
    >
      <Icon
        name={collapsed ? "panel-left-open" : "panel-left-close"}
        className="h-3.5 w-3.5 text-primary-muted"
      />
      <span>{collapsed ? "Show filters" : "Hide filters"}</span>
      {activeFilterCount > 0 && (
        <span className="rounded-full bg-action px-1.5 py-0.2 text-[10px] font-bold text-white">
          {activeFilterCount}
        </span>
      )}
    </button>
  );
}

/**
 * Responsive layout container for the staff products catalog.
 * Supports collapsible sidebar filters to maximise horizontal table space on desktop/tablets.
 * Persists the user's preference in localStorage via useSyncExternalStore.
 */
export function ProductCatalogLayout({
  sidebar,
  children,
  activeFilterCount = 0,
  isFiltered = false,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  activeFilterCount?: number;
  isFiltered?: boolean;
}) {
  const stored = useSyncExternalStore(subscribeCollapse, readCollapsePreference, () => false);
  const [override, setOverride] = useState<boolean | null>(null);
  const collapsed = override ?? stored;

  const toggle = () => {
    const next = !collapsed;
    setOverride(next);
    writeCollapsePreference(next);
  };

  return (
    <FilterSidebarContext.Provider value={{ collapsed, toggle, activeFilterCount }}>
      <div className="mt-4 flex flex-col lg:flex-row items-start gap-6">
        {/* Left Column: Dedicated Filters Sidebar */}
        <aside
          className={`w-full shrink-0 transition-all duration-300 ${
            collapsed ? "lg:hidden" : "lg:w-72"
          }`}
          aria-label="Catalogue filters"
        >
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm space-y-5">
            {/* Sidebar Top Header with Title, Clear all & Collapse button */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <div className="flex items-center gap-2 font-bold text-primary text-sm">
                <Icon name="sliders-horizontal" className="h-4 w-4 text-primary" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-action/10 px-2 py-0.5 text-xs font-bold text-action">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isFiltered && (
                  <Link
                    href="/staff/products"
                    className="text-xs font-semibold text-action hover:underline"
                  >
                    Clear all
                  </Link>
                )}
                <button
                  type="button"
                  onClick={toggle}
                  className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-lg text-primary-muted hover:bg-surface-muted hover:text-primary transition motion-reduce:active:scale-100"
                  title="Collapse filters to maximize table space"
                  aria-label="Collapse filters sidebar"
                >
                  <Icon name="panel-left-close" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {sidebar}
          </div>
        </aside>

        {/* Right Column: Search, Quick Views, Product Table & Pagination */}
        <main className="min-w-0 flex-1 space-y-4 w-full">
          {/* Expand Bar when Collapsed on Wide Screens */}
          {collapsed && (
            <div className="hidden lg:flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggle}
                  className="inline-flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-bold text-primary hover:bg-black/5 hover:text-action transition motion-reduce:active:scale-100"
                >
                  <Icon name="panel-left-open" className="h-4 w-4 text-action" />
                  <span>Show filter sidebar</span>
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-action px-2 py-0.5 text-[10px] font-bold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <span className="text-xs text-primary-muted font-medium">
                  Filters hidden to maximise table space
                </span>
              </div>
              {isFiltered && (
                <Link
                  href="/staff/products"
                  className="text-xs font-semibold text-action hover:underline"
                >
                  Clear all filters
                </Link>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </FilterSidebarContext.Provider>
  );
}
