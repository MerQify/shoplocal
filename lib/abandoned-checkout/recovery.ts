/**
 * #1732/#1733 — the rules of a staff-controlled checkout recovery, pure and import-light so the page,
 * the actions, the restore link and the tests share them. No I/O, no Prisma.
 *
 * A recovery belongs to one abandoned checkout: an order cancelled before payment (slice A's
 * `cancellationOrigin`). The order's own lines are the basket; its customer is who may be contacted.
 */

import type { CancellationOriginValue } from "@/lib/cancellation-origin";

/** The reasons a checkout counts as abandoned. Never `STAFF`, never an unrecorded (null) reason. */
export const RECOVERABLE_ORIGINS = [
  "CHECKOUT_CHANGED",
  "CHECKOUT_ABANDONED",
  "PAYMENT_EXPIRED",
  "PAYMENT_FAILED",
  "PROVIDER_UNAVAILABLE",
] as const satisfies readonly CancellationOriginValue[];

/** How long a restore link works after it is emailed, and how long a send counts toward "Recovered". */
export const RECOVERY_LINK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RecoveryStatusValue =
  "PENDING" | "REVIEWED" | "EMAIL_SENT" | "RECOVERED" | "EXPIRED" | "SUPPRESSED";

export const RECOVERY_STATUS_LABEL: Record<RecoveryStatusValue, string> = {
  PENDING: "Pending",
  REVIEWED: "Reviewed",
  EMAIL_SENT: "Email sent",
  RECOVERED: "Recovered",
  EXPIRED: "Expired",
  SUPPRESSED: "Don't contact",
};

/**
 * The status staff see (R7). EXPIRED is derived here from dates and never written by a job — there
 * is no automation in this release. SUPPRESSED and RECOVERED always win.
 */
export function effectiveRecoveryStatus(
  input: {
    stored: RecoveryStatusValue | null;
    abandonedAt: Date;
    tokenExpiresAt: Date | null;
  },
  now: Date,
  reminderWindowDays: number,
): RecoveryStatusValue {
  const stored = input.stored ?? "PENDING";
  if (stored === "SUPPRESSED" || stored === "RECOVERED" || stored === "EXPIRED") return stored;
  if (stored === "EMAIL_SENT") {
    return input.tokenExpiresAt && input.tokenExpiresAt.getTime() <= now.getTime()
      ? "EXPIRED"
      : "EMAIL_SENT";
  }
  // PENDING or REVIEWED: expired once the reminder window has passed unsent.
  return now.getTime() - input.abandonedAt.getTime() > reminderWindowDays * DAY_MS
    ? "EXPIRED"
    : stored;
}

export type LineAvailability =
  { kind: "available" } | { kind: "short"; left: number } | { kind: "unavailable" };

/**
 * Whether a basket line could be bought again now (R6). Only TRACKED stock is counted; untracked,
 * infinite or unknown stock is treated as available, the same rule checkout applies.
 */
export function lineAvailability(
  product: {
    isActive: boolean;
    stockMode: string | null;
    stockQuantity: number | null;
  } | null,
  quantity: number,
): LineAvailability {
  if (!product || !product.isActive) return { kind: "unavailable" };
  if (product.stockMode === "TRACKED") {
    const left = Math.max(0, product.stockQuantity ?? 0);
    if (left <= 0) return { kind: "unavailable" };
    if (left < quantity) return { kind: "short", left };
  }
  return { kind: "available" };
}

export function availabilityLabel(availability: LineAvailability): string {
  switch (availability.kind) {
    case "available":
      return "Available";
    case "short":
      return `Only ${availability.left} left`;
    case "unavailable":
      return "No longer available";
  }
}

/** Bundles every one of whose items is already in the basket at its bundle quantity (R11). */
export function qualifyingBundles<B extends { items: { productId: string; quantity: number }[] }>(
  basket: readonly { productId: string | null; quantity: number }[],
  bundles: readonly B[],
): B[] {
  const held = new Map<string, number>();
  for (const line of basket) {
    if (line.productId) held.set(line.productId, (held.get(line.productId) ?? 0) + line.quantity);
  }
  return bundles.filter(
    (bundle) =>
      bundle.items.length > 0 &&
      bundle.items.every((item) => (held.get(item.productId) ?? 0) >= item.quantity),
  );
}

export type IncentiveKind = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_DELIVERY";

export interface IncentiveInput {
  kind: IncentiveKind;
  /** Whole percent for PERCENTAGE (1-50), pence for FIXED_AMOUNT, ignored for FREE_DELIVERY. */
  amount: number;
  minSubtotalPence: number;
  endsInDays: number;
}

export type IncentiveCheck =
  { ok: true; value: number; endsAt: Date } | { ok: false; error: string };

export const INCENTIVE_DEFAULT_DAYS = RECOVERY_LINK_DAYS;

/** Validates a staff-allocated incentive against the basket (R10); returns the stored value. */
export function checkIncentive(
  input: IncentiveInput,
  basket: { totalPence: number; deliveryFeePence: number; isDelivery: boolean },
  now: Date,
): IncentiveCheck {
  if (!Number.isInteger(input.endsInDays) || input.endsInDays < 1 || input.endsInDays > 60) {
    return { ok: false, error: "Choose an end date between 1 and 60 days away." };
  }
  if (!Number.isInteger(input.minSubtotalPence) || input.minSubtotalPence < 0) {
    return { ok: false, error: "The minimum spend can't be negative." };
  }
  const endsAt = new Date(now.getTime() + input.endsInDays * DAY_MS);
  switch (input.kind) {
    case "PERCENTAGE":
      if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 50) {
        return { ok: false, error: "A percentage discount must be between 1% and 50%." };
      }
      return { ok: true, value: input.amount * 100, endsAt }; // basis points
    case "FIXED_AMOUNT":
      if (
        !Number.isInteger(input.amount) ||
        input.amount < 50 ||
        input.amount > basket.totalPence
      ) {
        return {
          ok: false,
          error: "A fixed discount must be at least £0.50 and no more than the basket value.",
        };
      }
      return { ok: true, value: input.amount, endsAt };
    case "FREE_DELIVERY":
      if (!basket.isDelivery || basket.deliveryFeePence <= 0) {
        return { ok: false, error: "Free delivery only applies to a delivery order with a fee." };
      }
      return { ok: true, value: 0, endsAt };
  }
}
