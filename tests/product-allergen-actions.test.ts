import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchProductAllergenDraft,
  saveProductAllergenForm,
} from "@/features/admin/product-allergen-declarations";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  save: vi.fn(),
  lookup: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-rbac", () => ({
  requireVendorRole: async () => ({ ok: true, vendorId: "tenant-a" }),
}));
vi.mock("@/lib/product-allergen-service", () => ({
  getProductAllergenEditorData: mocks.find,
  saveProductAllergenDeclaration: mocks.save,
}));
vi.mock("@/lib/product-allergen-declaration", async (load) => ({
  ...(await load<typeof import("@/lib/product-allergen-declaration")>()),
  lookupAllergenDraft: mocks.lookup,
}));

beforeEach(() => vi.resetAllMocks());
describe("staff allergen actions", () => {
  it("resolves the stored barcode only for the current vendor and never saves the lookup", async () => {
    mocks.find.mockResolvedValue({ barcode: "3017620422003" });
    mocks.lookup.mockResolvedValue({
      ingredients: "milk",
      contains: "milk",
      mayContain: "",
      productName: null,
    });
    await expect(fetchProductAllergenDraft("product")).resolves.toMatchObject({ ok: true });
    expect(mocks.find).toHaveBeenCalledWith("tenant-a", "product");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("does not save a product outside the scope or a declaration without verification", async () => {
    const data = new FormData();
    data.set("ingredients", "milk");
    data.set("contains", "milk");
    data.set("mayContain", "");
    data.set("source", "Current label");
    await expect(saveProductAllergenForm("another-product", data)).resolves.toMatchObject({
      ok: false,
    });
    mocks.find.mockResolvedValue({ slug: "synthetic-product" });
    await expect(saveProductAllergenForm("product", data)).resolves.toMatchObject({ ok: false });
    expect(mocks.save).not.toHaveBeenCalled();
    data.set("confirmed", "yes");
    await expect(saveProductAllergenForm("product", data)).resolves.toMatchObject({ ok: true });
    expect(mocks.save).toHaveBeenCalledWith("product", {
      ingredients: "milk",
      contains: "milk",
      mayContain: "",
      source: "Current label",
    });
  });
});
