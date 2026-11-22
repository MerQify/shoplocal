/**
 * #1554 — which abandoned checkouts the staff page lists, and whether one may be reminded. Pure and
 * import-free, so the page, the action and the tests share one rule.
 *
 * #1732 — an abandoned checkout is an order cancelled before payment for one of
 * `RECOVERABLE_ORIGINS` (`lib/abandoned-checkout/recovery.ts`), read from slice A's
 * `OrderStatusEvent.cancellationOrigin`. It replaced the "Checkout session expired" note prefix,
 * which only ever found expired payment links.
 */

/** How far back the page lists. */
export const ABANDONED_LIST_DAYS = 30;

/** A reminder may go out only this soon after abandonment: a week-old basket reads as spam. */
export const REMINDER_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderBlock =
  "already-sent" | "guest" | "no-email" | "no-consent" | "too-old" | "suppressed" | "recovered";

export const REMINDER_BLOCK_COPY: Record<ReminderBlock, string> = {
  "already-sent": "A reminder has already been sent for this checkout.",
  guest: "Guest checkout: there is no marketing consent to rely on.",
  "no-email": "There is no email address for this customer.",
  "no-consent":
    "This customer has not agreed to marketing emails, or has not verified their email address.",
  "too-old": `Reminders can only be sent within ${REMINDER_WINDOW_DAYS} days of the checkout expiring.`,
  suppressed: 'This checkout is marked "Don\'t contact".',
  recovered: "This customer has already completed the purchase.",
};

export interface ReminderCandidate {
  abandonedAt: Date;
  userId: string | null;
  email: string | null;
  /** `hasEffectiveMarketingConsent`: newest choice is a grant AND the email is verified. */
  hasConsent: boolean;
  /** #1733 — emails already sent for this checkout (0 = none). */
  emailCount: number;
  /** #1733 — the recovery's stored status, or null when no recovery exists yet. */
  status: string | null;
}

/**
 * Null when a reminder may be sent now, else the first reason it may not. A suppressed or recovered
 * checkout is never emailed. "Already sent" blocks unless staff explicitly confirm a second send
 * (#1733 R18); the consent and window rules still apply to that second send.
 */
export function reminderBlock(
  row: ReminderCandidate,
  now: Date,
  options: { confirmResend?: boolean } = {},
): ReminderBlock | null {
  if (row.status === "SUPPRESSED") return "suppressed";
  if (row.status === "RECOVERED") return "recovered";
  if (row.emailCount > 0 && !options.confirmResend) return "already-sent";
  if (!row.userId) return "guest";
  if (!row.email) return "no-email";
  if (!row.hasConsent) return "no-consent";
  if (now.getTime() - row.abandonedAt.getTime() > REMINDER_WINDOW_DAYS * DAY_MS) return "too-old";
  return null;
}

export interface OfferableCode {
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
  remainingRedemptions: number | null;
}

/** A discount code an admin may attach: active, started, not ended and not used up. */
export function isOfferableCode(code: OfferableCode, now: Date): boolean {
  return (
    code.isActive &&
    code.startsAt.getTime() <= now.getTime() &&
    (code.endsAt === null || code.endsAt.getTime() > now.getTime()) &&
    (code.remainingRedemptions === null || code.remainingRedemptions > 0)
  );
}
