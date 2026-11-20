/**
 * #1691 — the staff cancel form's customer-facing choices: their labels (one source for the form)
 * and the server-side parse `cancelOrderStaff` re-applies. A plain module, not `"use server"`:
 * the action file may export async functions only (CLAUDE.md).
 *
 * Pure and import-free, so the client form can use the labels.
 */

export const CANCELLATION_REASON_OPTIONS = [
  { value: "CUSTOMER_REQUEST", label: "Customer asked" },
  { value: "STORE_UNABLE", label: "We couldn't fulfil it" },
  { value: "OTHER", label: "Other" },
] as const;

export const CANCELLATION_MESSAGE_OPTIONS = [
  { value: "REFUNDED", label: "Refunded in full" },
  { value: "NOT_REFUNDED", label: "Not refunded yet" },
  { value: "CUSTOM", label: "Write my own message" },
] as const;

export const CUSTOMER_MESSAGE_MAX_LENGTH = 1000;

export type CancellationReasonValue = (typeof CANCELLATION_REASON_OPTIONS)[number]["value"];
export type CancellationMessageValue = (typeof CANCELLATION_MESSAGE_OPTIONS)[number]["value"];

export interface ParsedCancellationChoices {
  reason: CancellationReasonValue;
  message: CancellationMessageValue;
  /** Trimmed; null unless the message is CUSTOM and something was written. */
  customerMessage: string | null;
}

function isOneOf<T extends string>(options: readonly { value: T }[], value: unknown): value is T {
  return typeof value === "string" && options.some((option) => option.value === value);
}

/**
 * #1691 R12 — null when anything is missing or out of range, so the action cancels nothing. A
 * blank CUSTOM message is valid: the customer then gets the neutral wording (R13).
 */
export function parseCancellationChoices(form: {
  get(name: string): unknown;
}): ParsedCancellationChoices | null {
  const reason = form.get("cancellationReason");
  const message = form.get("cancellationMessage");
  const rawText = form.get("customerMessage");
  if (!isOneOf(CANCELLATION_REASON_OPTIONS, reason)) return null;
  if (!isOneOf(CANCELLATION_MESSAGE_OPTIONS, message)) return null;
  if (rawText !== null && typeof rawText !== "string") return null;
  const text = (rawText ?? "").trim();
  if (text.length > CUSTOMER_MESSAGE_MAX_LENGTH) return null;
  return {
    reason,
    message,
    customerMessage: message === "CUSTOM" && text.length > 0 ? text : null,
  };
}
