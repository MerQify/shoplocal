"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/Icon";

export interface GenerationDetails {
  succeeded?: Array<{ id: string; name: string; source: string; imageKey: string }>;
  failed?: Array<{ id: string; name: string; error: string }>;
  skipped?: Array<{ id: string; name: string; reason: string }>;
}

export interface GenerationOutcome {
  tone: "ok" | "error";
  message: string;
  processed?: number;
  succeeded?: number;
  skipped?: number;
  failed?: number;
  budgetRefused?: boolean;
  details?: GenerationDetails;
}

/**
 * Extracts active filter parameters from the browser URL for "filtered" mode.
 */
function getActiveFiltersFromUrl(): Record<string, unknown> | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const filters: Record<string, unknown> = {};

  const status = params.get("status");
  if (status && status !== "all") {
    filters.isActive = status === "active";
  }

  const category = params.get("category");
  if (category && category !== "all") {
    filters.categoryIds = [category];
  }

  const brand = params.get("brand");
  if (brand && brand !== "all") {
    filters.brandId = brand === "none" ? null : brand;
  }

  const q = params.get("q");
  if (q && q.trim()) {
    filters.search = q.trim();
  }

  const restriction = params.get("restriction");
  if (restriction && restriction !== "all") {
    filters.restriction = restriction;
  }

  const stock = params.get("stock");
  if (stock && stock !== "all") {
    filters.stockMode = stock;
  }

  const needs = params.get("needs");
  if (needs && needs !== "all") {
    filters.needs = needs;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Enhanced product image generation control for the Products catalogue page.
 *
 * Supports:
 * - Generating images for explicitly selected products (default when products are checked)
 * - Generating images for all products with missing images
 * - Generating images for currently filtered products with missing images
 * - Retrying failed image generations
 * - Overwrite toggle (off by default to prevent overwriting existing real photos)
 * - Handles empty selections, duplicate requests, partial failures, and AI budget refusals
 */
export function BackfillImagesButton() {
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [useOpenFoodFacts, setUseOpenFoodFacts] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [targetMode, setTargetMode] = useState<
    "auto" | "selected" | "all_missing" | "filtered" | "retry_failed"
  >("auto");
  const [result, setResult] = useState<GenerationOutcome | null>(null);
  const router = useRouter();

  // Listen to product checkbox selection changes across the page
  useEffect(() => {
    const updateSelection = () => {
      const checked = document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][name="productId"]:checked',
      );
      const ids = Array.from(checked).map((el) => el.value);
      setSelectedIds(ids);
    };

    updateSelection();
    document.addEventListener("change", updateSelection);
    return () => document.removeEventListener("change", updateSelection);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);

    // Read directly from DOM to ensure immediate consistency with user check action
    const checked = document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="productId"]:checked',
    );
    const activeSelectedIds =
      checked.length > 0 ? Array.from(checked).map((el) => el.value) : selectedIds;

    let effectiveMode: "selected" | "all_missing" | "filtered" | "retry_failed";
    if (targetMode === "auto") {
      effectiveMode = activeSelectedIds.length > 0 ? "selected" : "all_missing";
    } else {
      effectiveMode = targetMode;
    }

    // Reject empty selection if in selected or retry mode
    if (
      (effectiveMode === "selected" || effectiveMode === "retry_failed") &&
      activeSelectedIds.length === 0
    ) {
      setResult({
        tone: "error",
        message:
          "No products selected. Select products with checkboxes, or choose 'All with missing images'.",
      });
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        mode: effectiveMode,
        productIds:
          effectiveMode === "selected" || effectiveMode === "retry_failed"
            ? activeSelectedIds
            : undefined,
        filters: effectiveMode === "filtered" ? getActiveFiltersFromUrl() : undefined,
        useOpenFoodFacts,
        overwriteExisting,
        retryFailed: effectiveMode === "retry_failed",
      };

      const res = await fetch("/api/admin/product-images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        processed?: number;
        succeeded?: number;
        skipped?: number;
        failed?: number;
        budgetRefused?: boolean;
        details?: GenerationDetails;
      };

      if (!res.ok) {
        setResult({
          tone: "error",
          message: data.error ?? `The image generation was refused (${res.status}).`,
        });
        return;
      }

      const generated = data.succeeded ?? data.processed ?? 0;

      // Handle AI budget refusal
      if (data.budgetRefused) {
        setResult({
          tone: "error",
          message: `${data.message ?? "The AI allowance stopped this run."}${generated ? ` (${generated} generated before it stopped)` : ""}`,
          processed: generated,
          budgetRefused: true,
          details: data.details,
        });
        router.refresh();
        return;
      }

      // Handle standard or partial success
      const msg = `${data.message ?? "Backfill complete"}${generated ? ` (${generated} generated)` : ""}`;

      setResult({
        tone: "ok",
        message: msg,
        processed: generated,
        succeeded: data.succeeded ?? data.processed,
        skipped: data.skipped,
        failed: data.failed,
        details: data.details,
      });

      router.refresh();
    } catch {
      setResult({ tone: "error", message: "Failed to start backfill." });
    } finally {
      setLoading(false);
    }
  };

  const hasSelection = selectedIds.length > 0;
  const buttonLabel = loading
    ? "Generating..."
    : hasSelection && (targetMode === "selected" || targetMode === "auto")
      ? `Auto-fill Missing Images (${selectedIds.length} selected)`
      : "Auto-fill Missing Images";

  return (
    <div className="relative flex flex-col gap-2">
      <div className="inline-flex items-center gap-1">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-action px-4 py-2.5 text-sm font-bold text-white transition hover:bg-action-hover disabled:opacity-50"
        >
          <Icon name="sparkles" className="h-4 w-4" />
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={() => setShowOptions((prev) => !prev)}
          disabled={loading}
          aria-label="Image generation options"
          title="Image generation options"
          className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white p-2.5 text-primary transition hover:bg-surface-muted disabled:opacity-50"
        >
          <Icon
            name="chevron-down"
            className={`h-4 w-4 transition-transform ${showOptions ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Expandable Options Drawer */}
      {showOptions && (
        <div className="z-20 w-80 rounded-2xl border border-black/10 bg-white p-4 shadow-lg space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-muted">
            Target Products
          </p>
          <div className="space-y-1.5 text-xs text-primary">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="targetMode"
                value="selected"
                checked={targetMode === "selected" || (targetMode === "auto" && hasSelection)}
                onChange={() => setTargetMode("selected")}
                className="accent-action"
              />
              <span>
                Selected products <strong>({selectedIds.length})</strong>
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="targetMode"
                value="filtered"
                checked={targetMode === "filtered"}
                onChange={() => setTargetMode("filtered")}
                className="accent-action"
              />
              <span>Filtered products with missing images</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="targetMode"
                value="all_missing"
                checked={targetMode === "all_missing" || (targetMode === "auto" && !hasSelection)}
                onChange={() => setTargetMode("all_missing")}
                className="accent-action"
              />
              <span>All products with missing images</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="targetMode"
                value="retry_failed"
                checked={targetMode === "retry_failed"}
                onChange={() => setTargetMode("retry_failed")}
                className="accent-action"
              />
              <span>Retry failed image generations</span>
            </label>
          </div>

          <div className="border-t border-black/10 pt-2.5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-primary-muted">
              Source &amp; Safety
            </p>
            <label className="flex items-center gap-2 text-xs font-medium text-primary">
              <input
                type="checkbox"
                checked={useOpenFoodFacts}
                onChange={(e) => setUseOpenFoodFacts(e.target.checked)}
                disabled={loading}
                className="h-3.5 w-3.5 rounded border-black/20 accent-action"
              />
              Use Open Food Facts photos
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-primary">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                disabled={loading}
                className="h-3.5 w-3.5 rounded border-black/20 accent-action"
              />
              Overwrite existing images
            </label>
          </div>
        </div>
      )}

      {/* Inline simplified checkbox matching original layout */}
      {!showOptions && (
        <label className="flex items-center gap-2 text-xs font-medium text-primary-muted">
          <input
            type="checkbox"
            checked={useOpenFoodFacts}
            onChange={(event) => setUseOpenFoodFacts(event.target.checked)}
            disabled={loading}
            className="h-3.5 w-3.5 rounded border-black/20 accent-action"
          />
          Use Open Food Facts photos
        </label>
      )}

      {/* Result feedback */}
      {result && (
        <div
          role={result.tone === "error" ? "alert" : "status"}
          className={
            result.tone === "error"
              ? "rounded-xl bg-danger-tint px-4 py-3 text-sm font-medium text-danger space-y-1"
              : "rounded-xl bg-action-tint px-4 py-3 text-sm font-medium text-primary space-y-1"
          }
        >
          <p>{result.message}</p>
          {result.details && (
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
              {(result.details.succeeded?.length ?? 0) > 0 && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                  {result.details.succeeded?.length} generated
                </span>
              )}
              {(result.details.skipped?.length ?? 0) > 0 && (
                <span className="rounded bg-black/5 px-2 py-0.5 text-black/70">
                  {result.details.skipped?.length} skipped (already has image)
                </span>
              )}
              {(result.details.failed?.length ?? 0) > 0 && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
                  {result.details.failed?.length} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
