import type { NotificationMessage } from "@/lib/notifications/dispatch";
import type {
  AbandonedCheckoutRow,
  RecoveryIncentive,
} from "@/lib/repositories/abandoned-checkouts";
import type { EmailBrand } from "@/lib/email/layout/brand";
import type { CopyOverrides, RenderedEmail } from "@/lib/email/templates/compose";
import type { TemplateKey } from "@/lib/email/templates/registry";
import { buildRecoveryEmail, type RecoveryCode, type RecoveryEmailItem } from "./email";
import {
  isOfferableCode,
  reminderBlock,
  REMINDER_BLOCK_COPY,
  type OfferableCode,
  type ReminderBlock,
} from "./eligibility";
import { lineAvailability } from "./recovery";

/**
 * #1554, extended for #1733 — "Preview" and "Send email" for one abandoned checkout, with every
 * collaborator injected so the rules are tested without a request, a database or a provider.
 * `lib/abandoned-checkouts-service.ts` binds them.
 *
 * Send order is fixed: find the checkout (this store's, actually abandoned), re-check eligibility on
 * the server (the page's disabled button proves nothing), pick the code, CLAIM the send with a
 * compare-and-set on the recovery's `emailCount` (storing a fresh restore-token hash), then send.
 * Claiming first is what makes a double click or two admins send one email, not two.
 */

export interface StoreCode extends OfferableCode, RecoveryCode {
  id: string;
}

export interface RecoveryStore {
  sender: { name: string; email: string };
  baseUrl: string | null;
  brand?: EmailBrand;
  overrides?: Partial<Record<TemplateKey, CopyOverrides>>;
}

export interface RemindDeps {
  find(orderNumber: string): Promise<AbandonedCheckoutRow | null>;
  hasConsent(userId: string): Promise<boolean>;
  listCodes(): Promise<StoreCode[]>;
  ensureRecovery(orderId: string): Promise<{ id: string; status: string; emailCount: number }>;
  claim(input: {
    recoveryId: string;
    expectedEmailCount: number;
    tokenHash: string;
    actorUserId: string;
    discountCode: string | null;
  }): Promise<boolean>;
  newToken(): Promise<{ token: string; hash: string }>;
  loadStore(): Promise<RecoveryStore>;
  send(messages: readonly NotificationMessage[]): Promise<void>;
  now(): Date;
  /** `CDN_BASE_URL`, for product image URLs; null shows no images. */
  cdnBaseUrl: string | null;
}

export type RemindResult = { ok: true } | { ok: false; error: string };

export const REMIND_COPY = {
  notFound: "That abandoned checkout could not be found.",
  badCode: "That discount code can't be offered right now. Pick another or send without one.",
  raced: "Someone else changed this checkout just now. Refresh and try again.",
} as const;

/** What the preview shows in place of a real link: a real token exists only once sent. */
export const PREVIEW_RESTORE_PATH = "/recover/preview-link-created-when-sent";

function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/** #1733 — the basket at TODAY's prices; unavailable lines are listed but not counted. */
export function basketAtTodaysPrices(
  row: Pick<AbandonedCheckoutRow, "items">,
  cdnBaseUrl: string | null,
): { items: RecoveryEmailItem[]; totalPence: number } {
  const items = row.items.map((line): RecoveryEmailItem => {
    const available = lineAvailability(
      line.product
        ? {
            isActive: line.product.isActive,
            stockMode: line.product.stockMode,
            stockQuantity: line.product.stockQuantity,
          }
        : null,
      line.quantity,
    );
    const unit = line.product?.currentPricePence ?? line.unitPricePence;
    return {
      productName: line.productName,
      quantity: line.quantity,
      lineTotalPence: unit * line.quantity,
      imageUrl:
        cdnBaseUrl && line.product?.imageKey ? `${cdnBaseUrl}/${line.product.imageKey}` : null,
      available: available.kind !== "unavailable",
    };
  });
  const totalPence = items
    .filter((item) => item.available !== false)
    .reduce((sum, item) => sum + item.lineTotalPence, 0);
  return { items, totalPence };
}

function incentiveAsCode(incentive: RecoveryIncentive | null): RecoveryCode | null {
  if (!incentive || !incentive.isActive) return null;
  return {
    code: incentive.code,
    kind: incentive.kind,
    value: incentive.value,
    minSubtotalPence: incentive.minSubtotalPence,
    endsAt: incentive.endsAt,
  };
}

/** The one place the email is assembled, shared by Preview and Send (R15: they cannot differ). */
export function recoveryEmailFor(
  row: AbandonedCheckoutRow,
  store: RecoveryStore,
  code: RecoveryCode | null,
  restoreHref: string | null,
  cdnBaseUrl: string | null,
): RenderedEmail {
  const basket = basketAtTodaysPrices(row, cdnBaseUrl);
  return buildRecoveryEmail({
    storeName: store.sender.name,
    brand: store.brand,
    overrides: store.overrides?.["marketing.abandoned_checkout"],
    firstName: firstName(row.customerName),
    items: basket.items,
    totalPence: basket.totalPence,
    orderHref: restoreHref,
    preferencesHref: store.baseUrl ? `${store.baseUrl}/account/data` : null,
    code,
  });
}

async function chooseCode(
  row: AbandonedCheckoutRow,
  discountCodeId: string | null,
  deps: Pick<RemindDeps, "listCodes">,
  now: Date,
): Promise<{ ok: true; code: RecoveryCode | null } | { ok: false }> {
  if (discountCodeId) {
    const code = (await deps.listCodes()).find((c) => c.id === discountCodeId) ?? null;
    if (!code || !isOfferableCode(code, now)) return { ok: false };
    return { ok: true, code };
  }
  return { ok: true, code: incentiveAsCode(row.recovery?.incentive ?? null) };
}

function blockFor(
  row: AbandonedCheckoutRow,
  hasConsent: boolean,
  now: Date,
  confirmResend: boolean,
): ReminderBlock | null {
  return reminderBlock(
    {
      abandonedAt: row.abandonedAt,
      userId: row.userId,
      email: row.email,
      hasConsent,
      emailCount: row.recovery?.emailCount ?? 0,
      status: row.recovery?.status ?? null,
    },
    now,
    { confirmResend },
  );
}

export type PreviewResult =
  | { ok: true; to: string | null; subject: string; html: string; blockedReason: string | null }
  | { ok: false; error: string };

/** R15 — exactly what Send would build, without claiming or sending anything. */
export async function previewRecoveryEmail(
  input: { orderNumber: string; discountCodeId: string | null },
  deps: Pick<RemindDeps, "find" | "hasConsent" | "listCodes" | "loadStore" | "now" | "cdnBaseUrl">,
): Promise<PreviewResult> {
  const row = await deps.find(input.orderNumber);
  if (!row) return { ok: false, error: REMIND_COPY.notFound };
  const now = deps.now();
  const chosen = await chooseCode(row, input.discountCodeId, deps, now);
  if (!chosen.ok) return { ok: false, error: REMIND_COPY.badCode };
  const hasConsent = row.userId ? await deps.hasConsent(row.userId) : false;
  const block = blockFor(row, hasConsent, now, true);
  const store = await deps.loadStore();
  const restoreHref = store.baseUrl ? `${store.baseUrl}${PREVIEW_RESTORE_PATH}` : null;
  const email = recoveryEmailFor(row, store, chosen.code, restoreHref, deps.cdnBaseUrl);
  return {
    ok: true,
    to: row.email,
    subject: email.subject,
    html: email.html,
    blockedReason: block ? REMINDER_BLOCK_COPY[block] : null,
  };
}

export async function sendRecoveryEmail(
  input: {
    orderNumber: string;
    staffUserId: string;
    discountCodeId: string | null;
    confirmResend: boolean;
  },
  deps: RemindDeps,
): Promise<RemindResult> {
  const row = await deps.find(input.orderNumber);
  if (!row) return { ok: false, error: REMIND_COPY.notFound };

  const hasConsent = row.userId ? await deps.hasConsent(row.userId) : false;
  const now = deps.now();
  const block = blockFor(row, hasConsent, now, input.confirmResend);
  if (block) return { ok: false, error: REMINDER_BLOCK_COPY[block] };

  const chosen = await chooseCode(row, input.discountCodeId, deps, now);
  if (!chosen.ok) return { ok: false, error: REMIND_COPY.badCode };

  const recovery = await deps.ensureRecovery(row.orderId);
  const token = await deps.newToken();
  const claimed = await deps.claim({
    recoveryId: recovery.id,
    expectedEmailCount: recovery.emailCount,
    tokenHash: token.hash,
    actorUserId: input.staffUserId,
    discountCode: chosen.code?.code ?? null,
  });
  if (!claimed) return { ok: false, error: REMIND_COPY.raced };

  const store = await deps.loadStore();
  const restoreHref = store.baseUrl ? `${store.baseUrl}/recover/${token.token}` : null;
  const { subject, html, text } = recoveryEmailFor(
    row,
    store,
    chosen.code,
    restoreHref,
    deps.cdnBaseUrl,
  );
  await deps.send([
    {
      channel: "EMAIL",
      // `reminderBlock` returned null, so the email is present.
      destination: row.email as string,
      subject,
      body: html,
      text,
      sender: store.sender,
      log: { audience: "CUSTOMER", event: "ABANDONED_CHECKOUT_REMINDER" },
    },
  ]);
  return { ok: true };
}
