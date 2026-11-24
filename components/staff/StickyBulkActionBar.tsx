"use client";

import { useActionState, useEffect, useState } from "react";
import { bulkProductAction } from "@/features/admin/product-restrictions";
import { saveBulkQuantities } from "@/features/admin/product-quantities";
import { saveLowStockDefaultAction } from "@/features/admin/catalogue";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  LOW_STOCK_DEFAULT_IDLE,
  MAX_LOW_STOCK_THRESHOLD,
} from "@/lib/low-stock";
import {
  BULK_ACTION_LABELS,
  BULK_PRODUCTS_FORM_ID,
  initialBulkActionState,
} from "@/lib/product-restriction-form";
import {
  BULK_ACTIONS,
  BULK_SKIP_LABELS,
  ENABLE_CONFIRMATION_TEXT,
  MAX_RESTRICTION_REASON_LENGTH,
  RESTRICTION_LABELS,
  summarisePlanRisks,
  type BulkAction,
  type BulkPlanEntry,
} from "@/lib/product-restriction";
import {
  BULK_QUANTITY_FORM_ID,
  MAX_BULK_QUANTITY,
  ORIG_PREFIX,
  QTY_PREFIX,
  initialBulkQuantityState,
} from "@/lib/bulk-quantity";
import { inputClass, labelClass } from "@/lib/form-classes";
import { toCategoryOptionGroups, type CategoryOption } from "@/lib/catalogue-form";
import { Icon } from "@/components/icons/Icon";

function quantityInputs(): HTMLInputElement[] {
  return [
    ...document.querySelectorAll<HTMLInputElement>(
      `input[form="${BULK_QUANTITY_FORM_ID}"][name^="${QTY_PREFIX}"]`,
    ),
  ];
}

function originalOf(input: HTMLInputElement): string {
  const id = input.name.slice(QTY_PREFIX.length);
  const orig = document.querySelector<HTMLInputElement>(
    `input[form="${BULK_QUANTITY_FORM_ID}"][name="${ORIG_PREFIX}${id}"]`,
  );
  return (orig?.value ?? "").trim();
}

function countChanged(): number {
  return quantityInputs().filter((input) => {
    const value = input.value.trim();
    return value !== "" && value !== originalOf(input);
  }).length;
}

export function StickyBulkActionBar({
  categories = [],
  lowStockDefault = DEFAULT_LOW_STOCK_THRESHOLD,
  isStoreAdmin = false,
}: {
  categories?: readonly CategoryOption[];
  lowStockDefault?: number;
  isStoreAdmin?: boolean;
}) {
  const [productState, productAction, productPending] = useActionState(
    bulkProductAction,
    initialBulkActionState,
  );
  const [quantityState, quantityAction, quantityPending] = useActionState(
    saveBulkQuantities,
    initialBulkQuantityState,
  );
  const [lowStockState, lowStockAction, lowStockPending] = useActionState(
    saveLowStockDefaultAction,
    LOW_STOCK_DEFAULT_IDLE,
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [prevPhase, setPrevPhase] = useState(productState.phase);
  const [selectedAction, setSelectedAction] = useState<BulkAction>("ENABLE");
  const [changedQuantities, setChangedQuantities] = useState(0);
  const [setTo, setSetTo] = useState("");

  // Sync selection state during render when phase transitions
  if (productState.phase !== prevPhase) {
    setPrevPhase(productState.phase);
    if (productState.phase === "applied") {
      setSelectedIds(new Set());
    } else if (productState.phase === "preview" && productState.productIds.length > 0) {
      const next = new Set(selectedIds);
      for (const id of productState.productIds) next.add(id);
      setSelectedIds(next);
    }
  }

  // Listen for checkbox changes on the page
  useEffect(() => {
    const handleCheckboxChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (
        target &&
        target.type === "checkbox" &&
        target.getAttribute("form") === BULK_PRODUCTS_FORM_ID &&
        target.name === "productId"
      ) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (target.checked) {
            next.add(target.value);
          } else {
            next.delete(target.value);
          }
          return next;
        });
      }
    };

    document.addEventListener("change", handleCheckboxChange);
    return () => document.removeEventListener("change", handleCheckboxChange);
  }, []);

  // Track quantity inputs
  useEffect(() => {
    const refresh = () => {
      for (const input of quantityInputs()) {
        const value = input.value.trim();
        input.toggleAttribute("data-changed", value !== "" && value !== originalOf(input));
      }
      setChangedQuantities(countChanged());
    };
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.getAttribute("form") === BULK_QUANTITY_FORM_ID) refresh();
    };
    document.addEventListener("input", onInput);
    refresh();
    return () => document.removeEventListener("input", onInput);
  }, [quantityState]);

  const clearSelection = () => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="productId"][form="${BULK_PRODUCTS_FORM_ID}"]`,
    );
    checkboxes.forEach((box) => {
      box.checked = false;
    });
    const headerCb = document.querySelector<HTMLInputElement>("#select-all-header");
    if (headerCb) headerCb.checked = false;
    setSelectedIds(new Set());
  };

  const applyToSelected = () => {
    const value = setTo.trim();
    if (!/^[0-9]{1,7}$/.test(value) || Number(value) > MAX_BULK_QUANTITY) return;
    const selected = document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="productId"][form="${BULK_PRODUCTS_FORM_ID}"]:checked`,
    );
    for (const box of selected) {
      const input = document.querySelector<HTMLInputElement>(
        `input[form="${BULK_QUANTITY_FORM_ID}"][name="${QTY_PREFIX}${box.value}"]`,
      );
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  };

  const discardQuantities = () => {
    for (const input of quantityInputs()) {
      input.value = originalOf(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const hasSelection = selectedIds.size > 0;
  const hasChanges = changedQuantities > 0;
  const isVisible = hasSelection || hasChanges;

  return (
    <>
      {/* Sticky Bottom Floating Toolbar */}
      <aside
        aria-label="Bulk actions toolbar"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-5xl rounded-2xl bg-primary text-white shadow-2xl px-5 py-3 border border-white/10 transition-all duration-300 ease-out flex flex-wrap items-center justify-between gap-4 ${
          isVisible
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-24 opacity-0 pointer-events-none"
        }`}
      >
        {/* Selection Badge & Reset */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-action text-white">
              <Icon name="check" className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-white">
              {selectedIds.size} {selectedIds.size === 1 ? "product" : "products"} selected
            </span>
          </div>
          {hasSelection && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-white/70 hover:text-white underline transition"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Action Controls Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status & Category Actions Form */}
          <form
            id={BULK_PRODUCTS_FORM_ID}
            action={productAction}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="intent" value="preview" />
            <select
              name="bulkAction"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as BulkAction)}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-action"
            >
              {BULK_ACTIONS.map((value) => (
                <option key={value} value={value} className="bg-primary text-white">
                  {BULK_ACTION_LABELS[value]}
                </option>
              ))}
            </select>

            {selectedAction === "ENABLE" && categories.length > 0 && (
              <select
                name="destinationCategoryId"
                className="max-w-[180px] truncate rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-action"
              >
                <option value="" className="bg-primary text-white">
                  Keep current category
                </option>
                {toCategoryOptionGroups(categories).map((group) => (
                  <optgroup
                    key={group.parent.id}
                    label={group.parent.name}
                    className="bg-primary text-white/70 font-bold"
                  >
                    <option value={group.parent.id} className="bg-primary text-white">
                      All of {group.parent.name}
                    </option>
                    {group.children.map((child) => (
                      <option key={child.id} value={child.id} className="bg-primary text-white">
                        {child.name}
                        {!child.isActive && " (inactive)"}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}

            <button
              type="submit"
              disabled={!hasSelection || productPending}
              className="rounded-xl bg-action px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-action/90 disabled:opacity-50"
            >
              {productPending ? "Planning…" : "Apply action"}
            </button>
          </form>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px bg-white/20" />

          {/* Stock Counts Form */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70 font-medium">Set qty:</span>
            <input
              type="number"
              min={0}
              max={MAX_BULK_QUANTITY}
              value={setTo}
              onChange={(e) => setSetTo(e.target.value)}
              placeholder="0"
              className="w-16 rounded-xl border border-white/20 bg-white/10 px-2 py-1.5 text-center text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-action"
            />
            <button
              type="button"
              onClick={applyToSelected}
              disabled={!hasSelection || !setTo}
              className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/30 disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          {/* Save Changed Quantities Button */}
          {hasChanges && (
            <div className="flex items-center gap-1.5 pl-2">
              <form id={BULK_QUANTITY_FORM_ID} action={quantityAction} className="inline">
                <button
                  type="submit"
                  disabled={quantityPending}
                  className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {quantityPending
                    ? "Saving…"
                    : `Save ${changedQuantities} ${changedQuantities === 1 ? "count" : "counts"}`}
                </button>
              </form>
              <button
                type="button"
                onClick={discardQuantities}
                className="text-xs text-white/70 hover:text-white transition px-1"
                title="Discard unsaved changes"
              >
                ✕
              </button>
            </div>
          )}

          {/* Low-Stock Alert At Form */}
          {isStoreAdmin && (
            <>
              <div className="hidden md:block h-5 w-px bg-white/20" />
              <form action={lowStockAction} className="flex items-center gap-2">
                <label
                  htmlFor="sticky-low-stock-input"
                  className="text-xs text-white/70 font-medium whitespace-nowrap"
                >
                  Low-stock alert at:
                </label>
                <input
                  id="sticky-low-stock-input"
                  type="number"
                  name="lowStockThreshold"
                  min={0}
                  max={MAX_LOW_STOCK_THRESHOLD}
                  step={1}
                  required
                  defaultValue={lowStockDefault}
                  className="w-14 rounded-xl border border-white/20 bg-white/10 px-2 py-1.5 text-center text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-action"
                />
                <button
                  type="submit"
                  disabled={lowStockPending}
                  className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/30 disabled:opacity-50 whitespace-nowrap"
                >
                  {lowStockPending ? "Saving…" : "Save default"}
                </button>
              </form>
            </>
          )}
        </div>
      </aside>

      {/* Preview Confirmation Modal (if phase is preview) */}
      {productState.phase === "preview" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <PreviewPlan
              state={productState}
              action={productAction}
              pending={productPending}
              categories={categories}
            />
          </div>
        </div>
      )}

      {/* Applied Feedback Notice */}
      {productState.phase === "applied" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-emerald-600 text-white px-5 py-2.5 shadow-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="check" className="h-4 w-4" />
          {productState.result.updated.length} products updated successfully.
        </div>
      )}

      {/* Low-stock default notification */}
      {lowStockState.message && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-action text-white px-5 py-2.5 shadow-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="check" className="h-4 w-4" />
          {lowStockState.message}
        </div>
      )}
      {lowStockState.error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-danger text-white px-5 py-2.5 shadow-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="circle-alert" className="h-4 w-4" />
          {lowStockState.error}
        </div>
      )}
    </>
  );
}

function PreviewPlan({
  state,
  action,
  pending,
  categories,
}: {
  state: Extract<typeof initialBulkActionState, { phase: "preview" }>;
  action: (payload: FormData) => void;
  pending: boolean;
  categories: readonly CategoryOption[];
}) {
  const skipReason = (e: BulkPlanEntry) => (e.outcome.kind === "SKIPPED" ? e.outcome.reason : null);
  const willUpdate = state.plan.filter(
    (e) => e.outcome.kind !== "SKIPPED" && e.outcome.kind !== "NO_CHANGE",
  ).length;
  const skippedRestricted = state.plan.filter(
    (e) => skipReason(e) === "HARD_BLOCK" || skipReason(e) === "ADMIN_ONLY",
  );
  const confirmable = state.plan.filter((e) => skipReason(e) === "NEEDS_CONFIRMATION");
  const { hardBlocked, overridable } = summarisePlanRisks(state.plan);
  const isEnable = state.action === "ENABLE";

  const targetCategory = state.destinationCategoryId
    ? categories.find((c) => c.id === state.destinationCategoryId)
    : null;

  return (
    <div className="space-y-4">
      <div className="border-b border-black/10 pb-3">
        <h3 className="text-lg font-bold text-primary">Confirm Bulk Action</h3>
        <p className="text-sm text-primary-muted">
          <strong>{BULK_ACTION_LABELS[state.action]}</strong>: {state.plan.length} selected,{" "}
          {willUpdate} will change.
        </p>
        {targetCategory && (
          <p className="text-xs font-semibold text-action mt-1">
            Destination category: <strong>{targetCategory.name}</strong>
          </p>
        )}
      </div>

      {isEnable && skippedRestricted.length > 0 && (
        <div className="rounded-xl bg-danger-tint p-3 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-danger">
            Restricted products — will be skipped
          </p>
          <ul className="text-xs text-danger space-y-0.5 max-h-32 overflow-y-auto">
            {skippedRestricted.map((e) => (
              <li key={e.productId}>• {e.name ?? e.productId}</li>
            ))}
          </ul>
        </div>
      )}

      {!isEnable && hardBlocked.length + overridable.length > 0 && (
        <div className="rounded-xl bg-surface-muted/60 p-3 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Restricted products in selection (they stay restricted)
          </p>
          <ul className="text-xs text-primary-muted space-y-0.5 max-h-32 overflow-y-auto">
            {[...hardBlocked, ...overridable].map((e) => (
              <li key={e.productId}>• {e.name ?? e.productId}</li>
            ))}
          </ul>
        </div>
      )}

      {confirmable.length > 0 && (
        <div className="rounded-xl bg-surface-muted/60 p-3 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-danger">
            Warning: restricted products — made available only if confirmed
          </p>
          <ul className="text-xs text-danger space-y-0.5 max-h-32 overflow-y-auto">
            {confirmable.map((e) => (
              <li key={e.productId}>• {e.name ?? e.productId}</li>
            ))}
          </ul>
        </div>
      )}

      <form action={action} className="space-y-3 pt-2">
        <input type="hidden" name="bulkAction" value={state.action} />
        {state.destinationCategoryId && (
          <input type="hidden" name="destinationCategoryId" value={state.destinationCategoryId} />
        )}
        {state.productIds.map((id) => (
          <input key={id} type="hidden" name="productId" value={id} />
        ))}

        {confirmable.length > 0 && (
          <div className="space-y-2 rounded-xl border border-black/10 p-3 bg-surface-muted/30">
            <label className="flex items-start gap-2 text-sm text-primary">
              <input type="checkbox" name="confirmed" required className="mt-0.5 h-4 w-4" />
              <span>
                {ENABLE_CONFIRMATION_TEXT} (applies to every product requiring confirmation).
              </span>
            </label>
            <label className={labelClass} htmlFor="bulk-reason">
              Reason for override (required)
            </label>
            <input
              id="bulk-reason"
              name="reason"
              required
              maxLength={MAX_RESTRICTION_REASON_LENGTH}
              className={inputClass}
              placeholder="e.g. Verified appropriate licensing"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            name="intent"
            value="reset"
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            name="intent"
            value="apply"
            disabled={pending || willUpdate === 0}
            className="rounded-2xl bg-action px-5 py-2 text-sm font-bold text-white transition hover:bg-action/90 disabled:opacity-50"
          >
            {pending ? "Applying…" : "Confirm & Apply"}
          </button>
        </div>
      </form>
    </div>
  );
}
