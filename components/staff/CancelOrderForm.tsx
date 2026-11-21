"use client";

import { useState } from "react";
import {
  CANCELLATION_MESSAGE_OPTIONS,
  CANCELLATION_REASON_OPTIONS,
  CUSTOMER_MESSAGE_MAX_LENGTH,
} from "@/lib/order-cancellation-form";

/**
 * P9.2 (#696) staff cancellation of a PAID order, with #1691's customer-facing choices.
 *
 * The internal reason stays exactly as before: required, never shown to the customer, and the
 * status event's `note`. The two radio groups decide what the cancellation email and the order page
 * say; "Write my own message" reveals a box whose text replaces that wording (blank gives a neutral
 * one). Client-side only so the box can appear when chosen; `cancelOrderStaff` re-validates all of it.
 */
export function CancelOrderForm({
  orderNumber,
  action,
}: {
  orderNumber: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form action={action} className="mt-8 rounded-2xl border border-danger/30 p-4">
      <h2 className="text-sm font-bold text-primary">Cancel this order</h2>
      <p className="mt-1 text-xs leading-relaxed text-primary-muted">
        Returns the items to stock, reverses any points earned or spent, and gives back a discount
        code use. <strong className="text-primary">No refund is issued</strong> — the customer keeps
        being charged until you refund them directly.
      </p>
      <input type="hidden" name="orderNumber" value={orderNumber} />

      <label htmlFor="cancel-reason" className="mt-3 block text-xs font-bold text-primary">
        Reason
      </label>
      <input
        id="cancel-reason"
        name="reason"
        type="text"
        required
        maxLength={200}
        placeholder="Why is this order being cancelled?"
        className="mt-1 w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-primary"
      />
      <p className="mt-1 text-xs text-primary-muted">
        For your records only — this reason is not shown to the customer.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-bold text-primary">Who asked for this?</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {CANCELLATION_REASON_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-primary">
              <input type="radio" name="cancellationReason" value={option.value} required />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-xs font-bold text-primary">
          What should we tell the customer?
        </legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {CANCELLATION_MESSAGE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-primary">
              <input
                type="radio"
                name="cancellationMessage"
                value={option.value}
                required
                onChange={() => setMessage(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-primary-muted">
          “Refunded in full” does not refund anything — refund the payment in Stripe first.
        </p>
      </fieldset>

      {message === "CUSTOM" && (
        <div className="mt-4">
          <label htmlFor="cancel-customer-message" className="block text-xs font-bold text-primary">
            Message to the customer
          </label>
          <textarea
            id="cancel-customer-message"
            name="customerMessage"
            maxLength={CUSTOMER_MESSAGE_MAX_LENGTH}
            rows={4}
            className="mt-1 w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-primary"
          />
          <p className="mt-1 text-xs text-primary-muted">
            Shown to the customer in the email and on their order page, in place of our wording.
            Leave it blank to send a short neutral message instead.
          </p>
        </div>
      )}

      <button
        type="submit"
        className="mt-4 w-full rounded-2xl bg-danger px-5 py-3 text-sm font-bold text-white transition-colors hover:opacity-90"
      >
        Cancel order {orderNumber}
      </button>
    </form>
  );
}
