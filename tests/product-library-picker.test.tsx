// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * #1678 R5–R7, R9 — the product page's library picker: prefilled with the product's context,
 * searches approved images by relevance, falls back to all approved images, pages with the cursor,
 * and assigns through the shared `library-assign` sequence. Hidden when the hub isn't configured.
 */

const mocks = vi.hoisted(() => ({
  searchLibraryAction: vi.fn(),
  assignLibraryAsset: vi.fn(),
}));

vi.mock("@/features/admin/image-library", () => ({
  searchLibraryAction: mocks.searchLibraryAction,
}));
vi.mock("@/components/staff/library-assign", () => ({
  assignLibraryAsset: mocks.assignLibraryAsset,
  libraryContentUrl: (id: string) => `/api/admin/image-library/${id}/content`,
}));
vi.mock("@/features/admin/catalogue", () => ({ saveProduct: vi.fn() }));
vi.mock("@/components/staff/ProductImageUploader", () => ({ ProductImageUploader: () => null }));
vi.mock("@/components/staff/ProductImageManager", () => ({ ProductImageManager: () => null }));

import { ProductLibraryPicker } from "@/components/staff/ProductLibraryPicker";
import { ProductForm } from "@/components/staff/ProductForm";
import type { HubAsset } from "@/lib/image-hub/client";
import type { AdminProductDetail } from "@/lib/repositories/products";

afterEach(cleanup);
beforeEach(() => {
  mocks.searchLibraryAction.mockReset();
  mocks.assignLibraryAsset.mockReset();
});

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const CONTEXT = "Tilda Basmati Rice Rice";

function asset(i: number, title: string): HubAsset {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    title,
    alt: `${title} alt`,
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
  };
}

const ok = (items: HubAsset[], nextCursor: string | null = null) => ({
  ok: true,
  value: { items, nextCursor },
});

function openPicker() {
  render(
    <ProductLibraryPicker
      productId={PRODUCT_ID}
      productName="Tilda Basmati Rice"
      contextQuery={CONTEXT}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Choose from library" }));
}

const titles = () =>
  screen.getAllByRole("button", { pressed: false }).map((b) => b.textContent?.trim());

describe("ProductLibraryPicker (#1678)", () => {
  it("prefills the context and first searches approved images by relevance (R6a–c)", async () => {
    mocks.searchLibraryAction.mockResolvedValue(
      ok([asset(1, "Tilda Basmati Rice"), asset(2, "Rice cakes"), asset(3, "Bowl")]),
    );
    openPicker();
    expect((screen.getByLabelText("Search the image library") as HTMLInputElement).value).toBe(
      CONTEXT,
    );
    expect(mocks.searchLibraryAction).toHaveBeenCalledWith({
      q: CONTEXT,
      status: "APPROVED",
      sort: "relevance",
    });
    await waitFor(() => expect(titles()).toEqual(["Tilda Basmati Rice", "Rice cakes", "Bowl"]));
    const img = screen.getByAltText("Tilda Basmati Rice alt");
    expect(img.getAttribute("src")).toBe(`/api/admin/image-library/${asset(1, "").id}/content`);
  });

  it("shows the empty state and falls back to all approved images, newest first (R6e)", async () => {
    mocks.searchLibraryAction.mockResolvedValueOnce(ok([]));
    openPicker();
    await screen.findByText(`No approved library images match "${CONTEXT}".`);
    mocks.searchLibraryAction.mockResolvedValueOnce(ok([asset(4, "Anything")]));
    fireEvent.click(screen.getByRole("button", { name: "Show all approved images" }));
    expect(mocks.searchLibraryAction).toHaveBeenLastCalledWith({ status: "APPROVED" });
    await waitFor(() => expect(titles()).toEqual(["Anything"]));
  });

  it("Load more appends the next page with the same search and the cursor (R6d)", async () => {
    mocks.searchLibraryAction.mockResolvedValueOnce(ok([asset(1, "First")], "cur-1"));
    openPicker();
    const more = await screen.findByRole("button", { name: "Load more" });
    mocks.searchLibraryAction.mockResolvedValueOnce(ok([asset(2, "Second")], null));
    fireEvent.click(more);
    expect(mocks.searchLibraryAction).toHaveBeenLastCalledWith({
      q: CONTEXT,
      status: "APPROVED",
      sort: "relevance",
      cursor: "cur-1",
    });
    await waitFor(() => expect(titles()).toEqual(["First", "Second"]));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows a hub failure as an alert (R6f)", async () => {
    mocks.searchLibraryAction.mockResolvedValue({
      ok: false,
      code: "unreachable",
      message: "The image library is unreachable.",
    });
    openPicker();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The image library is unreachable.",
    );
  });

  it("assigns the selected image with the chosen mode, then closes (R7)", async () => {
    mocks.searchLibraryAction.mockResolvedValue(ok([asset(1, "Tilda Basmati Rice")]));
    mocks.assignLibraryAsset.mockResolvedValue({ ok: true, warning: null });
    openPicker();
    const card = await screen.findByRole("button", { name: /Tilda Basmati Rice/ });
    fireEvent.click(card);
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Main image") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Additional image"));
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await screen.findByText("Assigned to Tilda Basmati Rice.");
    expect(mocks.assignLibraryAsset).toHaveBeenCalledWith(
      asset(1, "").id,
      { kind: "product", id: PRODUCT_ID, name: "Tilda Basmati Rice" },
      "additional",
      expect.any(Function),
    );
    expect(screen.queryByLabelText("Search the image library")).toBeNull();
  });

  it("keeps the panel open and shows the error when assigning fails (R7)", async () => {
    mocks.searchLibraryAction.mockResolvedValue(ok([asset(1, "Tilda Basmati Rice")]));
    mocks.assignLibraryAsset.mockResolvedValue({ ok: false, error: "Not approved." });
    openPicker();
    fireEvent.click(await screen.findByRole("button", { name: /Tilda Basmati Rice/ }));
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Not approved.");
    expect(screen.getByLabelText("Search the image library")).toBeTruthy();
  });
});

describe("ProductForm library picker gate (#1678 R5)", () => {
  const product = {
    id: PRODUCT_ID,
    name: "Tilda Basmati Rice",
    images: [],
    attributeValues: {},
    attributeNumbers: {},
  } as unknown as AdminProductDetail;
  const LABELS = {
    halal: false,
    fresh: false,
    organic: false,
    vegetarian: false,
    glutenFree: false,
    hmc: false,
  };
  const renderForm = (imageLibrary?: { configured: boolean; contextQuery: string }) =>
    render(
      <ProductForm
        product={product}
        categories={[]}
        brands={[]}
        imageUrls={[]}
        labels={LABELS}
        attributes={[]}
        imageLibrary={imageLibrary}
      />,
    );

  it("renders no picker when the library isn't configured or the prop is absent", () => {
    renderForm({ configured: false, contextQuery: CONTEXT });
    expect(screen.queryByRole("button", { name: "Choose from library" })).toBeNull();
    cleanup();
    renderForm();
    expect(screen.queryByRole("button", { name: "Choose from library" })).toBeNull();
  });

  it("renders the picker when configured", () => {
    renderForm({ configured: true, contextQuery: CONTEXT });
    expect(screen.getByRole("button", { name: "Choose from library" })).toBeTruthy();
  });
});
