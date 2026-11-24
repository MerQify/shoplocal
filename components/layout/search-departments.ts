import type { StorefrontCategoryNode } from "@/lib/repositories/categories";
import type { SearchDepartment } from "./DepartmentSearchBar";
import { sortCategoryTreeAlphabetical } from "@/lib/list-sorting";

export type { SearchDepartment };

/**
 * #1169 — the header search selector's options: every visible department in tree order, each
 * followed straight away by its visible subcategories (flagged so the select indents them).
 *
 * Built from `listTree()`, which returns visible rows naturally sorted A–Z across both tiers.
 * Children are collected and attached straight after their respective department.
 * A subcategory whose department is not in the list (hidden) is dropped,
 * matching `listTree()`'s own visibility rule. Pure, so it is tested without a database.
 */
export function toSearchDepartments(
  tree: readonly StorefrontCategoryNode[],
  options?: { sortAlphabetical?: boolean },
): SearchDepartment[] {
  const sourceTree = options?.sortAlphabetical ? sortCategoryTreeAlphabetical(tree) : tree;
  const departments = sourceTree.filter((node) => node.parentId === null);
  const childrenByParent = new Map<string, StorefrontCategoryNode[]>();
  for (const node of sourceTree) {
    if (node.parentId === null) continue;
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }
  return departments.flatMap((department) => [
    { slug: department.slug, name: department.name },
    ...(childrenByParent.get(department.id) ?? []).map((child) => ({
      slug: child.slug,
      name: child.name,
      isSubcategory: true,
    })),
  ]);
}
