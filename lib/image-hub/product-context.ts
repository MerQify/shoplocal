/**
 * #1678 — the text the product-page library picker searches with, so the closest library images
 * are listed first without typing. The hub's `sort=relevance` (#1677) matches each word, so this
 * only gathers the words: product name, then brand, then category.
 */

/** The hub refuses a `q` longer than this. */
export const HUB_QUERY_MAX = 200;

export function productContextQuery(input: {
  name: string;
  brandName?: string | null;
  categoryName?: string | null;
}): string {
  const tidy = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const name = tidy(input.name);
  const brand = tidy(input.brandName);
  const parts = [name];
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) parts.push(brand);
  parts.push(tidy(input.categoryName));
  const query = parts.filter(Boolean).join(" ");
  if (query.length <= HUB_QUERY_MAX) return query;
  const cut = query.lastIndexOf(" ", HUB_QUERY_MAX);
  return cut > 0 ? query.slice(0, cut) : query.slice(0, HUB_QUERY_MAX);
}
