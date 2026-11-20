import type { ProductImageSource } from "@/lib/product-image";
import type { HubSource } from "./client";

/**
 * #1671 R17 — the store `ProductImageSource` for a product image assigned from the hub.
 *
 * Mapped, not a new enum value, so every source-driven behaviour keeps working unchanged. A hub
 * `UPLOAD` maps to `UNKNOWN`, NOT `STAFF_UPLOAD`: a library image can be assigned to any number of
 * products, so it is not evidence of THIS product's pack (#900's `PHOTO_EVIDENCE_SOURCES`), and
 * `UNKNOWN` keeps the staff "confirm real photo" toggle available. Sources the store has no value
 * for yet (phase 3's licensed search, supplier feeds) are `UNKNOWN` too.
 */
export function storeSourceForHubSource(source: HubSource): ProductImageSource {
  switch (source) {
    case "AI_GENERATED":
      return "AI_GENERATED";
    case "OPEN_FOOD_FACTS":
      return "OPEN_FOOD_FACTS";
    default:
      return "UNKNOWN";
  }
}
