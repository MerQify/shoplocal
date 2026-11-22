import { getPrisma, getPrismaWs } from "@/lib/db";
import { getEnv } from "@/lib/config";
import {
  ABANDONED_LIST_DAYS,
  isOfferableCode,
  reminderBlock,
  REMINDER_BLOCK_COPY,
  REMINDER_WINDOW_DAYS,
} from "@/lib/abandoned-checkout/eligibility";
import {
  availabilityLabel,
  checkIncentive,
  effectiveRecoveryStatus,
  lineAvailability,
  qualifyingBundles,
  RECOVERY_STATUS_LABEL,
  type IncentiveInput,
  type RecoveryStatusValue,
} from "@/lib/abandoned-checkout/recovery";
import { codeBenefit } from "@/lib/abandoned-checkout/email";
import {
  previewRecoveryEmail,
  sendRecoveryEmail,
  type PreviewResult,
  type RemindDeps,
  type RemindResult,
  type StoreCode,
} from "@/lib/abandoned-checkout/remind";
import {
  hashRecoveryToken,
  isWellFormedRecoveryToken,
  newRecoveryToken,
} from "@/lib/abandoned-checkout/token";
import { cancellationOriginLabel } from "@/lib/cancellation-origin";
import {
  loadVendorNotificationContext,
  sendVendorNotifications,
} from "@/lib/order-notifications-service";
import {
  allocateRecoveryIncentive,
  claimRecoverySend,
  ensureRecovery,
  findAbandonedCheckout,
  findAbandonedCheckoutByTokenHash,
  listAbandonedCheckouts,
  listActiveBundles,
  listLaterPaidOrders,
  recordRecoveryRestored,
  removeRecoveryIncentive,
  transitionRecovery,
  type AbandonedCheckoutRow,
} from "@/lib/repositories/abandoned-checkouts";
import { listCodes } from "@/lib/repositories/discounts";
import { hasEffectiveMarketingConsent } from "@/lib/repositories/marketing-consent";

/**
 * #1554, rebuilt for #1732/#1733 — the request-scoped half of checkout recovery. The caller passes
 * the `vendorId` and staff user that `requireVendorRole` resolved from the request; nothing here
 * trusts a form for either. No function here sends or allocates anything on its own: every write
 * is a staff action (no automation in this release).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function cdnBaseUrl(): string | null {
  return getEnv().CDN_BASE_URL ?? null;
}

async function storeCodes(prisma: ReturnType<typeof getPrisma>, vendorId: string) {
  const codes = await listCodes(prisma, vendorId);
  return codes
    .filter((c) => !c.restrictedToUserId) // another customer's personal code is never offerable
    .map((c): StoreCode => ({
      id: c.id,
      code: c.code,
      kind: c.kind,
      value: c.value,
      minSubtotalPence: c.minSubtotalPence,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      isActive: c.isActive,
      remainingRedemptions: c.remainingRedemptions,
    }));
}

export interface AbandonedLineView {
  productName: string;
  quantity: number;
  originalUnitPence: number;
  currentUnitPence: number | null;
  availability: string;
  available: boolean;
}

export interface AbandonedCheckoutView {
  orderNumber: string;
  abandonedAt: string;
  reasonLabel: string;
  isGuest: boolean;
  customerName: string | null;
  email: string | null;
  items: AbandonedLineView[];
  totalPence: number;
  isDelivery: boolean;
  deliveryFeePence: number;
  status: RecoveryStatusValue;
  statusLabel: string;
  hasConsent: boolean;
  emailCount: number;
  lastEmailedAt: string | null;
  /** Null when a first email may be sent now, else why not. */
  blockedReason: string | null;
  /** A second email is possible with explicit confirmation. */
  canResend: boolean;
  incentive: { code: string; summary: string; endsAt: string | null } | null;
  boughtLater: string | null;
  recoveredOrderNumber: string | null;
  suppressReason: string | null;
  bundles: string[];
}

export async function getAbandonedCheckoutsPage(vendorId: string): Promise<{
  rows: AbandonedCheckoutView[];
  codes: { id: string; label: string }[];
}> {
  const prisma = getPrisma();
  const now = new Date();
  const since = new Date(now.getTime() - ABANDONED_LIST_DAYS * DAY_MS);
  const [rows, codes, bundles] = await Promise.all([
    listAbandonedCheckouts(prisma, vendorId, since),
    storeCodes(prisma, vendorId),
    listActiveBundles(prisma, vendorId),
  ]);

  const userIds = [...new Set(rows.flatMap((r) => (r.userId ? [r.userId] : [])))];
  const [consentPairs, laterPaid] = await Promise.all([
    Promise.all(
      userIds.map(
        async (id) => [id, await hasEffectiveMarketingConsent(prisma, vendorId, id)] as const,
      ),
    ),
    listLaterPaidOrders(prisma, vendorId, userIds, since),
  ]);
  const consent = new Map(consentPairs);

  return {
    rows: rows.map((r) => toView(r, consent.get(r.userId ?? "") ?? false, laterPaid, bundles, now)),
    codes: codes.filter((c) => isOfferableCode(c, now)).map((c) => ({ id: c.id, label: c.code })),
  };
}

export function toView(
  r: AbandonedCheckoutRow,
  hasConsent: boolean,
  laterPaid: { userId: string; orderNumber: string; createdAt: Date }[],
  bundles: { name: string; items: { productId: string; quantity: number }[] }[],
  now: Date,
): AbandonedCheckoutView {
  const candidate = {
    abandonedAt: r.abandonedAt,
    userId: r.userId,
    email: r.email,
    hasConsent,
    emailCount: r.recovery?.emailCount ?? 0,
    status: r.recovery?.status ?? null,
  };
  const block = reminderBlock(candidate, now);
  const resendBlock = reminderBlock(candidate, now, { confirmResend: true });
  const status = effectiveRecoveryStatus(
    {
      stored: (r.recovery?.status as RecoveryStatusValue | undefined) ?? null,
      abandonedAt: r.abandonedAt,
      tokenExpiresAt: r.recovery?.tokenExpiresAt ?? null,
    },
    now,
    REMINDER_WINDOW_DAYS,
  );
  const later = r.userId
    ? laterPaid
        .filter((o) => o.userId === r.userId && o.createdAt > r.abandonedAt)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
    : undefined;
  const incentive = r.recovery?.incentive;
  return {
    orderNumber: r.orderNumber,
    abandonedAt: r.abandonedAt.toISOString(),
    reasonLabel: cancellationOriginLabel(r.origin),
    isGuest: r.userId === null,
    customerName: r.customerName,
    email: r.email,
    items: r.items.map((line) => {
      const availability = lineAvailability(
        line.product
          ? {
              isActive: line.product.isActive,
              stockMode: line.product.stockMode,
              stockQuantity: line.product.stockQuantity,
            }
          : null,
        line.quantity,
      );
      return {
        productName: line.productName,
        quantity: line.quantity,
        originalUnitPence: line.unitPricePence,
        currentUnitPence: line.product?.currentPricePence ?? null,
        availability: availabilityLabel(availability),
        available: availability.kind !== "unavailable",
      };
    }),
    totalPence: r.totalPence,
    isDelivery: r.isDelivery,
    deliveryFeePence: r.deliveryFeePence,
    status,
    statusLabel: RECOVERY_STATUS_LABEL[status],
    hasConsent,
    emailCount: r.recovery?.emailCount ?? 0,
    lastEmailedAt: r.recovery?.lastEmailedAt?.toISOString() ?? null,
    blockedReason: block ? REMINDER_BLOCK_COPY[block] : null,
    canResend: block === "already-sent" && resendBlock === null,
    incentive:
      incentive && incentive.isActive
        ? {
            code: incentive.code,
            summary: codeBenefit(incentive),
            endsAt: incentive.endsAt?.toISOString() ?? null,
          }
        : null,
    boughtLater: later?.orderNumber ?? null,
    recoveredOrderNumber: r.recovery?.recoveredOrderNumber ?? null,
    suppressReason: r.recovery?.suppressReason ?? null,
    bundles: qualifyingBundles(r.items, bundles).map((b) => b.name),
  };
}

function remindDeps(vendorId: string): RemindDeps {
  const prisma = getPrisma();
  return {
    find: (orderNumber) => findAbandonedCheckout(prisma, vendorId, orderNumber),
    hasConsent: (userId) => hasEffectiveMarketingConsent(prisma, vendorId, userId),
    listCodes: () => storeCodes(prisma, vendorId),
    ensureRecovery: (orderId) => ensureRecovery(prisma, vendorId, orderId),
    claim: (claim) => claimRecoverySend(getPrismaWs(), vendorId, { ...claim, now: new Date() }),
    newToken: newRecoveryToken,
    loadStore: () => loadVendorNotificationContext(vendorId),
    send: (messages) => sendVendorNotifications(vendorId, messages),
    now: () => new Date(),
    cdnBaseUrl: cdnBaseUrl(),
  };
}

export async function previewAbandonedCheckout(input: {
  vendorId: string;
  orderNumber: string;
  discountCodeId: string | null;
}): Promise<PreviewResult> {
  return previewRecoveryEmail(input, remindDeps(input.vendorId));
}

export async function sendAbandonedCheckoutEmail(input: {
  vendorId: string;
  staffUserId: string;
  orderNumber: string;
  discountCodeId: string | null;
  confirmResend: boolean;
}): Promise<RemindResult> {
  return sendRecoveryEmail(input, remindDeps(input.vendorId));
}

type ActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That abandoned checkout could not be found.";
const RACED = "Someone else changed this checkout just now. Refresh and try again.";

/** R8 — Pending → Reviewed. */
export async function reviewAbandonedCheckout(input: {
  vendorId: string;
  staffUserId: string;
  orderNumber: string;
}): Promise<ActionResult> {
  const row = await findAbandonedCheckout(getPrisma(), input.vendorId, input.orderNumber);
  if (!row) return { ok: false, error: NOT_FOUND };
  const recovery = await ensureRecovery(getPrisma(), input.vendorId, row.orderId);
  const moved = await transitionRecovery(getPrismaWs(), input.vendorId, {
    recoveryId: recovery.id,
    from: ["PENDING"],
    to: "REVIEWED",
    event: "REVIEWED",
    actorUserId: input.staffUserId,
  });
  return moved ? { ok: true } : { ok: false, error: "This checkout has already been reviewed." };
}

/** R9 — "Don't contact" (from any open status) and "Allow contact" (back to Reviewed). */
export async function setAbandonedCheckoutContact(input: {
  vendorId: string;
  staffUserId: string;
  orderNumber: string;
  allow: boolean;
  reason: string | null;
}): Promise<ActionResult> {
  const row = await findAbandonedCheckout(getPrisma(), input.vendorId, input.orderNumber);
  if (!row) return { ok: false, error: NOT_FOUND };
  const recovery = await ensureRecovery(getPrisma(), input.vendorId, row.orderId);
  const moved = input.allow
    ? await transitionRecovery(getPrismaWs(), input.vendorId, {
        recoveryId: recovery.id,
        from: ["SUPPRESSED"],
        to: "REVIEWED",
        event: "UNSUPPRESSED",
        actorUserId: input.staffUserId,
      })
    : await transitionRecovery(getPrismaWs(), input.vendorId, {
        recoveryId: recovery.id,
        from: ["PENDING", "REVIEWED", "EMAIL_SENT"],
        to: "SUPPRESSED",
        suppressReason: input.reason?.slice(0, 200) || null,
        event: "SUPPRESSED",
        actorUserId: input.staffUserId,
        note: input.reason?.slice(0, 200) || null,
      });
  return moved ? { ok: true } : { ok: false, error: RACED };
}

function newIncentiveCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `BACK-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

/** R10 — a single-use, customer-locked code for this checkout's customer. */
export async function allocateAbandonedCheckoutIncentive(input: {
  vendorId: string;
  staffUserId: string;
  orderNumber: string;
  incentive: IncentiveInput;
}): Promise<ActionResult> {
  const row = await findAbandonedCheckout(getPrisma(), input.vendorId, input.orderNumber);
  if (!row) return { ok: false, error: NOT_FOUND };
  if (!row.userId) {
    return { ok: false, error: "Incentives are only for signed-in customers, not guests." };
  }
  if (row.recovery?.status === "SUPPRESSED" || row.recovery?.status === "RECOVERED") {
    return { ok: false, error: "This checkout can't be given an incentive now." };
  }
  const check = checkIncentive(
    input.incentive,
    {
      totalPence: row.subtotalPence,
      deliveryFeePence: row.deliveryFeePence,
      isDelivery: row.isDelivery,
    },
    new Date(),
  );
  if (!check.ok) return { ok: false, error: check.error };
  const recovery = await ensureRecovery(getPrisma(), input.vendorId, row.orderId);
  await allocateRecoveryIncentive(getPrismaWs(), input.vendorId, {
    recoveryId: recovery.id,
    customerUserId: row.userId,
    actorUserId: input.staffUserId,
    code: newIncentiveCode(),
    kind: input.incentive.kind,
    value: check.value,
    minSubtotalPence: input.incentive.minSubtotalPence,
    endsAt: check.endsAt,
  });
  return { ok: true };
}

export async function removeAbandonedCheckoutIncentive(input: {
  vendorId: string;
  staffUserId: string;
  orderNumber: string;
}): Promise<ActionResult> {
  const row = await findAbandonedCheckout(getPrisma(), input.vendorId, input.orderNumber);
  if (!row?.recovery) return { ok: false, error: NOT_FOUND };
  const removed = await removeRecoveryIncentive(getPrismaWs(), input.vendorId, {
    recoveryId: row.recovery.id,
    actorUserId: input.staffUserId,
  });
  return removed ? { ok: true } : { ok: false, error: "There is no incentive to remove." };
}

/**
 * R20 — the abandoned checkout behind a restore-link token, or null for anything that should read
 * "This link has expired": malformed, unknown, another store's, expired, suppressed or recovered.
 */
export async function findRecoverableByToken(
  vendorId: string,
  token: string,
  now: Date = new Date(),
): Promise<AbandonedCheckoutRow | null> {
  if (!isWellFormedRecoveryToken(token)) return null;
  const row = await findAbandonedCheckoutByTokenHash(
    getPrisma(),
    vendorId,
    await hashRecoveryToken(token),
  );
  const recovery = row?.recovery;
  if (!row || !recovery) return null;
  if (recovery.status === "SUPPRESSED" || recovery.status === "RECOVERED") return null;
  if (!recovery.tokenExpiresAt || recovery.tokenExpiresAt.getTime() <= now.getTime()) return null;
  return row;
}

/** R21 — records a restore; the caller adds the lines to the visitor's basket. */
export async function recordRestore(vendorId: string, recoveryId: string): Promise<void> {
  await recordRecoveryRestored(getPrismaWs(), vendorId, { recoveryId, now: new Date() });
}
