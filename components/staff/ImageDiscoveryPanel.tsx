"use client";

import { useState, useTransition } from "react";
import {
  importDiscoveredImageAction,
  searchDiscoveredImagesAction,
} from "@/features/admin/image-library";
import type { DiscoveredImage, DiscoveryProvider } from "@/lib/image-discovery/types";
import type { HubAsset } from "@/lib/image-hub/client";

export interface ImageDiscoveryPanelProps {
  onImported: (asset: HubAsset) => void;
}

const PROVIDER_NAMES: Record<DiscoveryProvider, string> = {
  OPENVERSE: "Openverse",
  WIKIMEDIA: "Wikimedia Commons",
  OPEN_FOOD_FACTS: "Open Food Facts",
};

export function ImageDiscoveryPanel({ onImported }: ImageDiscoveryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<DiscoveryProvider | "ALL">("ALL");
  const [items, setItems] = useState<DiscoveredImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [searching, startSearch] = useTransition();
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setActionError(null);
    startSearch(async () => {
      const res = await searchDiscoveredImagesAction({
        query: q,
        provider,
        limit: 15,
      });

      if (!res.ok) {
        setActionError(res.message);
        setItems([]);
        return;
      }

      setItems(res.value.items);
      setErrors(res.value.errors ?? null);
    });
  }

  async function handleImport(img: DiscoveredImage) {
    setImportingId(img.id);
    setActionError(null);

    const res = await importDiscoveredImageAction(img);
    setImportingId(null);

    if (!res.ok) {
      setActionError(res.message);
      return;
    }

    setImportedIds((prev) => new Set([...prev, img.id]));
    onImported(res.value);
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-primary">Discover Open-Licensed Photos</h2>
          <p className="mt-0.5 text-xs text-primary-muted">
            Find and import free, commercial-ready photos from Openverse, Wikimedia Commons, and
            Open Food Facts directly into your library.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-lg border border-black/15 bg-surface-muted px-3 py-1.5 text-xs font-semibold text-primary hover:bg-black/5 focus:outline-none"
        >
          {isOpen ? "Hide discovery search" : "Search open sources →"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 border-t border-black/5 pt-4">
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="discovery-q"
                className="mb-1 block text-xs font-semibold text-primary-muted"
              >
                Search keywords
              </label>
              <input
                id="discovery-q"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. mango, basmati rice, olive oil"
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="discovery-provider"
                className="mb-1 block text-xs font-semibold text-primary-muted"
              >
                Source repository
              </label>
              <select
                id="discovery-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as DiscoveryProvider | "ALL")}
                className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary focus:border-action focus:outline-none"
              >
                <option value="ALL">All repositories</option>
                <option value="OPENVERSE">Openverse (Flickr/Stock CC)</option>
                <option value="WIKIMEDIA">Wikimedia Commons</option>
                <option value="OPEN_FOOD_FACTS">Open Food Facts</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search repositories"}
            </button>
          </form>

          {actionError && (
            <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">
              {actionError}
            </div>
          )}

          {errors && Object.keys(errors).length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
              <strong>Notice:</strong> Some repositories could not be reached:{" "}
              {Object.entries(errors)
                .map(([name, err]) => `${name}: ${err}`)
                .join(", ")}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-primary-muted">
                Found {items.length} candidate image{items.length === 1 ? "" : "s"}:
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => {
                  const isImported = importedIds.has(item.id);
                  const isImporting = importingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between overflow-hidden rounded-lg border border-black/10 bg-surface-muted p-2.5"
                    >
                      <div>
                        <div className="aspect-square w-full overflow-hidden rounded bg-black/5">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        <div className="mt-2 space-y-1">
                          <p
                            className="line-clamp-2 text-xs font-semibold text-primary"
                            title={item.title}
                          >
                            {item.title}
                          </p>

                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <span className="rounded bg-black/10 px-1.5 py-0.5 font-medium text-primary-muted">
                              {PROVIDER_NAMES[item.provider]}
                            </span>
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">
                              {item.licence.replace("_", " ")}
                            </span>
                          </div>

                          <p
                            className="line-clamp-2 text-[10px] text-primary-muted"
                            title={item.attribution}
                          >
                            Attribution: {item.attribution}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-2">
                        <a
                          href={item.originalUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[11px] text-action hover:underline"
                        >
                          Source ↗
                        </a>

                        <button
                          type="button"
                          disabled={isImported || isImporting}
                          onClick={() => handleImport(item)}
                          className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                            isImported
                              ? "bg-emerald-600 text-white cursor-default"
                              : "bg-action text-white hover:bg-action-hover disabled:opacity-50"
                          }`}
                        >
                          {isImported
                            ? "Imported ✓"
                            : isImporting
                              ? "Importing..."
                              : "Import to Library"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!searching && query.trim() && items.length === 0 && (
            <p className="mt-4 text-center text-xs text-primary-muted">
              No matching open-licensed images found for &ldquo;{query}&rdquo;. Try broader terms.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
