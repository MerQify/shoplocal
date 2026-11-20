"use client";

import { useState, useTransition } from "react";
import { searchLibraryAction } from "@/features/admin/image-library";
import type { HubAsset } from "@/lib/image-hub/client";
import type { ProductAssignMode } from "@/lib/image-hub-service";
import { assignLibraryAsset, libraryContentUrl } from "@/components/staff/library-assign";

/**
 * #1678 — "Choose from library" on a product's staff page. Lists APPROVED library images ranked by
 * relevance to the product (the page builds `contextQuery` from its name, brand and category; the
 * hub's `sort=relevance` scores each word), and assigns the chosen one through the same shared
 * sequence as `/staff/image-library` (`library-assign.ts`).
 *
 * Only approved images are listed: the server refuses to assign any other, so offering one would
 * be a choice that then fails. The assign actions revalidate this product's page, so the Images
 * section above shows the new image without a reload.
 */

export interface ProductLibraryPickerProps {
  productId: string;
  productName: string;
  /** Prefills the search; built server side by `productContextQuery`. */
  contextQuery: string;
}

type Search = { q: string; ranked: boolean };

export function ProductLibraryPicker({
  productId,
  productName,
  contextQuery,
}: ProductLibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(contextQuery);
  const [search, setSearch] = useState<Search>({ q: contextQuery, ranked: true });
  const [items, setItems] = useState<HubAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HubAsset | null>(null);
  const [mode, setMode] = useState<ProductAssignMode>("primary");
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(
    null,
  );
  const [loading, startLoading] = useTransition();
  const [assigning, startAssigning] = useTransition();

  function params(next: Search, after?: string) {
    const q = next.q.trim();
    return {
      ...(next.ranked && q ? { q, sort: "relevance" as const } : {}),
      status: "APPROVED" as const,
      ...(after ? { cursor: after } : {}),
    };
  }

  function run(next: Search) {
    setSearch(next);
    setSelected(null);
    setError(null);
    startLoading(async () => {
      const page = await searchLibraryAction(params(next));
      setSearched(true);
      if (!page.ok) {
        setItems([]);
        setCursor(null);
        setError(page.message);
        return;
      }
      setItems(page.value.items);
      setCursor(page.value.nextCursor);
    });
  }

  function loadMore() {
    if (!cursor) return;
    startLoading(async () => {
      const page = await searchLibraryAction(params(search, cursor));
      if (!page.ok) {
        setError(page.message);
        return;
      }
      setItems((current) => [...current, ...page.value.items]);
      setCursor(page.value.nextCursor);
    });
  }

  function openPanel() {
    setOpen(true);
    setStatus(null);
    run({ q: query, ranked: true });
  }

  function assign() {
    if (!selected) return;
    const asset = selected;
    setStatus(null);
    startAssigning(async () => {
      const result = await assignLibraryAsset(
        asset.id,
        { kind: "product", id: productId, name: productName },
        mode,
        (text) => setStatus({ tone: "ok", text }),
      );
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      setStatus(
        result.warning
          ? { tone: "warn", text: result.warning }
          : { tone: "ok", text: `Assigned to ${productName}.` },
      );
      setOpen(false);
      setSelected(null);
    });
  }

  const statusLine = status && (
    <p
      role={status.tone === "error" ? "alert" : "status"}
      className={
        status.tone === "error"
          ? "text-xs text-danger"
          : status.tone === "warn"
            ? "text-xs text-accent"
            : "text-xs text-action"
      }
    >
      {status.text}
    </p>
  );

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={openPanel}
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-muted"
        >
          Choose from library
        </button>
        {statusLine}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-surface-muted p-3">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run({ q: query, ranked: true });
        }}
      >
        <label className="sr-only" htmlFor={`library-picker-q-${productId}`}>
          Search the image library
        </label>
        <input
          id={`library-picker-q-${productId}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the image library"
          className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelected(null);
          }}
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary hover:bg-surface-muted"
        >
          Close
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {searched && !loading && !error && items.length === 0 && (
        <div className="space-y-2 text-sm text-primary-muted">
          <p>No approved library images match &quot;{search.q.trim()}&quot;.</p>
          <button
            type="button"
            onClick={() => run({ q: "", ranked: false })}
            className="font-semibold text-action underline"
          >
            Show all approved images
          </button>
        </div>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((asset) => {
            const isSelected = selected?.id === asset.id;
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelected(isSelected ? null : asset)}
                  className={`w-full overflow-hidden rounded-lg border bg-white text-left ${
                    isSelected ? "border-action ring-2 ring-action" : "border-black/10"
                  }`}
                >
                  <img
                    src={libraryContentUrl(asset.id)}
                    alt={asset.alt ?? asset.title}
                    loading="lazy"
                    className="aspect-square w-full object-contain"
                  />
                  <span className="block truncate px-2 py-1 text-xs font-medium text-primary">
                    {asset.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {cursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg border border-black/15 bg-white px-3 py-1 text-sm font-semibold text-primary hover:bg-surface-muted disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {selected && (
        <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-3 text-sm">
          <div className="flex gap-3" role="radiogroup" aria-label="Use as">
            {(["primary", "additional"] as const).map((option) => (
              <label key={option} className="flex items-center gap-1 text-primary">
                <input
                  type="radio"
                  name={`library-picker-mode-${productId}`}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                />
                {option === "primary" ? "Main image" : "Additional image"}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={assign}
            disabled={assigning}
            className="rounded-lg bg-action px-3 py-1 font-semibold text-white hover:bg-action-hover disabled:opacity-50"
          >
            {assigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      )}

      {statusLine}
    </div>
  );
}
