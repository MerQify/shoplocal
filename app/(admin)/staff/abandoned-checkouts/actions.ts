"use server";

import { redirect } from "next/navigation";
import { requireVendorRole } from "@/lib/auth-rbac";
import {
  allocateAbandonedCheckoutIncentive,
  removeAbandonedCheckoutIncentive,
  reviewAbandonedCheckout,
  sendAbandonedCheckoutEmail,
  setAbandonedCheckoutContact,
} from "@/lib/abandoned-checkouts-service";

/**
 * #1554, rebuilt for #1732/#1733 — the staff actions on one abandoned checkout. Admin tier only,
 * re-checked here: the page's own gate does not protect a Server Action. The store and the acting
 * admin come from `requireVendorRole`, never from the form, and every rule is re-checked by the
 * service. Each action redirects back with a message (plain forms, no client JS).
 *
 * NOTE: async exports only (CLAUDE.md, Server Actions) — a constant here would break every action.
 */

async function admin() {
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) redirect("/staff/abandoned-checkouts?err=Only+store+admins+can+do+that.");
  return auth;
}

async function back(
  orderNumber: string,
  result: { ok: true } | { ok: false; error: string },
  done: string,
) {
  const params = new URLSearchParams(result.ok ? { msg: done } : { err: result.error });
  redirect(`/staff/abandoned-checkouts?${params.toString()}#${encodeURIComponent(orderNumber)}`);
}

function orderNumberFrom(formData: FormData): string {
  return formData.get("orderNumber")?.toString().trim() ?? "";
}

export async function reviewAction(formData: FormData): Promise<void> {
  const auth = await admin();
  const orderNumber = orderNumberFrom(formData);
  const result = await reviewAbandonedCheckout({
    vendorId: auth.vendorId,
    staffUserId: auth.user.id,
    orderNumber,
  });
  await back(orderNumber, result, `${orderNumber} marked reviewed.`);
}

export async function contactAction(formData: FormData): Promise<void> {
  const auth = await admin();
  const orderNumber = orderNumberFrom(formData);
  const allow = formData.get("allow") === "1";
  const result = await setAbandonedCheckoutContact({
    vendorId: auth.vendorId,
    staffUserId: auth.user.id,
    orderNumber,
    allow,
    reason: formData.get("reason")?.toString().trim() || null,
  });
  await back(
    orderNumber,
    result,
    allow ? `${orderNumber} can be contacted again.` : `${orderNumber} marked "Don't contact".`,
  );
}

export async function allocateAction(formData: FormData): Promise<void> {
  const auth = await admin();
  const orderNumber = orderNumberFrom(formData);
  const kind = formData.get("kind")?.toString();
  const pounds = (name: string) => Math.round(Number(formData.get(name)?.toString() || "0") * 100);
  const result =
    kind === "PERCENTAGE" || kind === "FIXED_AMOUNT" || kind === "FREE_DELIVERY"
      ? await allocateAbandonedCheckoutIncentive({
          vendorId: auth.vendorId,
          staffUserId: auth.user.id,
          orderNumber,
          incentive: {
            kind,
            amount:
              kind === "PERCENTAGE"
                ? Math.round(Number(formData.get("percent")?.toString() || "0"))
                : kind === "FIXED_AMOUNT"
                  ? pounds("amount")
                  : 0,
            minSubtotalPence: pounds("minSpend"),
            endsInDays: Math.round(Number(formData.get("days")?.toString() || "14")),
          },
        })
      : { ok: false as const, error: "Choose an incentive type." };
  await back(orderNumber, result, `Incentive allocated to ${orderNumber}.`);
}

export async function removeIncentiveAction(formData: FormData): Promise<void> {
  const auth = await admin();
  const orderNumber = orderNumberFrom(formData);
  const result = await removeAbandonedCheckoutIncentive({
    vendorId: auth.vendorId,
    staffUserId: auth.user.id,
    orderNumber,
  });
  await back(orderNumber, result, `Incentive removed from ${orderNumber}.`);
}

export async function sendAction(formData: FormData): Promise<void> {
  const auth = await admin();
  const orderNumber = orderNumberFrom(formData);
  const result = await sendAbandonedCheckoutEmail({
    vendorId: auth.vendorId,
    staffUserId: auth.user.id,
    orderNumber,
    discountCodeId: formData.get("discountCodeId")?.toString().trim() || null,
    confirmResend: formData.get("confirmResend") === "1",
  });
  await back(orderNumber, result, `Recovery email sent for ${orderNumber}.`);
}
