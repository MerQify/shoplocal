/**
 * #1605 — what a dated holiday / closure override (`VendorHoursOverride`, #1060) does to slots.
 *
 * Before this, the override reached only the footer: Christmas Day still offered and booked every
 * weekly slot. The owner's rules (decided at #1605's Propose):
 *
 * - **Closed day** — no delivery, collection or express slot at all.
 * - **Changed hours** (`closed = false`, both times set) — a COLLECTION slot is offered only when it
 *   lies inside the changed opening hours (start not before `openTime`, end not after `closeTime`).
 *   DELIVERY slots stay as scheduled: drivers can deliver after the shop shuts.
 * - An override with `closed = false` and a missing time changes nothing.
 *
 * The slot list (`lib/repositories/fulfilment-slots.ts`), `placeOrder` and the express gates all
 * call these, so what checkout offers and what it accepts cannot drift apart — the same arrangement
 * as `lib/slot-cutoff.ts`. Pure: times are `HH:mm` text and compare as text, exactly as
 * `lib/fulfilment-form.ts` documents.
 */

export interface DayOverride {
  label: string;
  closed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export type SlotMethod = "DELIVERY" | "COLLECTION";

/** Shopper-facing refusal for a slot or express order on a closed day. */
export const CLOSED_DAY_MESSAGE = "We're closed on that day. Please choose another day.";

/** Shopper-facing refusal for an express order outside a changed-hours day's opening hours. */
export const EXPRESS_OUTSIDE_HOURS_MESSAGE =
  "Express collection isn't available right now. Please choose a time slot.";

function changedHours(override: DayOverride | null): { open: string; close: string } | null {
  if (!override || override.closed || !override.openTime || !override.closeTime) return null;
  return { open: override.openTime, close: override.closeTime };
}

/** The label to show for a closed day, or null when the day is open (or has no override). */
export function closedDayLabel(override: DayOverride | null): string | null {
  return override?.closed ? override.label : null;
}

/** Whether a weekly slot may be offered and booked on a day carrying `override` (or none). */
export function slotFitsOverride(
  method: SlotMethod,
  slot: { startTime: string; endTime: string },
  override: DayOverride | null,
): boolean {
  if (override?.closed) return false;
  const hours = changedHours(override);
  if (!hours || method !== "COLLECTION") return true;
  return slot.startTime >= hours.open && slot.endTime <= hours.close;
}

/**
 * Whether express collection may run at store-local `hhmm` on a day carrying `override`.
 *
 * Only the override's say — the weekly express schedule is still checked where it always was.
 */
export function expressOverrideVerdict(
  override: DayOverride | null,
  hhmm: string,
): "OK" | "CLOSED_DAY" | "OUTSIDE_HOURS" {
  if (override?.closed) return "CLOSED_DAY";
  const hours = changedHours(override);
  if (hours && (hhmm < hours.open || hhmm >= hours.close)) return "OUTSIDE_HOURS";
  return "OK";
}
