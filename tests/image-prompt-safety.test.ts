import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProductStudioPrompt,
  detectPhotographyDomain,
  sanitizePromptForSafety,
} from "@/lib/ai-image-prompts";
import { getImageGenerationService } from "@/lib/image-generation";

vi.mock("@/lib/config", () => ({
  getAiEnv: () => ({
    CLOUDFLARE_ACCOUNT_ID: "mock-account-id",
    CLOUDFLARE_API_TOKEN: "mock-api-token",
  }),
}));

describe("AI Image Prompt Safety & Disambiguation", () => {
  describe("detectPhotographyDomain", () => {
    it("detects food domain from food/meat categories and products", () => {
      expect(detectPhotographyDomain("Halal Meat & Poultry", null, "Baby Chicken")).toBe("food");
      expect(detectPhotographyDomain(null, null, "Baby Chicken Whole")).toBe("food");
      expect(detectPhotographyDomain("Fresh Groceries", null, "Basmati Rice 5kg")).toBe("food");
      expect(detectPhotographyDomain("Dairy & Eggs", null, "Whole Milk 2L")).toBe("food");
      expect(detectPhotographyDomain("Bakery", null, "Pita Bread 6pk")).toBe("food");
      expect(detectPhotographyDomain("Drinks", null, "Orange Juice 1L")).toBe("food");
    });

    it("detects electronics domain from electric/appliance categories and products", () => {
      expect(detectPhotographyDomain("Electric Goods", null, "Electric Kettle 1.7L")).toBe(
        "electronics",
      );
      expect(detectPhotographyDomain("Electronics", null, "Smart Watch")).toBe("electronics");
      expect(
        detectPhotographyDomain(null, "Fast USB wall charger adapter", "65W GaN Charger"),
      ).toBe("electronics");
      expect(detectPhotographyDomain("Groceries", null, "AA Alkaline Batteries 4-pack")).toBe(
        "electronics",
      );
      expect(detectPhotographyDomain(null, null, "USB-C to Lightning Cable")).toBe("electronics");
    });

    it("detects household and health/beauty domains appropriately", () => {
      expect(
        detectPhotographyDomain("Household & Cleaning", null, "Multi-surface Cleaner 750ml"),
      ).toBe("household");
      expect(detectPhotographyDomain("Health & Beauty", null, "Moisturising Face Cream 50ml")).toBe(
        "beauty",
      );
      expect(detectPhotographyDomain(null, "gentle cleansing shampoo", "Argan Oil Hair Wash")).toBe(
        "beauty",
      );
    });

    it("falls back to general domain when neither category nor description matches", () => {
      expect(detectPhotographyDomain(null, null, "Generic Office Binder")).toBe("general");
    });
  });

  describe("sanitizePromptForSafety", () => {
    it("sanitizes poultry cut names prone to false-positive NSFW blocks (code 8007) and live animal generation", () => {
      expect(sanitizePromptForSafety("Halal Chicken Breasts 1kg")).toBe(
        "Halal fresh raw poultry fillets ready to cook 1kg",
      );
      expect(sanitizePromptForSafety("Fresh Chicken Thighs 500g")).toBe(
        "Fresh fresh raw boneless poultry cutlets ready to cook 500g",
      );
      expect(sanitizePromptForSafety("Baby Chicken Whole")).toBe(
        "fresh raw dressed whole baby poultry ready to cook Whole",
      );
      expect(sanitizePromptForSafety("Chicken Drumsticks Pack")).toBe(
        "fresh raw poultry drumsticks ready to cook Pack",
      );
      expect(sanitizePromptForSafety("Cocktail Sausages 400g")).toBe(
        "bite-size party sausages 400g",
      );
      expect(sanitizePromptForSafety("Beef Butt Steak")).toBe("Beef shoulder roast Steak");
    });

    it("preserves non-butchery grocery items unchanged", () => {
      expect(sanitizePromptForSafety("Basmati Rice 5kg")).toBe("Basmati Rice 5kg");
      expect(sanitizePromptForSafety("Semi Skimmed Milk 2L")).toBe("Semi Skimmed Milk 2L");
      expect(sanitizePromptForSafety("Fresh Gala Apples 6pk")).toBe("Fresh Gala Apples 6pk");
    });

    it("preserves non-food vendor products unchanged (multi-tenant safety)", () => {
      expect(sanitizePromptForSafety("USB-C Fast Charger 65W")).toBe("USB-C Fast Charger 65W");
      expect(sanitizePromptForSafety("Wireless Optical Mouse")).toBe("Wireless Optical Mouse");
      expect(sanitizePromptForSafety("AA Alkaline Batteries 4-pack")).toBe(
        "AA Alkaline Batteries 4-pack",
      );
    });
  });

  describe("buildProductStudioPrompt", () => {
    it("builds a commercial food photography prompt with strict anti-live-animal guardrails for butchery items", () => {
      const prompt = buildProductStudioPrompt("Baby Chicken", "Halal Poultry");
      expect(prompt).toContain(
        "Commercial food photography of fresh raw dressed whole baby poultry ready to cook, Halal Poultry",
      );
      expect(prompt).toContain(
        "No live animals, strictly no living birds, no feathers, no heads, no people, no hands",
      );
      expect(prompt).toContain("fresh food raw or prepared and ready to cook");
      // Must not contain keywords that generate live birds or wooden boards
      expect(prompt).not.toContain("cornish game hens");
      expect(prompt).not.toContain("butcher block");
    });

    it("builds a commercial electronic goods photography prompt for electric items", () => {
      const prompt = buildProductStudioPrompt("Electric Kettle 1.7L", "Electric Goods");
      expect(prompt).toContain(
        "Commercial electronic goods photography of Electric Kettle 1.7L, Electric Goods",
      );
      expect(prompt).toContain("pristine retail condition");
      expect(prompt).toContain("No live animals, strictly no people, no hands, no water, no food");
    });

    it("builds domain-directed prompt when category is omitted", () => {
      const prompt = buildProductStudioPrompt("USB-C Fast Charger 65W", null);
      expect(prompt).toContain("Commercial electronic goods photography of USB-C Fast Charger 65W");
      expect(prompt).toContain("pristine retail condition");
    });

    it("builds general studio prompt when domain is unidentified", () => {
      const prompt = buildProductStudioPrompt("Generic Office Binder", null);
      expect(prompt).toContain("Commercial studio product photography of Generic Office Binder");
      expect(prompt).toContain("pristine retail condition");
    });
  });

  describe("getImageGenerationService with NSFW auto-retry", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("transparently retries and succeeds when Cloudflare returns 400 NSFW (code 8007)", async () => {
      const fetchMock = vi
        .fn()
        // First attempt: Cloudflare blocks prompt with 8007
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({
              success: false,
              errors: [{ code: 8007, message: "AiError: Input prompt contains NSFW content." }],
            }),
          headers: new Headers(),
        })
        // Second attempt with sanitized prompt succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "image/png" }),
          arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
        });

      vi.stubGlobal("fetch", fetchMock);

      const ai = getImageGenerationService();
      const result = await ai.generateImage("Product photo of Chicken Breasts");

      expect(result).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify second call used sanitized prompt
      const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(retryBody.prompt).toContain("poultry fillets");
      expect(retryBody.prompt).not.toContain("Chicken Breasts");
    });

    it("throws clear error when retry also fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            success: false,
            errors: [{ code: 8007, message: "AiError: Input prompt contains NSFW content." }],
          }),
        headers: new Headers(),
      });

      vi.stubGlobal("fetch", fetchMock);

      const ai = getImageGenerationService();
      await expect(ai.generateImage("Product photo of Chicken Breasts")).rejects.toThrow(
        /AI generation failed: 400/,
      );
    });
  });
});
