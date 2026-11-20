"use client";

import { useActionState, useRef, useState } from "react";
import {
  addInboundAddressAction,
  removeInboundAddressAction,
  saveSenderAction,
  sendDestinationVerificationAction,
  sendTestEmailAction,
  updateInboundAddressAction,
} from "@/app/(admin)/staff/platform/client-setup/actions";
import {
  initialClientSetupFormState,
  type ClientSetupFormState,
} from "@/lib/client-setup/form-state";
import { buttonClass, inputClass, labelClass } from "@/lib/form-classes";
import { Icon } from "@/components/icons/Icon";
import { DualListboxTransferPicker } from "./DualListboxTransferPicker";
import type { InboundDefaultForward } from "@/lib/config";
import type { DestinationsResult } from "@/lib/email/destinations";
import type { SuggestedSender } from "@/lib/client-setup/sender-suggestion";
import { DESTINATIONS_UNAVAILABLE_MESSAGE } from "@/lib/client-setup/destination-copy";

/**
 * #1217 — the Client Setup Email section's four controls. Each posts to a server action that
 * re-checks the platform-admin gate itself; hiding these forms is courtesy, not the control.
 */

export function FormMessage({ state }: { state: ClientSetupFormState }) {
  if (!state.message) return null;
  return state.ok ? (
    <p
      role="status"
      className="rounded-xl bg-action-tint px-4 py-3 text-sm font-medium text-primary"
    >
      {state.message}
    </p>
  ) : (
    <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-sm font-medium text-danger">
      {state.message}
    </p>
  );
}

export function SenderForm({
  vendorId,
  senderName,
  senderEmail,
  suggestion,
}: {
  vendorId: string;
  senderName: string;
  senderEmail: string;
  /** #1403 — the suggested sender; the button fills the inputs and the admin still saves. */
  suggestion: SuggestedSender | null;
}) {
  const [state, action, saving] = useActionState(saveSenderAction, initialClientSetupFormState);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const showSuggestion =
    suggestion !== null &&
    (suggestion.name !== senderName ||
      suggestion.email.toLowerCase() !== senderEmail.trim().toLowerCase());
  return (
    <form action={action} className="space-y-3" data-client-setup-form="sender">
      <FormMessage state={state} />
      {showSuggestion && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-tint px-4 py-3 text-sm"
          data-suggested-sender
        >
          <span className="min-w-0">
            Suggested:{" "}
            <span className="font-semibold">
              {suggestion.name} &lt;{suggestion.email}&gt;
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (nameRef.current) nameRef.current.value = suggestion.name;
              if (emailRef.current) emailRef.current.value = suggestion.email;
            }}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-action underline"
          >
            Use suggested sender
          </button>
        </div>
      )}
      <input type="hidden" name="vendorId" value={vendorId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="senderName">
            Sender name
          </label>
          <input
            ref={nameRef}
            id="senderName"
            name="senderName"
            required
            maxLength={120}
            defaultValue={senderName}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="senderEmail">
            Sender email
          </label>
          <input
            ref={emailRef}
            id="senderEmail"
            name="senderEmail"
            type="email"
            required
            defaultValue={senderEmail}
            className={inputClass}
          />
        </div>
      </div>
      <button type="submit" disabled={saving} className={buttonClass}>
        <Icon name="save" className="h-4 w-4" />
        {saving ? "Saving…" : "Save sender"}
      </button>
    </form>
  );
}

const OTHER = "__other__";

/**
 * #1392 R6 — the initial dropdown choice: the platform default when Cloudflare has verified it;
 * the default typed into Other… when it is set but not verified; otherwise the first verified
 * mailbox, or Other… when there is none.
 */
function initialForwardChoice(
  defaultForward: InboundDefaultForward,
  verified: readonly string[],
): { choice: string; other: string } {
  if (defaultForward.status === "set") {
    return verified.includes(defaultForward.address)
      ? { choice: defaultForward.address, other: "" }
      : { choice: OTHER, other: defaultForward.address };
  }
  return verified.length > 0 ? { choice: verified[0], other: "" } : { choice: OTHER, other: "" };
}

/** #1392 R5 — Forward to as a dropdown of Cloudflare's verified destination addresses. */
function ForwardToSelect({
  defaultForward,
  addresses,
}: {
  defaultForward: InboundDefaultForward;
  addresses: readonly { email: string; verified: boolean }[];
}) {
  const verified = addresses.filter((a) => a.verified).map((a) => a.email);
  const pending = addresses.filter((a) => !a.verified).map((a) => a.email);
  const [initial] = useState(() => initialForwardChoice(defaultForward, verified));
  const [choice, setChoice] = useState(initial.choice);
  const [selectedMultiple, setSelectedMultiple] = useState<string[]>(() =>
    initial.other
      ? initial.other
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  const customInputRef = useRef<HTMLInputElement>(null);
  const isOther = choice === OTHER;
  return (
    <>
      <label className={labelClass} htmlFor="forwardTo">
        Forward to (the store&apos;s real mailbox)
      </label>
      {/* Exactly one forwardTo is posted: the select's, or the Other… text box's. */}
      <select
        id="forwardTo"
        name={isOther ? undefined : "forwardTo"}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className={inputClass}
      >
        {verified.map((email) => (
          <option key={email} value={email}>
            {email}
          </option>
        ))}
        {pending.map((email) => (
          <option key={email} value={email} disabled>
            {email} (awaiting verification)
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {isOther && (
        <div className="mt-2 space-y-2">
          {verified.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="mb-1 font-semibold text-primary">Quick select verified mailboxes:</p>
              <div className="space-y-1">
                {verified.map((vEmail) => (
                  <label key={vEmail} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMultiple.includes(vEmail)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedMultiple, vEmail]
                          : selectedMultiple.filter((x) => x !== vEmail);
                        setSelectedMultiple(next);
                        if (customInputRef.current) {
                          customInputRef.current.value = next.join(", ");
                        }
                      }}
                      className="rounded border-slate-300 text-action focus:ring-action"
                    />
                    <span>{vEmail}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="sr-only" htmlFor="forwardToOther">
            Other mailbox
          </label>
          <input
            ref={customInputRef}
            id="forwardToOther"
            name="forwardTo"
            type="text"
            required
            defaultValue={initial.other}
            placeholder="e.g. team1@gmail.com, team2@gmail.com"
            aria-describedby="forwardToOther-warning"
            className={inputClass}
          />
          <p
            id="forwardToOther-warning"
            className="mt-1 text-xs font-medium text-danger"
            data-forward-other-warning
          >
            Cloudflare forwards only to verified destination addresses. Add and verify this mailbox
            in Email Routing, or mail to this address will not arrive.
          </p>
        </div>
      )}
    </>
  );
}

export function AddDestinationAddressForm() {
  const [state, action, saving] = useActionState(
    sendDestinationVerificationAction,
    initialClientSetupFormState,
  );
  return (
    <form action={action} className="space-y-3" data-client-setup-form="add-destination">
      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className={labelClass} htmlFor="destinationEmail">
            Verify a team mailbox
          </label>
          <input
            id="destinationEmail"
            name="email"
            type="email"
            required
            placeholder="e.g. colleague@gmail.com"
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={saving} className={buttonClass}>
          <Icon name="mail" className="h-4 w-4" />
          {saving ? "Sending…" : "Send verification email"}
        </button>
      </div>
      <p className="text-xs text-primary-muted">
        Sends a 1-click verification email from Cloudflare. Once verified, this mailbox can receive
        forwarded customer emails.
      </p>
    </form>
  );
}

export function AddInboundAddressForm({
  vendorId,
  defaultForward,
  destinations,
}: {
  vendorId: string;
  /** #1399 — the platform default inbox prefills Forward to; it stays editable and required. */
  defaultForward: InboundDefaultForward;
  /** #1392 — Cloudflare's destination addresses, or why they could not be read. */
  destinations: DestinationsResult;
}) {
  const prefill = defaultForward.status === "set" ? defaultForward.address : "";
  const [state, action, saving] = useActionState(
    addInboundAddressAction,
    initialClientSetupFormState,
  );
  return (
    <form action={action} className="space-y-4" data-client-setup-form="add-address">
      <FormMessage state={state} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="address">
            Receiving address
          </label>
          <input
            id="address"
            name="address"
            type="email"
            required
            placeholder="e.g. info@domain.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="purpose">
            Purpose
          </label>
          <select id="purpose" name="purpose" defaultValue="ORDERS" className={inputClass}>
            <option value="ORDERS">Orders</option>
            <option value="SUPPORT">Support</option>
          </select>
        </div>
      </div>

      <div>
        <p className={labelClass}>Forward to (the store&apos;s real mailbox)</p>
        {destinations.status === "ok" ? (
          <DualListboxTransferPicker
            verifiedAddresses={destinations.addresses.filter((a) => a.verified).map((a) => a.email)}
            pendingAddresses={destinations.addresses.filter((a) => !a.verified).map((a) => a.email)}
            initialSelected={prefill ? prefill.split(",").map((s) => s.trim()) : []}
          />
        ) : (
          <>
            <input
              id="forwardTo"
              name="forwardTo"
              type="text"
              required
              defaultValue={prefill}
              placeholder="e.g. team1@gmail.com, team2@gmail.com"
              aria-describedby={prefill ? "forwardTo-hint" : undefined}
              className={inputClass}
            />
            {prefill && (
              <p id="forwardTo-hint" className="mt-1 text-xs text-primary-muted">
                The platform default inbox. Change it if this store has its own mailbox.
              </p>
            )}
            <p className="mt-1 text-xs text-primary-muted" data-destinations-unavailable>
              {DESTINATIONS_UNAVAILABLE_MESSAGE[destinations.reason]}
            </p>
          </>
        )}
      </div>

      <button type="submit" disabled={saving} className={buttonClass}>
        <Icon name="plus" className="h-4 w-4" />
        {saving ? "Adding…" : "Add address"}
      </button>
    </form>
  );
}

export function InboundAddressRow({
  vendorId,
  address,
  destinations,
}: {
  vendorId: string;
  address: {
    id: string;
    address: string;
    purpose: "ORDERS" | "SUPPORT";
    forwardTo: string;
  };
  destinations: DestinationsResult;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, action, saving] = useActionState(
    updateInboundAddressAction,
    initialClientSetupFormState,
  );

  return isEditing ? (
    <li
      className="rounded-xl border border-action/40 bg-action-tint/20 p-3 my-2 space-y-3"
      data-edit-inbound-row={address.id}
    >
      <form action={action} className="space-y-3">
        <FormMessage state={state} />
        <input type="hidden" name="vendorId" value={vendorId} />
        <input type="hidden" name="id" value={address.id} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div>
            <span className="text-xs font-semibold text-primary-muted">Editing:</span>
            <span className="ml-2 font-bold text-primary">{address.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor={`edit-purpose-${address.id}`}
              className="text-xs font-semibold text-primary"
            >
              Purpose:
            </label>
            <select
              id={`edit-purpose-${address.id}`}
              name="purpose"
              defaultValue={address.purpose}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-primary"
            >
              <option value="ORDERS">Orders</option>
              <option value="SUPPORT">Support</option>
            </select>
          </div>
        </div>

        <div>
          <p className="block text-xs font-semibold text-primary mb-1">Forward to recipients</p>
          {destinations.status === "ok" ? (
            <DualListboxTransferPicker
              verifiedAddresses={destinations.addresses
                .filter((a) => a.verified)
                .map((a) => a.email)}
              pendingAddresses={destinations.addresses
                .filter((a) => !a.verified)
                .map((a) => a.email)}
              initialSelected={address.forwardTo.split(",").map((s) => s.trim())}
            />
          ) : (
            <input
              name="forwardTo"
              defaultValue={address.forwardTo}
              required
              className={inputClass}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-xl bg-action px-3 py-1.5 text-xs font-semibold text-white hover:bg-action/90 transition-colors shadow-sm"
          >
            <Icon name="check" className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </li>
  ) : (
    <li
      className="flex flex-wrap items-center justify-between gap-2 py-2"
      data-inbound-row={address.id}
    >
      <span className="min-w-0">
        <span className="font-semibold text-primary">{address.address}</span>
        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-primary-muted">
          {address.purpose === "ORDERS" ? "Orders" : "Support"}
        </span>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-action hover:bg-action-tint transition-colors"
          aria-label={`Edit ${address.address}`}
        >
          <Icon name="pencil" className="h-3.5 w-3.5" />
          Edit
        </button>
        <RemoveInboundAddressButton vendorId={vendorId} id={address.id} />
      </div>
    </li>
  );
}

export function RemoveInboundAddressButton({ vendorId, id }: { vendorId: string; id: string }) {
  const [state, action, removing] = useActionState(
    removeInboundAddressAction,
    initialClientSetupFormState,
  );
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="id" value={id} />
      {state.message && !state.ok && (
        <span role="alert" className="text-xs text-danger">
          {state.message}
        </span>
      )}
      <button
        type="submit"
        disabled={removing}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-tint"
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
        {removing ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}

export function TestEmailButton({
  vendorId,
  adminEmail,
}: {
  vendorId: string;
  adminEmail: string;
}) {
  const [state, action, sending] = useActionState(sendTestEmailAction, initialClientSetupFormState);
  return (
    <form action={action} className="space-y-3" data-client-setup-form="test-email">
      <FormMessage state={state} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <p className="text-xs text-primary-muted">Sends to your own address: {adminEmail}</p>
      <button type="submit" disabled={sending} className={buttonClass}>
        <Icon name="mail" className="h-4 w-4" />
        {sending ? "Sending…" : "Send test email"}
      </button>
    </form>
  );
}
