/**
 * #1535, #1777, #1779, #1781 — prompts for AI photos of products, bundles, and promotion banners. Pure, DB-free, session-free.
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

/** Guardrails specific to non-food retail goods (electronics, household, cosmetics). */
export const NON_FOOD_PROMPT_GUARDRAILS =
  "Show only the goods as a shop sells them in pristine retail condition. " +
  "No live animals, strictly no people, no hands, no water, no food. " +
  "No text, no lettering, no labels, no logos, no price tags.";

/**
 * Guardrails for goods the domain detection could not place (#1781). They must not say "no food":
 * a grocery item whose name and category match no keyword (dal, ghee, plantain, tahini…) lands here,
 * and "no food" would contradict the very thing being photographed.
 */
export const GENERAL_PROMPT_GUARDRAILS =
  "Show only the goods as a shop sells them in pristine retail condition: fresh items ready to use, packaged goods in their retail packs. " +
  "No live animals, strictly no living birds, no people, no hands. " +
  "No text, no lettering, no labels, no logos, no price tags.";

export type PhotographyDomain = "food" | "electronics" | "household" | "beauty" | "general";

const ELECTRONICS_PATTERN =
  /\b(electronic|electronics|electrical|electric goods|appliance|appliances|gadget|gadgets|tech|technology|computer|computing|laptop|tablet|keyboard|mouse|monitor|router|wi-?fi|bluetooth|mobile|phone|smartphone|smartwatch|battery|batteries|cable|cables|charger|chargers|usb|hdmi|audio|headphones|earbuds|speaker|speakers|tv|television|camera|hardware|lamp|lamps|led|lighting)\b/i;

/** Category names that mark a whole aisle as electronics. */
const ELECTRONICS_CATEGORY_PATTERN =
  /\b(electronic|electronics|electrical|electric goods|appliances?|tech|gadgets?|audio|lighting|connectivity|networking|computing|chargers?|cables?)\b/i;

const BEAUTY_PATTERN =
  /\b(health|beauty|cosmetic|cosmetics|skincare|haircare|hair|personal care|pharmacy|wellness|makeup|fragrance|perfume|cologne|shampoo|conditioner|soap|body wash|lotion|moisturiser|moisturizer|deodorant|toothpaste)\b/i;

const HOUSEHOLD_PATTERN =
  /\b(household|cleaning|detergent|detergents|bleach|laundry|kitchenware|tableware|cookware|dishwashing|toilet paper|tissues|wipes|refuse sacks|bin bags|mop|homeware|home\s*(?:&|and)\s*living|candles?|foil|cling film)\b/i;

/**
 * Generic grocery vocabulary (no vendor's names). #1781 added the staples the first list missed —
 * pulses, ghee, flour, nuts, dates, okra, plantain, tahini, breakfast cereals, namkeen, paneer —
 * and plurals, so "Cooking Oils" or "Lentils & Pulses" no longer fall through to "general".
 */
const FOOD_PATTERN =
  /\b(foods?|grocery|groceries|fresh|produce|fruits?|veg|vegetables?|salads?|herbs?|meats?|poultry|butchery|halal|beef|chicken|lamb|mutton|goat|veal|pork|fish|seafood|bakery|breads?|loaves|pastry|pastries|cakes?|desserts?|dairy|milk|cream|cheese|paneer|yogurt|yoghurt|butter|ghee|eggs?|drinks?|beverages?|juices?|soda|tea|coffee|snacks?|crisps|namkeen|confection|confectionery|sweets|candy|chocolates?|biscuits?|frozen|chilled|canned|tinned|pantry|spices?|masala|seasonings?|rice|flour|atta|grains?|oils?|sauces?|condiments?|pickles?|chutneys?|pastes?|deli|pasta|noodles?|cereals?|breakfast|lentils?|pulses?|da{1,2}l|dha{1,2}l|beans|nuts|dried fruit|dates|plantains?|okra|tahini|hummus|honey|jam|sugar|baking|cooking|ready meals?|world foods)\b/i;

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
    if (FOOD_PATTERN.test(cat)) {
      if (
        /\b(battery|batteries|charger|cable|usb|electronics?|electric goods|appliance)\b/i.test(
          prod,
        )
      ) {
        return "electronics";
      }
      return "food";
    }
    if (ELECTRONICS_CATEGORY_PATTERN.test(cat)) {
      return "electronics";
    }
    if (/\b(health|beauty|cosmetics?|skincare|haircare|personal care|pharmacy)\b/i.test(cat)) {
      return "beauty";
    }
    if (
      /\b(household|cleaning|laundry|kitchenware|tableware|homeware|home\s*(?:&|and)\s*living|kitchen\s*(?:&|and)\s*foil)\b/i.test(
        cat,
      )
    ) {
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

const HEAD_PRODUCT_PATTERN = /\bheads?\b/i;
const WHOLE_FISH_PATTERN =
  /\bwhole\b.*\b(fish|bream|sea\s*bass|seabass|mackerel|sardines?|tilapia|pomfret|trout|snapper|hilsa|rohu|kingfish|herring|whiting|salmon|carp|catfish)\b|\b(fish|bream|sea\s*bass|seabass|mackerel|sardines?|tilapia|pomfret|trout|snapper|hilsa|rohu|kingfish|herring|whiting|salmon|carp|catfish)\b.*\bwhole\b/i;

/**
 * True when the goods themselves include a head: a product sold as a head (lamb head), or a whole
 * fish, which a fishmonger sells head-on (#1781). "No heads" would contradict those products; for
 * everything else it stays, so a dressed whole chicken is still pictured without one.
 */
export function goodsIncludeHead(subject: string): boolean {
  return HEAD_PRODUCT_PATTERN.test(subject) || WHOLE_FISH_PATTERN.test(subject);
}

/** Food guardrails, dropping "no heads" only when the goods themselves include one. */
export function foodGuardrailsFor(subject = ""): string {
  return goodsIncludeHead(subject)
    ? FOOD_PROMPT_GUARDRAILS.replace("no feathers, no heads,", "no feathers,")
    : FOOD_PROMPT_GUARDRAILS;
}

/**
 * Returns photography style prefix and domain-specific guardrails. `subject` is what is pictured
 * (product name, bundle contents or banner subject); it only adjusts the food guardrails.
 */
export function getDomainPhotographyDetails(
  domain: PhotographyDomain,
  subject = "",
): {
  prefix: string;
  guardrails: string;
} {
  switch (domain) {
    case "food":
      return {
        prefix: "Commercial food photography of",
        guardrails: foodGuardrailsFor(subject),
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
        guardrails: GENERAL_PROMPT_GUARDRAILS,
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

/**
 * A bundle photo. Like a product photo (#1781), the names are reworded for the safety filter and
 * the guardrails follow what the bundle contains, so a meat bundle gets food guardrails and an
 * electronics bundle is never called "appetising".
 */
export function buildBundleImagePrompt(bundleName: string, items: readonly PromptItem[]): string {
  const rawName = bundleName.trim();
  const rawContents = items.map((item) => item.name.trim()).join(", ");
  const name = sanitizePromptForSafety(rawName);
  const contents =
    describeItems(items.map((item) => ({ ...item, name: sanitizePromptForSafety(item.name) }))) ||
    name;
  const domain = detectPhotographyDomain(null, rawContents, rawName);
  const { guardrails } = getDomainPhotographyDetails(domain, `${rawName} ${rawContents}`);
  const finish = domain === "food" ? "appetising, realistic" : "realistic";
  return (
    `Commercial product photograph of a shop bundle called "${name}": ${contents}, ` +
    `arranged together on a clean neutral surface, three-quarter view, soft studio lighting, sharp focus, ${finish}. ` +
    guardrails
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
const WHOLE_BIRDS =
  "quails?|ducks?|ducklings?|poussins?|turkeys?|hens?|pigeons?|guinea\\s+fowls?|geese|goose|partridges?|pheasants?";

/**
 * Idempotent (#1781): running it on its own output changes nothing, because the backfill script
 * sanitises names that the prompt builders sanitise again.
 */
export function sanitizePromptForSafety(text: string): string {
  return (
    text
      .replace(/\bchicken\s+wings?\b/gi, "fresh raw poultry wing joints ready to cook")
      .replace(/\bchicken\s+legs?\b/gi, "fresh raw poultry leg portions ready to cook")
      .replace(/\bchicken\s+(?:feet|paws?)\b/gi, "cleaned raw poultry feet ready to cook")
      .replace(
        /\bchicken\s+(livers?|gizzards?|hearts?|necks?)\b/gi,
        "fresh raw poultry $1 ready to cook",
      )
      .replace(
        new RegExp(`(?<!dressed\\s)\\bwhole\\s+(${WHOLE_BIRDS})\\b`, "gi"),
        "fresh raw dressed whole $1 ready to cook",
      )
      // A name that is just the bird and its size ("Quail 4 pack", "Duck (2kg)", "Turkey")
      .replace(
        new RegExp(`^(\\s*)(${WHOLE_BIRDS})(?=\\s*(?:\\d|\\(|x\\b|pack\\b|$))`, "i"),
        "$1fresh raw dressed whole $2 ready to cook",
      )
      .replace(/\bgoat\b(?!\s+(?:meat|milk|cheese|butter|curd|yogh?urt))/gi, "goat meat")
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
      // Only poultry drumsticks: a bare "Drumsticks" may be the vegetable (moringa)
      .replace(
        /\b(?:chicken|turkey)\s+drumsticks?\b/gi,
        "fresh raw poultry drumsticks ready to cook",
      )
      .replace(/\bbreasts?\s+fillets?\b/gi, "fresh raw fillets ready to cook")
      .replace(/\bbreasts?\b/gi, "fresh raw fillets ready to cook")
      .replace(/\bthighs?\b/gi, "fresh raw cutlets ready to cook")
      // Only chicken niblets: sweetcorn niblets are a vegetable
      .replace(/\bchicken\s+niblets?\b/gi, "fresh raw bite-size poultry cuts ready to cook")
      .replace(/\bcocktail\s+sausages?\b/gi, "bite-size party sausages")
      .replace(/\bfruit\s+cocktail\b/gi, "mixed fruit salad")
      .replace(/\bprawn\s+cocktail\b/gi, "chilled prawn salad")
      .replace(/\bcocktail\b/gi, "party")
      .replace(/\b(pork|beef)\s+butt\b/gi, "$1 shoulder roast")
  );
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
  const { prefix, guardrails } = getDomainPhotographyDetails(domain, productName);
  const safeName = sanitizePromptForSafety(productName.trim());
  const categoryPart =
    categoryName && categoryName.trim() ? `, ${sanitizePromptForSafety(categoryName.trim())}` : "";
  return `${prefix} ${safeName}${categoryPart}, clean plain white background, professional commercial lighting, crisp focus, centered, 4k. ${guardrails}`;
}

/**
 * A wide banner photo for a promotion. `subject` is what the promotion sells (the product, the
 * bundle's contents or the department); the headline only sets the mood and is never drawn as text.
 */
export function buildPromotionBannerPrompt(subject: string, headline: string): string {
  const rawWhat = subject.trim() || headline.trim();
  const what = sanitizePromptForSafety(rawWhat);
  const offer = sanitizePromptForSafety(headline.trim());
  const domain = detectPhotographyDomain(null, headline, rawWhat);
  const { guardrails } = getDomainPhotographyDetails(domain, rawWhat);
  const finish = domain === "food" ? "appetising, realistic" : "realistic";
  return (
    `Wide commercial banner photograph for a shop promotion of ${what}. ` +
    `The offer is "${offer}", but do not write it anywhere. ` +
    `Generous empty space on the left for overlaid text, subject on the right, soft studio lighting, shallow depth of field, ${finish}. ` +
    guardrails
  );
}
