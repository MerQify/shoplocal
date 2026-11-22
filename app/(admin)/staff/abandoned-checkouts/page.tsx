import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireVendorRole } from "@/lib/auth-rbac";
import {
  getAbandonedCheckoutsPage,
  previewAbandonedCheckout,
} from "@/lib/abandoned-checkouts-service";
import { ABANDONED_LIST_DAYS, REMINDER_WINDOW_DAYS } from "@/lib/abandoned-checkout/eligibility";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { PageContainer } from "@/components/layout/PageContainer";
import { AbandonedCheckoutList } from "./AbandonedCheckoutList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Abandoned checkouts" };

/**
 * #1554, rebuilt for #1732/#1733 — checkouts customers didn't pay for, and the staff-controlled
 * recovery of each: review, "Don't contact", a single-use incentive, a preview, then a manual email
 * (opted-in customers only, within the reminder window). Admin tier, like Customers. No automation.
 */
export default async function AbandonedCheckoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; preview?: string; code?: string }>;
}) {
  const { msg, err, preview, code } = await searchParams;
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login");
    return (
      <PanelRefusal
        title="Admins only"
        message="Abandoned checkouts and recovery emails are restricted to store admins."
      />
    );
  }

  const { rows, codes } = await getAbandonedCheckoutsPage(auth.vendorId);
  const sendable = rows.filter((r) => r.blockedReason === null).length;
  // R15 — a GET render of exactly what Send would build; nothing is claimed or sent.
  const previewResult = preview
    ? await previewAbandonedCheckout({
        vendorId: auth.vendorId,
        orderNumber: preview,
        discountCodeId: code || null,
      })
    : null;

  return (
    <PageContainer width="wide">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Abandoned checkouts</h1>
          <p className="mt-1 max-w-3xl text-sm text-primary-muted">
            Checkouts from the last {ABANDONED_LIST_DAYS} days that customers didn&apos;t pay for,
            with why. Review each one, give a signed-in customer a single-use incentive if you want,
            preview the email, then send it yourself — within {REMINDER_WINDOW_DAYS} days, and only
            to customers who have agreed to marketing emails. Guests are listed but can&apos;t be
            emailed. Nothing is sent automatically.
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm shadow-sm">
          <span className="font-bold text-primary">{sendable}</span>{" "}
          <span className="text-primary-muted">can be emailed</span> ·{" "}
          <span className="font-bold text-primary">{rows.length}</span>{" "}
          <span className="text-primary-muted">total</span>
        </div>
      </div>

      {msg && (
        <p
          role="status"
          className="mb-4 rounded-2xl bg-action/10 px-4 py-3 text-sm font-semibold text-action"
        >
          {msg}
        </p>
      )}
      {err && (
        <p
          role="alert"
          className="mb-4 rounded-2xl bg-danger-tint px-4 py-3 text-sm font-semibold text-danger"
        >
          {err}
        </p>
      )}

      {previewResult && (
        <section
          aria-label="Email preview"
          className="mb-6 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
        >
          {previewResult.ok ? (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold text-primary">Preview for {preview}</p>
                  <p className="text-xs text-primary-muted">
                    To: {previewResult.to ?? "no email address"} · Subject: {previewResult.subject}
                  </p>
                  <p className="text-xs text-primary-muted">
                    The real restore link is created when the email is sent.
                  </p>
                  {previewResult.blockedReason && (
                    <p className="text-xs font-bold text-danger">
                      Can&apos;t be sent: {previewResult.blockedReason}
                    </p>
                  )}
                </div>
                <a
                  href={`/staff/abandoned-checkouts#${encodeURIComponent(preview ?? "")}`}
                  className="text-xs underline"
                >
                  Close preview
                </a>
              </div>
              <iframe
                title={`Recovery email preview for ${preview}`}
                srcDoc={previewResult.html}
                sandbox=""
                className="h-[640px] w-full rounded-xl border border-black/10"
              />
            </>
          ) : (
            <p className="text-sm font-semibold text-danger">{previewResult.error}</p>
          )}
        </section>
      )}

      <AbandonedCheckoutList rows={rows} codes={codes} previewCodeId={code ?? ""} />
    </PageContainer>
  );
}
