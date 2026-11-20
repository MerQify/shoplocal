import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireVendorRole } from "@/lib/auth-rbac";
import { isImageLibraryConfigured, searchImageLibrary } from "@/lib/image-hub-service";
import { librarySearchSort } from "@/lib/image-hub/search-sort";
import type { HubStatus } from "@/lib/image-hub/client";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImageLibraryClient } from "@/components/staff/ImageLibraryClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Image library" };

const STATUSES: readonly HubStatus[] = ["PENDING_REVIEW", "APPROVED", "REJECTED"];

/**
 * #1671 — the store's view of the Merqify Image Hub: search, preview, upload, review and assign.
 *
 * Staff and store admins may open it (R6). Approve, reject and assign-to-category are store-admin
 * only (owner decision, 2026-11-20); the page hides those controls from staff and the service
 * refuses them regardless (R12, R13).
 */
export default async function StaffImageLibraryPage(props: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login");
    return (
      <PanelRefusal
        title="Store staff only"
        message="You're signed in, but your account doesn't have access to this store's image library."
      />
    );
  }

  const header = (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-primary">Image library</h1>
      <p className="mt-1 text-sm text-primary-muted">
        Shared images for your products and categories. Upload an image, have a store admin approve
        it, then assign it where it belongs.
      </p>
    </div>
  );

  if (!(await isImageLibraryConfigured())) {
    return (
      <PageContainer width="wide">
        {header}
        <div className="rounded-xl border border-black/10 bg-surface-muted p-6 text-sm text-primary-muted">
          <p className="font-semibold text-primary">The image library isn&apos;t set up yet.</p>
          <p className="mt-1">
            This store has no connection to the image library. Ask your platform administrator to
            add it; nothing else in the store is affected.
          </p>
        </div>
      </PageContainer>
    );
  }

  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim() || undefined;
  const status = STATUSES.includes(searchParams.status as HubStatus)
    ? (searchParams.status as HubStatus)
    : undefined;
  const firstPage = await searchImageLibrary({ q, status, sort: librarySearchSort(q) });

  return (
    <PageContainer width="wide">
      {header}
      <ImageLibraryClient
        initialPage={firstPage.ok ? firstPage.value : { items: [], nextCursor: null }}
        initialError={firstPage.ok ? null : firstPage.message}
        q={q ?? ""}
        status={status ?? ""}
        canReview={auth.via !== "STAFF"}
        canAssignCategory={auth.via !== "STAFF"}
      />
    </PageContainer>
  );
}
