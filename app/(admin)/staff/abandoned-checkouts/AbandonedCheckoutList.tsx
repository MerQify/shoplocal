import Link from "next/link";
import { formatPrice } from "@/components/product/format-price";
import type { AbandonedCheckoutView } from "@/lib/abandoned-checkouts-service";
import {
  allocateAction,
  contactAction,
  removeIncentiveAction,
  reviewAction,
  sendAction,
} from "./actions";

/**
 * #1554, rebuilt for #1732/#1733 — one card per abandoned checkout. Plain forms posting to Server
 * Actions (no client JS); "Preview" is a GET link, so it can never send or change anything.
 */

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-surface-muted text-primary",
  REVIEWED: "bg-accent-tint text-primary",
  EMAIL_SENT: "bg-action/10 text-action",
  RECOVERED: "bg-action/10 text-action",
  EXPIRED: "bg-surface-muted text-primary-muted",
  SUPPRESSED: "bg-danger-tint text-danger",
};

const button =
  "rounded-xl border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-muted";
const primaryButton =
  "rounded-xl bg-action px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90";
const input = "rounded-xl border border-black/20 bg-white px-2 py-1.5 text-xs text-primary";

function Row({
  row,
  codes,
  previewCodeId,
}: {
  row: AbandonedCheckoutView;
  codes: { id: string; label: string }[];
  previewCodeId: string;
}) {
  const closed = row.status === "RECOVERED" || row.status === "SUPPRESSED";
  const canIncentivise = !row.isGuest && !closed;
  const canSendFirst = row.blockedReason === null;
  return (
    <div
      id={row.orderNumber}
      className="scroll-mt-24 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold text-primary">
            <Link
              href={`/staff/orders/${encodeURIComponent(row.orderNumber)}`}
              className="underline"
            >
              {row.orderNumber}
            </Link>{" "}
            <span
              className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[row.status] ?? STATUS_TONE.PENDING}`}
            >
              {row.statusLabel}
            </span>
          </p>
          <p className="text-xs text-primary-muted">
            {row.reasonLabel} · {when(row.abandonedAt)} ·{" "}
            {row.isGuest ? "Guest" : (row.customerName ?? "Customer")}
            {row.email ? ` · ${row.email}` : ""} ·{" "}
            {row.isGuest ? "no consent" : row.hasConsent ? "opted in" : "not opted in"}
          </p>
          {row.recoveredOrderNumber && (
            <p className="text-xs font-bold text-action">Recovered: {row.recoveredOrderNumber}</p>
          )}
          {!row.recoveredOrderNumber && row.boughtLater && (
            <p className="text-xs font-bold text-action">Bought later: {row.boughtLater}</p>
          )}
          {row.suppressReason && (
            <p className="text-xs text-primary-muted">Don&apos;t contact: {row.suppressReason}</p>
          )}
        </div>
        <p className="text-sm text-primary">
          <strong>{formatPrice(row.totalPence)}</strong>
          {row.isDelivery ? ` · delivery ${formatPrice(row.deliveryFeePence)}` : " · collection"}
        </p>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-primary">
        {row.items.map((item, i) => (
          <li key={`${item.productName}-${i}`} className="flex flex-wrap justify-between gap-2">
            <span>
              {item.quantity} × {item.productName}{" "}
              <span className={item.available ? "text-primary-muted" : "font-bold text-danger"}>
                · {item.availability}
              </span>
            </span>
            <span className="text-primary-muted">
              {formatPrice(item.originalUnitPence)}
              {item.currentUnitPence !== null && item.currentUnitPence !== item.originalUnitPence
                ? ` → now ${formatPrice(item.currentUnitPence)}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      {row.bundles.length > 0 && (
        <p className="mt-2 text-xs text-primary-muted">
          Already qualifies for: {row.bundles.join(", ")}
        </p>
      )}

      <div className="mt-3 border-t border-black/5 pt-3 text-xs text-primary-muted">
        {row.incentive ? (
          <form action={removeIncentiveAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="orderNumber" value={row.orderNumber} />
            <span>
              Incentive: <strong className="text-primary">{row.incentive.code}</strong> (
              {row.incentive.summary}
              {row.incentive.endsAt ? `, until ${when(row.incentive.endsAt)}` : ""}) — only this
              customer can use it, once.
            </span>
            <button type="submit" className={button}>
              Remove
            </button>
          </form>
        ) : canIncentivise ? (
          <form action={allocateAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderNumber" value={row.orderNumber} />
            <label className="flex flex-col gap-1">
              Incentive
              <select name="kind" defaultValue="PERCENTAGE" className={input}>
                <option value="PERCENTAGE">% off</option>
                <option value="FIXED_AMOUNT">£ off</option>
                {row.isDelivery && row.deliveryFeePence > 0 && (
                  <option value="FREE_DELIVERY">Free delivery</option>
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              % (1-50)
              <input
                name="percent"
                type="number"
                min={1}
                max={50}
                defaultValue={10}
                className={`${input} w-16`}
              />
            </label>
            <label className="flex flex-col gap-1">
              £ off
              <input
                name="amount"
                type="number"
                min={0.5}
                step={0.01}
                className={`${input} w-20`}
              />
            </label>
            <label className="flex flex-col gap-1">
              Min spend £
              <input
                name="minSpend"
                type="number"
                min={0}
                step={0.01}
                defaultValue={0}
                className={`${input} w-20`}
              />
            </label>
            <label className="flex flex-col gap-1">
              Days valid
              <input
                name="days"
                type="number"
                min={1}
                max={60}
                defaultValue={14}
                className={`${input} w-16`}
              />
            </label>
            <button type="submit" className={button}>
              Allocate
            </button>
          </form>
        ) : (
          <span>{row.isGuest ? "Guests can't be given an incentive." : null}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/5 pt-3">
        {row.status === "PENDING" && (
          <form action={reviewAction}>
            <input type="hidden" name="orderNumber" value={row.orderNumber} />
            <button type="submit" className={button}>
              Mark reviewed
            </button>
          </form>
        )}
        {row.status === "SUPPRESSED" ? (
          <form action={contactAction}>
            <input type="hidden" name="orderNumber" value={row.orderNumber} />
            <input type="hidden" name="allow" value="1" />
            <button type="submit" className={button}>
              Allow contact
            </button>
          </form>
        ) : row.status !== "RECOVERED" ? (
          <form action={contactAction} className="flex items-end gap-2">
            <input type="hidden" name="orderNumber" value={row.orderNumber} />
            <input
              name="reason"
              placeholder="Reason (optional)"
              maxLength={200}
              className={`${input} w-40`}
            />
            <button type="submit" className={button}>
              Don&apos;t contact
            </button>
          </form>
        ) : null}

        <form method="get" action="/staff/abandoned-checkouts" className="flex items-end gap-2">
          <input type="hidden" name="preview" value={row.orderNumber} />
          <select
            name="code"
            defaultValue={previewCodeId}
            className={input}
            aria-label="Store code for the preview"
          >
            <option value="">
              {row.incentive ? `Allocated: ${row.incentive.code}` : "No discount code"}
            </option>
            {codes.map((c) => (
              <option key={c.id} value={c.id}>
                Store code: {c.label}
              </option>
            ))}
          </select>
          <button type="submit" className={button}>
            Preview email
          </button>
        </form>

        {(canSendFirst || row.canResend) && (
          <form action={sendAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderNumber" value={row.orderNumber} />
            <select
              name="discountCodeId"
              defaultValue=""
              className={input}
              aria-label="Discount code to send"
            >
              <option value="">
                {row.incentive ? `Allocated: ${row.incentive.code}` : "No discount code"}
              </option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  Store code: {c.label}
                </option>
              ))}
            </select>
            {row.canResend && (
              <label className="flex items-center gap-1 text-xs text-primary">
                <input type="checkbox" name="confirmResend" value="1" required />
                Yes, send a second email ({row.emailCount} already sent
                {row.lastEmailedAt ? `, last ${when(row.lastEmailedAt)}` : ""})
              </label>
            )}
            <button type="submit" className={primaryButton}>
              {row.canResend ? "Send again" : "Send email"}
            </button>
          </form>
        )}
        {!canSendFirst && !row.canResend && row.blockedReason && (
          <p className="text-xs text-primary-muted">{row.blockedReason}</p>
        )}
      </div>
    </div>
  );
}

export function AbandonedCheckoutList({
  rows,
  codes,
  previewCodeId,
}: {
  rows: AbandonedCheckoutView[];
  codes: { id: string; label: string }[];
  previewCodeId: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-10 text-center text-sm text-primary-muted">
        No abandoned checkouts in this period.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Row key={row.orderNumber} row={row} codes={codes} previewCodeId={previewCodeId} />
      ))}
    </div>
  );
}
