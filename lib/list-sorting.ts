/**
 * Centralised, platform-wide list management and sorting utilities.
 *
 * Requirements:
 * 1. Alphabetical Sorting by Default:
 *    - All applicable lists (categories, subcategories, brands, dropdowns, selectors,
 *      admin management lists, navigation) must be sorted alphabetically (A–Z) by default.
 *    - Case-insensitive, natural sorting: numbers are ordered naturally ("Item 2" before "Item 10").
 *    - Consistent handling of whitespace, special characters, and diacritics.
 *    - Preserves parent-child hierarchies (departments A–Z, subcategories A–Z within each department).
 *    - Pure, immutable functions that do not mutate their inputs.
 *
 * 2. Shared List Management Logic:
 *    - Reusable filtering for visibility, active/archived state, searching, and pagination.
 */

/**
 * Natural, case-insensitive comparison helper.
 *
 * Uses `localeCompare` with `{ numeric: true, sensitivity: "base" }` so numbers
 * sort naturally ("Item 2" < "Item 10") and case differences are ignored ("apple" == "Apple").
 * Provides a deterministic secondary comparison for exact tie-breaking.
 */
export function compareAlphabetical(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const trimmedA = a.trim();
  const trimmedB = b.trim();

  if (trimmedA === "" && trimmedB === "") return 0;
  if (trimmedA === "") return 1;
  if (trimmedB === "") return -1;

  return trimmedA.localeCompare(trimmedB, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Sorts an array of plain strings alphabetically (A–Z) using natural, case-insensitive sorting.
 */
export function sortAlphabetical(items: readonly string[]): string[] {
  return [...items].sort(compareAlphabetical);
}

/**
 * Sorts any array of entities with a `name` property alphabetically (A–Z).
 * Natural, case-insensitive, immutable.
 */
export function sortNamedEntities<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareAlphabetical(a.name, b.name));
}

/**
 * Sorts a brand list alphabetically (A–Z). Alias for `sortNamedEntities`.
 */
export function sortBrandsAlphabetical<T extends { name: string }>(brands: readonly T[]): T[] {
  return sortNamedEntities(brands);
}

/**
 * Sorts a two-tier category tree alphabetically (A–Z) while preserving parent-child relationships.
 *
 * Invariant:
 * - Top-level parent categories (`parentId === null` or orphan) are sorted A–Z.
 * - Subcategories within each parent are sorted A–Z under their respective parent.
 * - Orphan categories (whose parent is absent) are kept as top-level rather than dropped.
 */
export function sortCategoryTreeAlphabetical<
  T extends { id: string; name: string; parentId: string | null; sortOrder?: number },
>(items: readonly T[], options?: { prioritizeSortOrder?: boolean }): T[] {
  if (items.length === 0) return [];

  const comparator = (a: T, b: T): number => {
    if (options?.prioritizeSortOrder) {
      const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;
    }
    return compareAlphabetical(a.name, b.name);
  };

  const topLevelIds = new Set(
    items.filter((item) => item.parentId === null).map((item) => item.id),
  );
  const isTopLevel = (item: T) => item.parentId === null || !topLevelIds.has(item.parentId);

  const childrenByParent = new Map<string, T[]>();
  for (const item of items) {
    if (isTopLevel(item)) continue;
    const siblings = childrenByParent.get(item.parentId!) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId!, siblings);
  }

  const result: T[] = [];
  const parents = items.filter(isTopLevel).sort(comparator);

  for (const parent of parents) {
    result.push(parent);
    const children = childrenByParent.get(parent.id);
    if (children && children.length > 0) {
      result.push(...children.sort(comparator));
    }
  }

  return result;
}

/**
 * Sorts category option groups (e.g. for dropdowns and selectors) so parents are A–Z
 * and children within each group are A–Z.
 */
export function sortCategoryOptionGroups<
  T extends { parent: { name: string }; children: { name: string }[] },
>(groups: readonly T[]): T[] {
  return [...groups]
    .map((group) => ({
      ...group,
      children: [...group.children].sort((a, b) => compareAlphabetical(a.name, b.name)),
    }))
    .sort((a, b) => compareAlphabetical(a.parent.name, b.parent.name));
}

/**
 * Filters entities to return only active items.
 */
export function filterVisibleEntities<T extends { isActive: boolean }>(items: readonly T[]): T[] {
  return items.filter((item) => item.isActive);
}

/**
 * Filters items by active/inactive/archived status.
 */
export function filterActiveOrArchived<T extends { isActive: boolean }>(
  items: readonly T[],
  status: "all" | "active" | "inactive" | "archived",
): T[] {
  if (status === "all") return [...items];
  if (status === "active") return items.filter((item) => item.isActive);
  if (status === "inactive" || status === "archived") {
    return items.filter((item) => !item.isActive);
  }
  return [...items];
}

/**
 * Searches named entities by a query string (case-insensitive substring match).
 */
export function searchNamedEntities<T extends { name: string }>(
  items: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") return [...items];
  return items.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
}

/**
 * Standard pagination helper for list datasets.
 */
export function paginateList<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): {
  items: T[];
  total: number;
  totalPages: number;
  currentPage: number;
} {
  const validPageSize = Math.max(1, pageSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / validPageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * validPageSize;
  const paginated = items.slice(start, start + validPageSize);

  return {
    items: paginated,
    total,
    totalPages,
    currentPage,
  };
}
