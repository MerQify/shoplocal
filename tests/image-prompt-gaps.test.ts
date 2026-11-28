import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBundleImagePrompt,
  buildProductStudioPrompt,
  buildPromotionBannerPrompt,
  detectPhotographyDomain,
  FOOD_PROMPT_GUARDRAILS,
  GENERAL_PROMPT_GUARDRAILS,
  goodsIncludeHead,
  NON_FOOD_PROMPT_GUARDRAILS,
  sanitizePromptForSafety,
} from "@/lib/ai-image-prompts";
import { getImageGenerationService } from "@/lib/image-generation";

vi.mock("@/lib/config", () => ({
  getAiEnv: () => ({
    CLOUDFLARE_ACCOUNT_ID: "mock-account-id",
    CLOUDFLARE_API_TOKEN: "mock-api-token",
  }),
}));

/**
 * #1781 — the gaps a review of #1777/#1779 found, each pinned with the real category and product
 * names that exposed it.
 */

describe("no 'no food' on food products (gap 1)", () => {
  it.each([
    ["Lentils & Pulses", "Toor Dal 2kg"],
    ["Cooking Oils", "Desi Ghee 1kg"],
    ["Breakfast Basics", "Weetabix"],
    ["Nuts & Dried Fruit", "Medjool Dates"],
    ["Crisps & Namkeen", "Bhujia"],
    [null, "Okra"],
    [null, "Plantain"],
    [null, "Tahini"],
  ])("detects %s / %s as food", (category, product) => {
    expect(detectPhotographyDomain(category, null, product)).toBe("food");
  });

  it("never tells an unplaced product 'no food'", () => {
    expect(GENERAL_PROMPT_GUARDRAILS).not.toMatch(/no food/i);
    expect(GENERAL_PROMPT_GUARDRAILS).toMatch(/No live animals/);
    expect(GENERAL_PROMPT_GUARDRAILS).toMatch(/No text/);
    // A regional aisle with an unrecognised product still lands in "general", and that is now safe
    const prompt = buildProductStudioPrompt("Egusi Seeds", "African & Caribbean");
    expect(prompt).not.toMatch(/no food/i);
  });

  it("still keeps non-food vendors' goods away from food", () => {
    expect(detectPhotographyDomain("Lighting", null, "LED Desk Lamp")).toBe("electronics");
    expect(detectPhotographyDomain("Connectivity", null, "Wi-Fi Router")).toBe("electronics");
    expect(detectPhotographyDomain("Home & Living", null, "Scented Candle")).toBe("household");
    expect(detectPhotographyDomain("Health & Beauty", null, "Coconut Hair Oil")).toBe("beauty");
    expect(buildProductStudioPrompt("LED Desk Lamp", "Lighting")).toContain(
      NON_FOOD_PROMPT_GUARDRAILS,
    );
  });
});

describe("bundles and banners get the product treatment (gap 2)", () => {
  it("rewords a meat bundle's items and uses food guardrails", () => {
    const prompt = buildBundleImagePrompt("BBQ Chicken Feast", [
      { name: "Medium Chicken (1100–1200g)", quantity: 2 },
      { name: "Chicken Drumsticks 1kg", quantity: 3 },
    ]);
    expect(prompt).not.toMatch(/medium chicken/i);
    expect(prompt).toContain("3 × fresh raw poultry drumsticks ready to cook 1kg");
    expect(prompt).toContain("2 × fresh raw dressed whole roasting poultry ready to cook");
    expect(prompt).toContain(FOOD_PROMPT_GUARDRAILS);
    expect(prompt).toContain("appetising");
  });

  it("never calls an electronics bundle appetising or food", () => {
    const prompt = buildBundleImagePrompt("Desk Setup Bundle", [
      { name: "LED Desk Lamp", quantity: 1 },
      { name: "USB-C Charger", quantity: 1 },
    ]);
    expect(prompt).not.toContain("appetising");
    expect(prompt).toContain(NON_FOOD_PROMPT_GUARDRAILS);
  });

  it("rewords a banner subject and headline, and follows the subject's domain", () => {
    const meat = buildPromotionBannerPrompt("Medium Chicken", "Medium Chicken Week");
    expect(meat).not.toMatch(/medium chicken/i);
    expect(meat).toContain(FOOD_PROMPT_GUARDRAILS);

    const tech = buildPromotionBannerPrompt("Chargers & Cables", "Charge Up Sale");
    expect(tech).not.toContain("appetising");
    expect(tech).toContain(NON_FOOD_PROMPT_GUARDRAILS);
  });
});

describe("heads are allowed when the goods include one (gap 3)", () => {
  it("drops 'no heads' for head products and whole fish only", () => {
    expect(goodsIncludeHead("Lamb Head")).toBe(true);
    expect(goodsIncludeHead("Whole Sea Bream")).toBe(true);
    expect(goodsIncludeHead("Tilapia Whole 1kg")).toBe(true);
    expect(goodsIncludeHead("Whole Chicken")).toBe(false);
    expect(goodsIncludeHead("Salmon Fillet")).toBe(false);

    expect(buildProductStudioPrompt("Lamb Head", "Lamb & Mutton")).not.toContain("no heads");
    expect(buildProductStudioPrompt("Whole Sea Bream", "Fish & Seafood")).not.toContain("no heads");
    expect(buildProductStudioPrompt("Whole Chicken", "Chicken & Poultry")).toContain("no heads");
  });
});

describe("rewording beyond chicken breasts and thighs (gap 4)", () => {
  it.each([
    ["Chicken Wings 1kg", "fresh raw poultry wing joints ready to cook 1kg"],
    ["Chicken Legs", "fresh raw poultry leg portions ready to cook"],
    ["Chicken Feet", "cleaned raw poultry feet ready to cook"],
    ["Chicken Livers 400g", "fresh raw poultry Livers ready to cook 400g"],
    ["Whole Quail", "fresh raw dressed whole Quail ready to cook"],
    ["Duck (2kg)", "fresh raw dressed whole Duck ready to cook (2kg)"],
    ["Poussin 2 pack", "fresh raw dressed whole Poussin ready to cook 2 pack"],
    ["Goat Curry Cut", "goat meat Curry Cut"],
    ["Turkey Drumsticks", "fresh raw poultry drumsticks ready to cook"],
  ])("rewords %s", (input, expected) => {
    expect(sanitizePromptForSafety(input)).toBe(expected);
  });

  it.each([
    "Sweetcorn Niblets 340g",
    "Drumsticks (Moringa) 250g",
    "Goat Milk 1L",
    "Duck Eggs 6pk",
    "Turkey Mince 500g",
  ])("leaves %s alone", (name) => {
    expect(sanitizePromptForSafety(name)).toBe(name);
  });

  it("rewords fruit and prawn cocktail as food, not as a party", () => {
    expect(sanitizePromptForSafety("Fruit Cocktail in Juice")).toBe("mixed fruit salad in Juice");
    expect(sanitizePromptForSafety("Prawn Cocktail")).toBe("chilled prawn salad");
  });

  it.each([
    "Medium Chicken (1100–1200g)",
    "Chicken Drumsticks Pack",
    "Turkey Drumsticks",
    "Whole Quail",
    "Duck (2kg)",
    "Goat Curry Cut",
    "Chicken Wings",
    "Halal Chicken Breasts 1kg",
    "Cocktail Sausages 400g",
    "Fruit Cocktail",
  ])("is idempotent for %s", (name) => {
    const once = sanitizePromptForSafety(name);
    expect(sanitizePromptForSafety(once)).toBe(once);
  });
});

describe("8007 retry only when rewording helps (gap 5)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const blocked = {
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ success: false, errors: [{ code: 8007, message: "NSFW" }] }),
    headers: new Headers(),
  };

  it("does not resend a prompt that rewording leaves unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(blocked);
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      getImageGenerationService().generateImage("Product photo of Basmati Rice 5kg"),
    ).rejects.toThrow(/AI generation failed: 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with the reworded prompt, never a doubled one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      });
    vi.stubGlobal("fetch", fetchMock);
    // A prompt built before #1781, carrying the raw name
    const prompt = `Commercial food photography of Chicken Wings. ${FOOD_PROMPT_GUARDRAILS}`;
    await getImageGenerationService().generateImage(prompt);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(fetchMock.mock.calls[1][1].body).prompt as string;
    expect(retry).toContain("poultry wing joints");
    expect(retry.match(/Commercial food photography of/g)).toHaveLength(1);
  });
});
