import { z } from "zod";

export const productAllergenDeclarationSchema = z
  .object({
    ingredients: z.string().trim().max(6000),
    contains: z.string().trim().max(1200),
    mayContain: z.string().trim().max(1200),
    source: z.string().trim().min(1).max(300),
    confirmed: z.literal("yes"),
  })
  .refine(({ ingredients, contains, mayContain }) => !!(ingredients || contains || mayContain));

export type AllergenDraft = Pick<
  z.infer<typeof productAllergenDeclarationSchema>,
  "ingredients" | "contains" | "mayContain"
>;

export async function lookupAllergenDraft(barcode: string, fetchProduct = fetch) {
  const code = barcode.trim();
  if (!/^\d{8,14}$/.test(code)) return null;
  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${code}`);
  url.searchParams.set(
    "fields",
    "code,product_name,ingredients_text_en,ingredients_text,allergens_tags,traces_tags",
  );
  const res = await fetchProduct(url, {
    headers: {
      "User-Agent":
        "AheedFoodCentre/1.0 (https://aheedfoodcentre.co.uk; info@aheedfoodcentre.co.uk)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("The barcode provider is unavailable.");
  const data = z
    .object({
      status: z.number(),
      product: z
        .object({
          code: z.string(),
          product_name: z.string().optional(),
          ingredients_text_en: z.string().optional(),
          ingredients_text: z.string().optional(),
          allergens_tags: z.array(z.string()).optional(),
          traces_tags: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .parse(await res.json());
  if (data.status !== 1 || data.product?.code !== code) return null;
  const product = data.product;
  const formatTags = (tags: string[] = []) =>
    tags
      .filter((tag) => /^en:[a-z][a-z-]*$/.test(tag))
      .map((tag) => tag.slice(3).replaceAll("-", " "))
      .join(", ")
      .slice(0, 1200);
  const draft = {
    ingredients: (product.ingredients_text_en || product.ingredients_text || "").slice(0, 6000),
    contains: formatTags(product.allergens_tags),
    mayContain: formatTags(product.traces_tags),
  };
  return draft.ingredients || draft.contains || draft.mayContain
    ? { ...draft, productName: product.product_name?.slice(0, 200) || null }
    : null;
}
