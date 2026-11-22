import { describe, expect, it, vi } from "vitest";
import {
  lookupAllergenDraft,
  productAllergenDeclarationSchema,
} from "@/lib/product-allergen-declaration";

const code = "3017620422003";

describe("product allergen declarations", () => {
  it("returns ingredients, contains and traces separately for the exact barcode", async () => {
    const fetchProduct = vi.fn(async () =>
      Response.json({
        status: 1,
        product: {
          code,
          product_name: "Synthetic packaged food",
          ingredients_text_en: "Milk, sugar",
          allergens_tags: ["en:milk"],
          traces_tags: ["en:hazelnuts"],
        },
      }),
    );
    await expect(lookupAllergenDraft(code, fetchProduct)).resolves.toEqual({
      ingredients: "Milk, sugar",
      contains: "milk",
      mayContain: "hazelnuts",
      productName: "Synthetic packaged food",
    });
    expect(fetchProduct).toHaveBeenCalledOnce();
  });

  it("keeps missing data and mismatched provider products unknown", async () => {
    const response = (product: object) => async () => Response.json({ status: 1, product });
    await expect(lookupAllergenDraft(code, response({ code }))).resolves.toBeNull();
    await expect(
      lookupAllergenDraft(code, response({ code: "0000000000000", allergens_tags: ["en:milk"] })),
    ).resolves.toBeNull();
  });

  it("requires manual verification and a source even when a declaration is populated", () => {
    const fields = {
      ingredients: "Milk",
      contains: "Milk",
      mayContain: "",
      source: "Current package label",
    };
    expect(productAllergenDeclarationSchema.safeParse(fields).success).toBe(false);
    expect(
      productAllergenDeclarationSchema.safeParse({ ...fields, source: "", confirmed: "yes" })
        .success,
    ).toBe(false);
    expect(
      productAllergenDeclarationSchema.safeParse({ ...fields, confirmed: "yes" }).success,
    ).toBe(true);
  });
});
