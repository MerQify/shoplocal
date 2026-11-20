import type { HubSearchSort } from "@/lib/image-hub/client";

/**
 * #1678 R10 — a typed library search ranks by relevance; an empty one stays newest first. A plain
 * module so the browser bundle never pulls in the hub client's request path.
 */
export function librarySearchSort(q: string | undefined): HubSearchSort | undefined {
  return q?.trim() ? "relevance" : undefined;
}
