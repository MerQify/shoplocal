"use client";

import { useState, useTransition } from "react";
import {
  approveLibraryAction,
  listCategoriesForAssign,
  rejectLibraryAction,
  searchLibraryAction,
  searchProductsForAssign,
} from "@/features/admin/image-library";
import type { HubAsset, HubPage, HubStatus } from "@/lib/image-hub/client";
import { librarySearchSort } from "@/lib/image-hub/search-sort";
import { ImageLibraryUploader } from "@/components/staff/ImageLibraryUploader";
import { ImageDiscoveryPanel } from "@/components/staff/ImageDiscoveryPanel";
import {
  assignLibraryAsset,
  libraryContentUrl,
  type AssignTarget,
} from "@/components/staff/library-assign";

/**
 * #1671 — the interactive part of `/staff/image-library`.
 *
 * Imports only server actions, types and pure constants — never `lib/storage`, `lib/config` or the
 * hub client's request path, which would ship the signer or a key to the browser. Thumbnails come
 * from the same-origin content route, so the hub bucket's host never needs to be in the CSP.
 */

export interface ImageLibraryClientProps {
  initialPage: HubPage;
  initialError: string | null;
  q: string;
  status: HubStatus | "";
  /** Store admins (and platform admins) approve and reject; staff never see those controls. */
  canReview: boolean;
  /** Category assignment is store-admin only, like every other category image write. */
  canAssignCategory: boolean;
}

const STATUS_LABELS: Record<HubStatus, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const LICENCE_LABELS: Record<string, string> = {
  OWNER_SUPPLIED: "Our own image",
  SUPPLIER_PERMISSION: "Supplier permission",
  CC0: "CC0",
  PDM: "Public domain",
  CC_BY: "CC BY",
  CC_BY_SA: "CC BY-SA",
  ODBL: "ODbL",
  AI_GENERATED: "AI-generated",
};

export function ImageLibraryClient({
  initialPage,
  initialError,
  q,
  status,
  canReview,
  canAssignCategory,
}: ImageLibraryClientProps) {
  const [items, setItems] = useState<HubAsset[]>(initialPage.items);
  const [cursor, setCursor] = useState<string | null>(initialPage.nextCursor);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, startLoading] = useTransition();

  function loadMore() {
    if (!cursor) return;
    startLoading(async () => {
      const next = await searchLibraryAction({
        q: q || undefined,
        status: status || undefined,
        sort: librarySearchSort(q),
        cursor,
      });
      if (!next.ok) {
        setError(next.message);
        return;
      }
      setItems((current) => [...current, ...next.value.items]);
      setCursor(next.value.nextCursor);
    });
  }

  function replace(asset: HubAsset) {
    setItems((current) => current.map((item) => (item.id === asset.id ? asset : item)));
  }

  return (
    <div className="space-y-6">
      <ImageLibraryUploader onUploaded={(asset) => setItems((current) => [asset, ...current])} />
      <ImageDiscoveryPanel onImported={(asset) => setItems((current) => [asset, ...current])} />

      <form method="GET" className="flex flex-wrap items-end gap-3" role="search">
        <div>
          <label
            htmlFor="library-q"
            className="mb-1 block text-xs font-semibold text-primary-muted"
          >
            Search
          </label>
          <input
            id="library-q"
            name="q"
            defaultValue={q}
            placeholder="Title, alt text or keyword"
            className="w-64 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="library-status"
            className="mb-1 block text-xs font-semibold text-primary-muted"
          >
            Status
          </label>
          <select
            id="library-status"
            name="status"
            defaultValue={status}
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-primary focus:border-action focus:outline-none"
          >
            <option value="">All</option>
            <option value="PENDING_REVIEW">Pending review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white hover:bg-action-hover"
        >
          Apply
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-danger-tint p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {items.length === 0 && !error ? (
        <p className="text-sm text-primary-muted">No images match.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((asset) => (
            <LibraryCard
              key={asset.id}
              asset={asset}
              canReview={canReview}
              canAssignCategory={canAssignCategory}
              onChange={replace}
            />
          ))}
        </ul>
      )}

      {cursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-muted disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * #1682 — the hub refuses to reject an image still used on a product or category (409 `in_use`), so
 * a live product photo can't be withdrawn from under the shop. Say what to do instead of the code.
 */
const IN_USE_MESSAGE =
  "This image is used on a product or category. Remove it there first, then reject it.";

function LibraryCard({
  asset,
  canReview,
  canAssignCategory,
  onChange,
}: {
  asset: HubAsset;
  canReview: boolean;
  canAssignCategory: boolean;
  onChange: (asset: HubAsset) => void;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  /** #1682 — an approved image's reject controls stay folded behind "Reject…" until asked for. */
  const [rejectingApproved, setRejectingApproved] = useState(false);
  const [pending, startTransition] = useTransition();

  function approve() {
    setMessage(null);
    startTransition(async () => {
      const result = await approveLibraryAction(asset.id);
      if (result.ok) onChange(result.value);
      else setMessage(result.message);
    });
  }

  function reject() {
    setMessage(null);
    if (!reason.trim()) {
      setMessage("Give a reason for rejecting it.");
      return;
    }
    startTransition(async () => {
      const result = await rejectLibraryAction(asset.id, reason);
      if (result.ok) {
        setRejectingApproved(false);
        onChange(result.value);
      } else setMessage(result.code === "in_use" ? IN_USE_MESSAGE : result.message);
    });
  }

  const rejectControls = (
    <>
      <label className="sr-only" htmlFor={`reason-${asset.id}`}>
        Reason for rejecting
      </label>
      <input
        id={`reason-${asset.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for rejecting"
        className="w-full rounded-lg border border-black/15 px-2.5 py-1.5 text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
      />
      <button
        type="button"
        onClick={reject}
        disabled={pending}
        className="w-full rounded-lg border border-danger px-3 py-1.5 font-semibold text-danger hover:bg-danger-tint disabled:opacity-50"
      >
        Reject
      </button>
    </>
  );

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
      <img
        src={libraryContentUrl(asset.id)}
        alt={asset.alt ?? asset.title}
        loading="lazy"
        className="aspect-square w-full bg-surface-muted object-contain"
      />
      <div className="flex flex-1 flex-col gap-1 p-3 text-xs">
        <p className="truncate text-sm font-bold text-primary" title={asset.title}>
          {asset.title}
        </p>
        <p className="text-primary-muted">
          <span
            className={
              asset.status === "APPROVED"
                ? "font-semibold text-action"
                : asset.status === "REJECTED"
                  ? "font-semibold text-danger"
                  : "font-semibold text-accent"
            }
          >
            {STATUS_LABELS[asset.status]}
          </span>
          {" · "}
          {LICENCE_LABELS[asset.licence] ?? asset.licence}
        </p>
        {asset.attribution && <p className="text-primary-muted">{asset.attribution}</p>}
        {asset.status === "REJECTED" && asset.rejectionReason && (
          <p className="text-danger">Rejected: {asset.rejectionReason}</p>
        )}

        {canReview && asset.status === "PENDING_REVIEW" && (
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={approve}
              disabled={pending}
              className="w-full rounded-lg bg-action px-3 py-1.5 font-semibold text-white hover:bg-action-hover disabled:opacity-50"
            >
              Approve
            </button>
            {rejectControls}
          </div>
        )}

        {asset.status === "APPROVED" && !assigning && (
          <button
            type="button"
            onClick={() => setAssigning(true)}
            className="mt-2 w-full rounded-lg border border-action px-3 py-1.5 font-semibold text-action hover:bg-action-tint"
          >
            Assign…
          </button>
        )}
        {asset.status === "APPROVED" && assigning && (
          <AssignPanel
            asset={asset}
            canAssignCategory={canAssignCategory}
            onClose={() => setAssigning(false)}
          />
        )}

        {canReview && asset.status === "APPROVED" && !rejectingApproved && (
          <button
            type="button"
            onClick={() => setRejectingApproved(true)}
            className="mt-1 w-full rounded-lg px-3 py-1 font-semibold text-danger hover:bg-danger-tint"
          >
            Reject…
          </button>
        )}
        {canReview && asset.status === "APPROVED" && rejectingApproved && (
          <div className="mt-2 space-y-2">{rejectControls}</div>
        )}

        {message && (
          <p role="alert" className="text-danger">
            {message}
          </p>
        )}
      </div>
    </li>
  );
}

function AssignPanel({
  asset,
  canAssignCategory,
  onClose,
}: {
  asset: HubAsset;
  canAssignCategory: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"product" | "category">("product");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [target, setTarget] = useState<AssignTarget | null>(null);
  const [mode, setMode] = useState<"primary" | "additional">("primary");
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function chooseKind(next: "product" | "category") {
    setKind(next);
    setTarget(null);
    setOptions([]);
    setQuery("");
    if (next === "category") {
      startTransition(async () => setOptions(await listCategoriesForAssign()));
    }
  }

  function searchProducts() {
    startTransition(async () => setOptions(await searchProductsForAssign(query)));
  }

  function assign() {
    if (!target) return;
    setStatus(null);
    startTransition(async () => {
      const result = await assignLibraryAsset(asset.id, target, mode, (text) =>
        setStatus({ tone: "ok", text }),
      );
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      setStatus(
        result.warning
          ? { tone: "warn", text: result.warning }
          : { tone: "ok", text: `Assigned to ${target.name}.` },
      );
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-black/10 bg-surface-muted p-2">
      {canAssignCategory && (
        <div className="flex gap-2" role="radiogroup" aria-label="Assign to">
          {(["product", "category"] as const).map((option) => (
            <label key={option} className="flex items-center gap-1 text-primary">
              <input
                type="radio"
                name={`kind-${asset.id}`}
                checked={kind === option}
                onChange={() => chooseKind(option)}
              />
              {option === "product" ? "Product" : "Category"}
            </label>
          ))}
        </div>
      )}

      {kind === "product" && (
        <div className="flex gap-1">
          <label className="sr-only" htmlFor={`product-q-${asset.id}`}>
            Find a product
          </label>
          <input
            id={`product-q-${asset.id}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a product"
            className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-2 py-1 text-primary placeholder:text-primary-subtle focus:border-action focus:outline-none"
          />
          <button
            type="button"
            onClick={searchProducts}
            disabled={pending || query.trim().length < 2}
            className="rounded-lg bg-primary px-2 py-1 font-semibold text-white disabled:opacity-50"
          >
            Find
          </button>
        </div>
      )}

      {options.length > 0 && (
        <select
          aria-label={kind === "product" ? "Product" : "Category"}
          value={target?.id ?? ""}
          onChange={(event) => {
            const chosen = options.find((option) => option.id === event.target.value);
            setTarget(chosen ? { kind, id: chosen.id, name: chosen.name } : null);
          }}
          className="w-full rounded-lg border border-black/15 bg-white px-2 py-1 text-primary"
        >
          <option value="">Choose…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}

      {kind === "product" && target && (
        <div className="flex gap-2" role="radiogroup" aria-label="Use as">
          {(["primary", "additional"] as const).map((option) => (
            <label key={option} className="flex items-center gap-1 text-primary">
              <input
                type="radio"
                name={`mode-${asset.id}`}
                checked={mode === option}
                onChange={() => setMode(option)}
              />
              {option === "primary" ? "Main image" : "Extra image"}
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={assign}
          disabled={pending || !target}
          className="flex-1 rounded-lg bg-action px-3 py-1.5 font-semibold text-white hover:bg-action-hover disabled:opacity-50"
        >
          {pending ? "Working…" : "Assign"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-black/15 bg-white px-3 py-1.5 font-semibold text-primary"
        >
          Close
        </button>
      </div>

      {status && (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={
            status.tone === "error"
              ? "text-danger"
              : status.tone === "warn"
                ? "text-accent"
                : "text-action"
          }
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
