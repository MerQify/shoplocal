/**
 * Shared types and the two tables the icon system reads at render time (#1223, ADR-008).
 *
 * Kept free of React and of any generated import so that `scripts/build-icons.ts` (a Node script) and
 * the registry can both depend on it without pulling the component tree in.
 */

/** Where an inline icon's artwork comes from. Department tile illustrations are static files in `public/illustrations/departments/`. */
export type IconProvider = "lucide" | "ph" | "noto";

/**
 * Three distinct icon families for cohesive visual hierarchy:
 * - `functional`: Search, basket, account, navigation, checkout, and controls (standard 24x24 Lucide 1.5px SVG).
 * - `category`: Meat, poultry, seafood, groceries, vegetables, bakery, and dairy.
 * - `promotional`: Offers, bundles, savings, delivery, rewards, trust badges, and value framing.
 */
export type IconFamily = "functional" | "category" | "promotional";

/**
 * Standardised icon design specifications.
 */
export const ICON_BASE_GRID = 24;
export const ICON_STROKE_WEIGHT = 1.5;
export const ICON_SAFE_AREA_PX = 2;
export const ICON_CORNER_RADIUS_PX = 2;
export const ICON_LINE_CAP = "round" as const;
export const ICON_LINE_JOIN = "round" as const;
export const ICON_SCALE_STEPS = [16, 20, 24, 32] as const;

/**
 * `functional` — controls and navigation; Lucide only (enforced below by the type and by a test).
 * `status` — alerts and success; never colour-only.
 * `decorative` — meaning is carried by adjacent text; the tier that may carry a second hue.
 */
export type IconTier = "functional" | "status" | "decorative";

/**
 * The discriminated union is what makes "a functional icon cannot come from Phosphor" a COMPILE error
 * (R16), not only a test failure: `ICON_REGISTRY` is checked with `satisfies Record<string, RegistryEntry>`.
 */
export type RegistryEntry =
  | { tier: "functional"; provider: "lucide"; id: string }
  | { tier: "status" | "decorative"; provider: IconProvider; id: string };

/** What the generator emits per icon and what `Icon` renders. */
export interface IconData {
  /** `min-x min-y width height`, taken from the icon set's own defaults. */
  viewBox: string;
  /**
   * Presentation attributes hoisted onto the root `<svg>`. Lucide's Iconify data repeats them on every
   * child, where a root Tailwind class such as `fill-current` cannot reach them; `lucide-react` puts them
   * on the root, so callers rely on that (R13).
   */
  root: Record<string, string>;
  /** The inner markup, injected unescaped. Only ever build-time, generator-checked data. */
  body: string;
}

export const ICON_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/** Pixel size per token. 24 is also the default, matching `lucide-react`. */
export const SIZE_PX: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 48,
};
export const DEFAULT_SIZE_PX = 24;

export const ICON_TONES = ["current", "muted", "primary", "action", "accent", "danger"] as const;
export type IconTone = (typeof ICON_TONES)[number];

/**
 * Tone table (plan.md, "Tone map"). Class strings are written out in full so Tailwind's scanner sees
 * them; none of them carries an alpha modifier (design-system: no alpha on a themed foreground).
 */
export const TONE_CLASS: Record<IconTone, string | null> = {
  current: null,
  muted: "text-primary-muted",
  primary: "text-primary",
  action: "text-action",
  accent: "text-accent",
  danger: "text-danger",
};

/**
 * The second hue of a duotone icon, as a CSS variable `brandStyle()` already emits per vendor. A tone
 * with no entry leaves the icon exactly as drawn (one colour, faint secondary layer).
 */
export const TONE_SECONDARY: Record<IconTone, string | null> = {
  current: null,
  muted: null,
  primary: "var(--color-accent)",
  action: "var(--color-accent)",
  accent: "var(--color-action)",
  danger: "var(--color-accent)",
};

/** Opacity the secondary layer takes when a second hue is applied (the drawn default is .2). */
export const SECONDARY_OPACITY = ".7";

/**
 * Mapping of semantic icon keys to their visual design family.
 */
export const ICON_FAMILY_MAP: Record<string, IconFamily> = {
  // Functional family: Search, basket, account, navigation, controls, checkout
  "arrow-left": "functional",
  "arrow-right": "functional",
  ban: "functional",
  "book-a": "functional",
  "book-open": "functional",
  bookmark: "functional",
  "bookmark-plus": "functional",
  bug: "functional",
  check: "functional",
  "chevron-down": "functional",
  "chevron-left": "functional",
  "chevron-right": "functional",
  "chevron-up": "functional",
  "circle-question-mark": "functional",
  "circle-user-round": "functional",
  "clipboard-list": "functional",
  contact: "functional",
  copy: "functional",
  download: "functional",
  "external-link": "functional",
  eye: "functional",
  "eye-off": "functional",
  "folder-tree": "functional",
  gauge: "functional",
  globe: "functional",
  house: "functional",
  "image-up": "functional",
  layers: "functional",
  "layout-dashboard": "functional",
  "list-checks": "functional",
  "loader-circle": "functional",
  lock: "functional",
  "log-in": "functional",
  "log-out": "functional",
  mail: "functional",
  "map-pin": "functional",
  "message-circle": "functional",
  "message-square-quote": "functional",
  "messages-square": "functional",
  minus: "functional",
  navigation: "functional",
  "package-x": "functional",
  "panel-left-close": "functional",
  "panel-left-open": "functional",
  pause: "functional",
  pencil: "functional",
  phone: "functional",
  play: "functional",
  plus: "functional",
  repeat: "functional",
  "rotate-ccw": "functional",
  ruler: "functional",
  save: "functional",
  search: "functional",
  share: "functional",
  "shopping-bag": "functional",
  "shopping-cart": "functional",
  "sliders-horizontal": "functional",
  trash: "functional",
  upload: "functional",
  user: "functional",
  "user-check": "functional",
  "user-plus": "functional",
  "user-x": "functional",
  users: "functional",
  x: "functional",

  // Category family: Meat, poultry, seafood, groceries, vegetables, produce, dairy, bakery
  apple: "category",
  beef: "category",
  boxes: "category",
  coffee: "category",
  cookie: "category",
  croissant: "category",
  milk: "category",
  package: "category",
  "package-open": "category",
  store: "category",

  // Promotional family: Offers, bundles, savings, delivery, rewards, trust badges
  "badge-check": "promotional",
  banknote: "promotional",
  "bell-ring": "promotional",
  "calendar-clock": "promotional",
  "circle-alert": "promotional",
  "circle-check": "promotional",
  "circle-x": "promotional",
  clock: "promotional",
  coins: "promotional",
  "credit-card": "promotional",
  "featured-star": "promotional",
  gift: "promotional",
  heart: "promotional",
  "heart-outline": "promotional",
  megaphone: "promotional",
  percent: "promotional",
  "rewards-bag": "promotional",
  "rewards-coins": "promotional",
  "rewards-discount": "promotional",
  "rewards-gift": "promotional",
  "rewards-invite": "promotional",
  "rewards-sparkles": "promotional",
  shield: "promotional",
  "shield-alert": "promotional",
  "shield-check": "promotional",
  sparkles: "promotional",
  star: "promotional",
  tag: "promotional",
  "ticket-percent": "promotional",
  timer: "promotional",
  "trending-up": "promotional",
  "triangle-alert": "promotional",
  truck: "promotional",
  "trust-delivery": "promotional",
  "trust-payment": "promotional",
  "trust-updates": "promotional",
};
