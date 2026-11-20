// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * #1671 R8/R12 — the library grid: thumbnails come from the same-origin content route, "Load more"
 * follows the hub's cursor, and review controls render only for store admins.
 */

vi.mock("@/features/admin/image-library", () => ({
  approveLibraryAction: vi.fn(),
  assignToCategoryAction: vi.fn(),
  assignToProductAction: vi.fn(),
  finalizeCategoryAssignAction: vi.fn(),
  finalizeProductAssignAction: vi.fn(),
  listCategoriesForAssign: vi.fn(),
  rejectLibraryAction: vi.fn(),
  requestCategoryImageUpload: vi.fn(),
  searchLibraryAction: vi.fn(),
  searchProductsForAssign: vi.fn(),
}));
vi.mock("@/features/admin/product-image", () => ({ requestImageUpload: vi.fn() }));

import { ImageLibraryClient } from "@/components/staff/ImageLibraryClient";
import { rejectLibraryAction, searchLibraryAction } from "@/features/admin/image-library";
import type { HubAsset } from "@/lib/image-hub/client";

afterEach(cleanup);

function asset(i: number, overrides: Partial<HubAsset> = {}): HubAsset {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    title: `Image ${i}`,
    alt: null,
    status: "APPROVED",
    source: "UPLOAD",
    licence: "OWNER_SUPPLIED",
    attribution: null,
    originalUrl: null,
    sourceSite: null,
    contentType: "image/webp",
    byteSize: 100,
    width: 10,
    height: 10,
    storageKey: `tenants/t/${i}.webp`,
    createdAt: "2026-11-20T00:00:00Z",
    rejectionReason: null,
    ...overrides,
  };
}

const page = (items: HubAsset[], nextCursor: string | null) => ({ items, nextCursor });

function renderClient(props: Partial<Parameters<typeof ImageLibraryClient>[0]> = {}) {
  return render(
    <ImageLibraryClient
      initialPage={page([asset(1)], null)}
      initialError={null}
      q=""
      status=""
      canReview={false}
      canAssignCategory={false}
      {...props}
    />,
  );
}

describe("ImageLibraryClient", () => {
  it("shows Load more for a full page with a cursor, and not when the cursor is null", () => {
    const items = Array.from({ length: 24 }, (_, i) => asset(i));
    renderClient({ initialPage: page(items, "next-cursor") });
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
    cleanup();

    renderClient({ initialPage: page(items, null) });
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("renders each thumbnail from the same-origin content route with title, status and licence", () => {
    renderClient({
      initialPage: page([asset(7, { attribution: "Photo: A. Person, CC BY" })], null),
    });
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(
      "/api/admin/image-library/00000000-0000-4000-8000-000000000007/content",
    );
    const card = within(screen.getByRole("listitem"));
    expect(card.getByText("Image 7")).toBeTruthy();
    expect(card.getByText("Approved")).toBeTruthy();
    expect(card.getByText(/Our own image/)).toBeTruthy();
    expect(card.getByText("Photo: A. Person, CC BY")).toBeTruthy();
  });

  it("hides approve and reject from staff, and shows them to admins on pending images", () => {
    const pending = page([asset(1, { status: "PENDING_REVIEW" })], null);
    renderClient({ initialPage: pending, canReview: false });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    cleanup();

    renderClient({ initialPage: pending, canReview: true });
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });
});

describe("library search sort (#1678 R10)", () => {
  const items = Array.from({ length: 24 }, (_, i) => asset(i));
  const search = vi.mocked(searchLibraryAction);

  it("pages a typed search by relevance", async () => {
    search.mockResolvedValue({ ok: true, value: page([], null) });
    renderClient({ initialPage: page(items, "c1"), q: "basmati rice" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith({
        q: "basmati rice",
        status: undefined,
        sort: "relevance",
        cursor: "c1",
      }),
    );
  });

  it("pages an empty search newest first, with no sort", async () => {
    search.mockResolvedValue({ ok: true, value: page([], null) });
    renderClient({ initialPage: page(items, "c2"), q: "" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith({
        q: undefined,
        status: undefined,
        sort: undefined,
        cursor: "c2",
      }),
    );
  });
});

describe("reject an approved image (#1682)", () => {
  const reject = vi.mocked(rejectLibraryAction);
  const approved = () => page([asset(9, { status: "APPROVED" })], null);
  const IN_USE =
    "This image is used on a product or category. Remove it there first, then reject it.";

  it("offers Reject… on approved cards to admins only, leaving pending cards as before (R1)", () => {
    renderClient({ initialPage: approved(), canReview: false });
    expect(screen.queryByRole("button", { name: "Reject…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    cleanup();

    renderClient({ initialPage: approved(), canReview: true });
    expect(screen.getByRole("button", { name: "Reject…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByLabelText("Reason for rejecting")).toBeNull();
    cleanup();

    renderClient({
      initialPage: page([asset(1, { status: "PENDING_REVIEW" })], null),
      canReview: true,
    });
    expect(screen.queryByRole("button", { name: "Reject…" })).toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });

  it("asks for a reason before calling the action (R2)", () => {
    reject.mockReset();
    renderClient({ initialPage: approved(), canReview: true });
    fireEvent.click(screen.getByRole("button", { name: "Reject…" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("alert").textContent).toBe("Give a reason for rejecting it.");
    expect(reject).not.toHaveBeenCalled();
  });

  it("rejects with the reason and shows the rejected card (R2, R3)", async () => {
    reject.mockReset();
    reject.mockResolvedValue({
      ok: true,
      value: asset(9, { status: "REJECTED", rejectionReason: "Wrong pack" }),
    });
    renderClient({ initialPage: approved(), canReview: true });
    fireEvent.click(screen.getByRole("button", { name: "Reject…" }));
    fireEvent.change(screen.getByLabelText("Reason for rejecting"), {
      target: { value: "Wrong pack" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await screen.findByText("Rejected: Wrong pack");
    expect(reject).toHaveBeenCalledWith(asset(9).id, "Wrong pack");
    expect(screen.queryByRole("button", { name: "Assign…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject…" })).toBeNull();
  });

  it("explains an in-use refusal in plain words, and passes other messages through (R4)", async () => {
    reject.mockReset();
    reject.mockResolvedValueOnce({
      ok: false,
      code: "in_use",
      message: "The image is in use; remove its usages first",
      status: 409,
    });
    renderClient({ initialPage: approved(), canReview: true });
    fireEvent.click(screen.getByRole("button", { name: "Reject…" }));
    fireEvent.change(screen.getByLabelText("Reason for rejecting"), { target: { value: "Old" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(IN_USE));
    expect(screen.getByRole("button", { name: "Assign…" })).toBeTruthy();

    reject.mockResolvedValueOnce({ ok: false, code: "unreachable", message: "Hub down." });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Hub down."));
  });
});
