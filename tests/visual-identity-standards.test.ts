import { describe, expect, it } from "vitest";
import { ICON_REGISTRY } from "@/components/icons/registry";
import {
  ICON_BASE_GRID,
  ICON_CORNER_RADIUS_PX,
  ICON_FAMILY_MAP,
  ICON_LINE_CAP,
  ICON_LINE_JOIN,
  ICON_SAFE_AREA_PX,
  ICON_SCALE_STEPS,
  ICON_STROKE_WEIGHT,
  type IconFamily,
} from "@/components/icons/types";
import {
  AI_ART_DIRECTION_STANDARDS,
  applyArtDirectionGuardrails,
  buildBundleImagePrompt,
  buildPromotionBannerPrompt,
  IMAGE_PROMPT_GUARDRAILS,
} from "@/lib/ai-image-prompts";
import { buildPromotionPrompt } from "@/lib/promotions-ai";
import iconTokens from "@/design-system/tokens/icons.json";

describe("Visual Identity Standards & Icon Families (#1602)", () => {
  it("defines standard icon specifications conforming to 24px grid and 1.5px baseline stroke", () => {
    expect(ICON_BASE_GRID).toBe(24);
    expect(ICON_STROKE_WEIGHT).toBe(1.5);
    expect(ICON_SAFE_AREA_PX).toBe(2);
    expect(ICON_CORNER_RADIUS_PX).toBe(2);
    expect(ICON_LINE_CAP).toBe("round");
    expect(ICON_LINE_JOIN).toBe("round");
    expect(ICON_SCALE_STEPS).toEqual([16, 20, 24, 32]);
  });

  it("maps every registered icon in ICON_REGISTRY to a distinct IconFamily", () => {
    const registryKeys = Object.keys(ICON_REGISTRY);
    const validFamilies: readonly IconFamily[] = ["functional", "category", "promotional"];

    expect(registryKeys.length).toBeGreaterThan(0);

    for (const key of registryKeys) {
      const family = ICON_FAMILY_MAP[key];
      expect(
        family,
        `Expected icon "${key}" to have a family mapping in ICON_FAMILY_MAP`,
      ).toBeDefined();
      expect(validFamilies).toContain(family);
    }
  });

  it("classifies core functional navigation and control icons under the functional family", () => {
    const functionalKeys = [
      "search",
      "shopping-cart",
      "shopping-bag",
      "user",
      "chevron-down",
      "chevron-right",
      "chevron-left",
      "arrow-left",
      "arrow-right",
      "x",
      "plus",
      "minus",
      "check",
      "copy",
      "log-in",
      "log-out",
    ];

    for (const key of functionalKeys) {
      expect(ICON_FAMILY_MAP[key]).toBe("functional");
    }
  });

  it("classifies department and grocery classification icons under the category family", () => {
    const categoryKeys = [
      "apple",
      "beef",
      "boxes",
      "coffee",
      "cookie",
      "croissant",
      "milk",
      "package",
      "package-open",
      "store",
    ];

    for (const key of categoryKeys) {
      expect(ICON_FAMILY_MAP[key]).toBe("category");
    }
  });

  it("classifies promotional, rewards, and trust badges under the promotional family", () => {
    const promoKeys = [
      "badge-check",
      "banknote",
      "featured-star",
      "gift",
      "rewards-gift",
      "rewards-discount",
      "rewards-coins",
      "rewards-bag",
      "trust-delivery",
      "trust-payment",
      "trust-updates",
      "ticket-percent",
      "percent",
      "shield-check",
    ];

    for (const key of promoKeys) {
      expect(ICON_FAMILY_MAP[key]).toBe("promotional");
    }
  });

  it("validates icon design token schema in design-system/tokens/icons.json", () => {
    expect(iconTokens.specifications.baseGrid.value).toBe(24);
    expect(iconTokens.specifications.strokeWeight.default.value).toBe(1.5);
    expect(iconTokens.specifications.safeArea.padding.value).toBe(2);
    expect(iconTokens.specifications.safeArea.activeArea.value).toBe(20);
    expect(iconTokens.families.functional).toBeDefined();
    expect(iconTokens.families.category).toBeDefined();
    expect(iconTokens.families.promotional).toBeDefined();
    expect(iconTokens.colorTokens.action.hex).toBe("#2E7D32");
    expect(iconTokens.colorTokens.accent.hex).toBe("#A85400");
  });
});

describe("AI Visual Art Direction & Generation Standards (#1602)", () => {
  it("enforces strict negative constraints in IMAGE_PROMPT_GUARDRAILS", () => {
    expect(IMAGE_PROMPT_GUARDRAILS).toMatch(/No live animals/i);
    expect(IMAGE_PROMPT_GUARDRAILS).toMatch(/no people/i);
    expect(IMAGE_PROMPT_GUARDRAILS).toMatch(/no hands/i);
    expect(IMAGE_PROMPT_GUARDRAILS).toMatch(/No text/i);
    expect(IMAGE_PROMPT_GUARDRAILS).toMatch(/no lettering/i);
    expect(IMAGE_PROMPT_GUARDRAILS).toMatch(/no labels/i);
    expect(IMAGE_PROMPT_GUARDRAILS).toMatch(/no logos/i);
  });

  it("defines comprehensive commercial food photography art direction standards", () => {
    expect(AI_ART_DIRECTION_STANDARDS.style).toMatch(/Commercial food photography/);
    expect(AI_ART_DIRECTION_STANDARDS.lighting).toMatch(/studio daylight/);
    expect(AI_ART_DIRECTION_STANDARDS.composition).toMatch(/3\/4 camera perspective/);
    expect(AI_ART_DIRECTION_STANDARDS.background).toMatch(/Clean neutral surface/);
    expect(AI_ART_DIRECTION_STANDARDS.negativeConstraints).toMatch(/No live animals/);
  });

  it("buildBundleImagePrompt applies commercial photography and guardrails", () => {
    const prompt = buildBundleImagePrompt("Family BBQ Pack", [
      { name: "Chicken Thighs", quantity: 4 },
      { name: "Lamb Chops", quantity: 2 },
    ]);

    expect(prompt).toContain("Family BBQ Pack");
    expect(prompt).toContain("4 × Chicken Thighs, 2 × Lamb Chops");
    expect(prompt).toContain("clean neutral surface");
    expect(prompt).toContain("three-quarter view");
    expect(prompt).toContain(IMAGE_PROMPT_GUARDRAILS);
  });

  it("buildPromotionBannerPrompt enforces asymmetric composition with empty space for text overlay", () => {
    const prompt = buildPromotionBannerPrompt("Halal Meat", "Weekend Savings");

    expect(prompt).toContain("Wide commercial banner photograph");
    expect(prompt).toContain("Generous empty space on the left for overlaid text");
    expect(prompt).toContain("subject on the right");
    expect(prompt).toContain(IMAGE_PROMPT_GUARDRAILS);
  });

  it("applyArtDirectionGuardrails wraps raw prompts with composition and negative constraints", () => {
    const bannerPrompt = applyArtDirectionGuardrails("Fresh Seasonal Fruit", true);
    expect(bannerPrompt).toContain("Wide banner composition");
    expect(bannerPrompt).toContain("generous negative space on the left");
    expect(bannerPrompt).toContain(IMAGE_PROMPT_GUARDRAILS);

    const productPrompt = applyArtDirectionGuardrails("Marinated Chicken Fillets", false);
    expect(productPrompt).toContain("three-quarter view");
    expect(productPrompt).toContain(IMAGE_PROMPT_GUARDRAILS);
  });

  it("buildPromotionPrompt instructs LLM to produce compliant Flux prompts with right-anchored subject and left negative space", () => {
    const prompt = buildPromotionPrompt({
      vendorId: "v1",
      targetType: "GENERIC",
      audienceSegment: "ALL",
      channel: "WEBSITE",
    });

    expect(prompt).toContain("natural realistic halal food photography");
    expect(prompt).toContain(
      "Subject arranged on the right with generous negative space on the left",
    );
    expect(prompt).toContain("Strictly NO text, NO labels, NO people, NO live animals");
  });
});
