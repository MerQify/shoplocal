/**
 * #1535, #1777, #1779 — prompts for AI photos of products, bundles, and promotion banners. Pure, DB-free, session-free.
 *
 * Earlier generated catalogue images came back with live animals in place of meat and with
 * garbled lettering (#1521, #1779), so every prompt here states explicit domain commercial photography
 * and negative constraints. The wording is vendor-neutral: what is pictured comes from the vendor's own
 * product names, categories, and descriptions, never hardcoded here.
 */

export interface PromptItem {
  name: string;
  quantity: number;
}

const MAX_ITEMS = 6;

/**
 * Art direction guidelines and quality standards for realistic commercial food photography.
 */
export const AI_ART_DIRECTION_STANDARDS = {
  style: "Commercial food photography, appetising, authentic, natural, realistic.",
  lighting:
    "Soft natural studio daylight, subtle specular highlights, soft ambient contact shadows.",
  composition:
    "Single clear focal point, 3/4 camera perspective, shallow depth of field, sharp focus on subject.",
  background:
    "Clean neutral surface (slate, light marble, natural wood, or subtle ceramic), zero visual clutter.",
  negativeConstraints:
    "No live animals, strictly no living birds, no feathers, no heads, no people, no hands, no distorted textures, no floating text, no lettering, no labels, no logos, no watermarks, no price tags.",
} as const;

/** The exclusions every generated photo carries. */
export const IMAGE_PROMPT_GUARDRAILS =
  "Show only the goods as a shop sells them: food raw or prepared and ready to cook, packaged goods in their packs. " +
  "No live animals, strictly no living birds, no feathers, no heads, no people, no hands. " +
  "No text, no lettering, no labels, no logos, no price tags.";

/** Guardrails specific to food, butchery, produce, and groceries. */
export const FOOD_PROMPT_GUARDRAILS =
  "Show only the goods as a shop sells them: fresh food raw or prepared and ready to cook, packaged groceries in retail packs. " +
  "No live animals, strictly no living birds, no feathers, no heads, no people, no hands. " +
  "No text, no lettering, no labels, no logos, no price tags.";

/** Guardrails specific to non-food retail goods (electronics, household, cosmetics, general). */
export const NON_FOOD_PROMPT_GUARDRAILS =
  "Show only the goods as a shop sells them in pristine retail condition. " +
  "No live animals, strictly no people, no hands, no water, no food. " +
  "No text, no lettering, no labels, no logos, no price tags.";

export type PhotographyDomain = "food" | "electronics" | "household" | "beauty" | "general";

const ELECTRONICS_PATTERN =
  /\b(electronic|electronics|electrical|electric goods|appliance|appliances|gadget|gadgets|tech|technology|computer|mobile|phone|smartphone|battery|batteries|cable|cables|charger|chargers|usb|hdmi|audio|headphones|earbuds|speaker|speakers|tv|television|camera|hardware)\b/i;

const BEAUTY_PATTERN =
  /\b(health|beauty|cosmetic|cosmetics|skincare|haircare|hair|personal care|pharmacy|wellness|makeup|fragrance|perfume|cologne|shampoo|conditioner|soap|body wash|lotion|moisturiser|moisturizer|deodorant|toothpaste)\b/i;

const HOUSEHOLD_PATTERN =
  /\b(household|cleaning|detergent|detergents|bleach|laundry|kitchenware|tableware|cookware|dishwashing|toilet paper|tissues|wipes|refuse sacks|bin bags|mop|homeware)\b/i;

const FOOD_PATTERN =
  /\b(food|grocery|groceries|fresh|produce|fruit|fruits|veg|vegetable|vegetables|meat|poultry|butchery|halal|beef|chicken|lamb|mutton|goat|pork|fish|seafood|bakery|bread|pastry|cake|dairy|milk|cheese|yogurt|yoghurt|butter|egg|eggs|drink|drinks|beverage|beverages|juice|soda|tea|coffee|snack|snacks|crisps|confection|confectionery|sweets|candy|chocolate|frozen|chilled|canned|pantry|spice|spices|herbs|seasoning|rice|flour|oil|sauce|condiment|deli|pasta|noodle|noodles|cereal)\b/i;

/**
 * Detects the commercial photography domain based on category name, product description, and product name.
 * Used to explicitly steer the AI generation prompt (e.g. food photography vs electronic goods photography).
 */
export function detectPhotographyDomain(
  categoryName?: string | null,
  description?: string | null,
  productName?: string | null,
): PhotographyDomain {
  const cat = (categoryName ?? "").trim();
  const desc = (description ?? "").trim();
  const prod = (productName ?? "").trim();
  const combined = `${cat} ${desc} ${prod}`.toLowerCase();

  // 1. Check category first if specific
  if (cat) {
    if (
      /\b(meat|poultry|butchery|halal|food|grocery|groceries|produce|fruit|veg|bakery|dairy|drinks?|beverage|seafood|fish|pantry|frozen|chilled)\b/i.test(
        cat,
      )
    ) {
      if (
        /\b(battery|batteries|charger|cable|usb|electronics?|electric goods|appliance)\b/i.test(
          prod,
        )
      ) {
        return "electronics";
      }
      return "food";
    }
    if (
      /\b(electronic|electronics|electrical|electric goods|appliances?|tech|gadgets?)\b/i.test(cat)
    ) {
      return "electronics";
    }
    if (/\b(health|beauty|cosmetics?|skincare|haircare|personal care|pharmacy)\b/i.test(cat)) {
      return "beauty";
    }
    if (/\b(household|cleaning|laundry|kitchenware|tableware|homeware)\b/i.test(cat)) {
      return "household";
    }
  }

  // 2. Check product name & description
  if (ELECTRONICS_PATTERN.test(prod) || ELECTRONICS_PATTERN.test(desc)) {
    return "electronics";
  }
  if (BEAUTY_PATTERN.test(prod) || BEAUTY_PATTERN.test(desc)) {
    return "beauty";
  }
  if (HOUSEHOLD_PATTERN.test(prod) || HOUSEHOLD_PATTERN.test(desc)) {
    return "household";
  }
  if (FOOD_PATTERN.test(prod) || FOOD_PATTERN.test(desc) || FOOD_PATTERN.test(combined)) {
    return "food";
  }

  return "general";
}

/**
 * Returns photography style prefix and domain-specific guardrails.
 */
export function getDomainPhotographyDetails(domain: PhotographyDomain): {
  prefix: string;
  guardrails: string;
} {
  switch (domain) {
    case "food":
      return {
        prefix: "Commercial food photography of",
        guardrails: FOOD_PROMPT_GUARDRAILS,
      };
    case "electronics":
      return {
        prefix: "Commercial electronic goods photography of",
        guardrails: NON_FOOD_PROMPT_GUARDRAILS,
      };
    case "household":
      return {
        prefix: "Commercial household goods photography of",
        guardrails: NON_FOOD_PROMPT_GUARDRAILS,
      };
    case "beauty":
      return {
        prefix: "Commercial health and beauty product photography of",
        guardrails: NON_FOOD_PROMPT_GUARDRAILS,
      };
    case "general":
    default:
      return {
        prefix: "Commercial studio product photography of",
        guardrails: NON_FOOD_PROMPT_GUARDRAILS,
      };
  }
}

/**
 * Applies visual art direction guardrails and negative prompt constraints to any raw AI image prompt.
 */
export function applyArtDirectionGuardrails(rawPrompt: string, isBanner = false): string {
  const base = rawPrompt.trim();
  const compositionRule = isBanner
    ? " Wide banner composition, generous negative space on the left for text overlay, primary subject arranged on the right."
    : " Clean neutral surface, three-quarter view, soft studio lighting, shallow depth of field.";
  return `${base}.${compositionRule} ${IMAGE_PROMPT_GUARDRAILS}`;
}

/** "4 × Medium Chicken (1100–1200g), 2 × Lamb Chops" — the first few items, largest quantity first. */
export function describeItems(items: readonly PromptItem[]): string {
  const sorted = [...items]
    .filter((item) => item.name.trim() !== "")
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, MAX_ITEMS);
  return sorted
    .map((item) =>
      item.quantity > 1 ? `${item.quantity} × ${item.name.trim()}` : item.name.trim(),
    )
    .join(", ");
}

export function buildBundleImagePrompt(bundleName: string, items: readonly PromptItem[]): string {
  const contents = describeItems(items) || bundleName.trim();
  return (
    `Commercial product photograph of a shop bundle called "${bundleName.trim()}": ${contents}, ` +
    "arranged together on a clean neutral surface, three-quarter view, soft studio lighting, sharp focus, appetising, realistic. " +
    IMAGE_PROMPT_GUARDRAILS
  );
}

/** Alt text for a generated bundle photo: what is in it, not how it looks. */
export function bundleImageAltText(bundleName: string, items: readonly PromptItem[]): string {
  const contents = describeItems(items);
  const text = contents ? `${bundleName.trim()}: ${contents}` : bundleName.trim();
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

/**
 * Cloudflare Workers AI safety filter flags raw butchery and anatomical cut names as NSFW (error 8007).
 * Sanitizes words so the model generates culinary and commercial product photography without false-positive blocks
 * and without triggering live animals or birds.
 */
export function sanitizePromptForSafety(text: string): string {
  return text
    .replace(/\bbaby\s+chickens?\b/gi, "fresh raw dressed whole baby poultry ready to cook")
    .replace(
      /\bmedium\s+chickens?(\s*\([^)]*\))?\b/gi,
      "fresh raw dressed whole roasting poultry ready to cook",
    )
    .replace(/\bhard\s+chickens?\b/gi, "fresh raw dressed whole stewing poultry ready to cook")
    .replace(/\bwhole\s+chickens?\b/gi, "fresh raw dressed whole poultry ready to cook")
    .replace(/\bchicken\s+breasts?(\s+fillets?)?\b/gi, "fresh raw poultry fillets ready to cook")
    .replace(
      /\bchicken\s+thighs?(\s+boneless)?\b/gi,
      "fresh raw boneless poultry cutlets ready to cook",
    )
    .replace(
      /\bboneless\s+chicken\s+thighs?\b/gi,
      "fresh raw boneless poultry cutlets ready to cook",
    )
    .replace(/\b(chicken\s+)?drumsticks?\b/gi, "fresh raw poultry drumsticks ready to cook")
    .replace(/\bbreasts?\s+fillets?\b/gi, "fresh raw fillets ready to cook")
    .replace(/\bbreasts?\b/gi, "fresh raw fillets ready to cook")
    .replace(/\bthighs?\b/gi, "fresh raw cutlets ready to cook")
    .replace(/\bniblets?\b/gi, "fresh raw bite-size poultry cuts ready to cook")
    .replace(/\bcocktail\s+sausages?\b/gi, "bite-size party sausages")
    .replace(/\bcocktail\b/gi, "party")
    .replace(/\b(pork|beef)\s+butt\b/gi, "$1 shoulder roast");
}

/**
 * Builds a clean, vendor-neutral, commercial studio product prompt.
 * Explicitly mentions domain-specific commercial photography (e.g. food photography or electronic goods photography)
 * and includes strict anti-live-animal and negative constraints.
 * Automatically sanitizes butchery/anatomical collision terms to prevent NSFW 8007 false positives.
 */
export function buildProductStudioPrompt(
  productName: string,
  categoryName?: string | null,
  description?: string | null,
): string {
  const domain = detectPhotographyDomain(categoryName, description, productName);
  const { prefix, guardrails } = getDomainPhotographyDetails(domain);
  const safeName = sanitizePromptForSafety(productName.trim());
  const categoryPart = categoryName && categoryName.trim() ? `, ${categoryName.trim()}` : "";
  return `${prefix} ${safeName}${categoryPart}, clean plain white background, professional commercial lighting, crisp focus, centered, 4k. ${guardrails}`;
}

/**
 * A wide banner photo for a promotion. `subject` is what the promotion sells (the product, the
 * bundle's contents or the department); the headline only sets the mood and is never drawn as text.
 */
export function buildPromotionBannerPrompt(subject: string, headline: string): string {
  const what = subject.trim() || headline.trim();
  return (
    `Wide commercial banner photograph for a shop promotion of ${what}. ` +
    `The offer is "${headline.trim()}", but do not write it anywhere. ` +
    "Generous empty space on the left for overlaid text, subject on the right, soft studio lighting, shallow depth of field, appetising, realistic. " +
    IMAGE_PROMPT_GUARDRAILS
  );
}
