import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProductStudioPrompt, sanitizePromptForSafety } from "@/lib/ai-image-prompts";
import { getImageGenerationService } from "@/lib/image-generation";

vi.mock("@/lib/config", () => ({
  getAiEnv: () => ({
    CLOUDFLARE_ACCOUNT_ID: "mock-account-id",
    CLOUDFLARE_API_TOKEN: "mock-api-token",
  }),
}));

describe("AI Image Prompt Safety & Disambiguation", () => {
  describe("sanitizePromptForSafety", () => {
    it("sanitizes poultry cut names prone to false-positive NSFW blocks (code 8007)", () => {
      expect(sanitizePromptForSafety("Halal Chicken Breasts 1kg")).toBe(
        "Halal poultry fillets on a wooden board 1kg",
      );
      expect(sanitizePromptForSafety("Fresh Chicken Thighs 500g")).toBe(
        "Fresh boneless leg cutlets on a wooden board 500g",
      );
      expect(sanitizePromptForSafety("Baby Chicken Whole")).toBe(
        "cornish game hens on butcher block Whole",
      );
      expect(sanitizePromptForSafety("Chicken Drumsticks Pack")).toBe(
        "poultry drumsticks on butcher block Pack",
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
    it("builds a clean commercial studio prompt with category and sanitized product name", () => {
      const prompt = buildProductStudioPrompt("Halal Chicken Breasts", "Meat & Poultry");
      expect(prompt).toBe(
        "Studio product photograph of Halal poultry fillets on a wooden board, Meat & Poultry, clean plain white background, professional commercial lighting, crisp focus, centered, 4k",
      );
    });

    it("builds a studio prompt when category is omitted or null", () => {
      const prompt = buildProductStudioPrompt("USB-C Cable", null);
      expect(prompt).toBe(
        "Studio product photograph of USB-C Cable, clean plain white background, professional commercial lighting, crisp focus, centered, 4k",
      );
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
      expect(retryBody.prompt).toContain("poultry fillets on a wooden board");
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
