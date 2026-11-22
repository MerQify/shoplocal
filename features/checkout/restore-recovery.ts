"use server";

import { redirect } from "next/navigation";
import { getCurrentVendorId } from "@/lib/tenant";
import { getCartRepository } from "@/lib/cart-service";
import { getCartIdentity } from "@/lib/cart-identity";
import { scopedToUser } from "@/features/cart/shared";
import { restoredLines } from "@/lib/restore-lines";
import { buildRestoreNoticeUrl } from "@/lib/restore-notice";
import { findRecoverableByToken, recordRestore } from "@/lib/abandoned-checkouts-service";

/**
 * #1733 R21 — "Restore my basket" from a checkout-recovery email's link. The page at
 * `app/(storefront)/recover/[token]/page.tsx` only shows; this action acts — a GET must never
 * change anything, because link prefetchers, mail scanners and unfurlers follow URLs (#428).
 *
 * The token is a hidden field and therefore attacker-controlled: it is re-proved here, not trusted
 * from the page. Lines go into the VISITOR'S current basket at today's prices through the same
 * `restoredLines` the cancel and reorder paths use, which reports anything unavailable or short.
 * Any refusal lands on the same neutral page as an unknown link.
 *
 * NOTE: async exports only (CLAUDE.md, Server Actions).
 */
export async function restoreRecoveryBasket(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const vendorId = await getCurrentVendorId();
  const row = await findRecoverableByToken(vendorId, token);
  if (!row?.recovery) redirect(`/recover/${encodeURIComponent(token || "expired")}`);

  const scoped = scopedToUser(await getCartIdentity());
  const lines = await restoredLines(
    row.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
    })),
    (toAdd) => getCartRepository().addItems(scoped, toAdd),
  );
  await recordRestore(vendorId, row.recovery.id);

  const incentive = row.recovery.incentive;
  const code = incentive?.isActive ? incentive.code : null;
  const base = buildRestoreNoticeUrl("recovered", lines);
  const params = new URLSearchParams(base.includes("?") ? base.split("?")[1] : "");
  if (!params.has("restored")) params.set("restored", "recovered");
  if (code) params.set("code", code);
  redirect(`/cart?${params.toString()}`);
}
