import { searchOpenverse } from "./openverse";
import { searchWikimedia } from "./wikimedia";
import { searchOpenFoodFacts } from "./open-food-facts";
import type { DiscoveredImage, DiscoverySearchParams, DiscoverySearchResult } from "./types";

export async function searchDiscoveredImages(
  params: DiscoverySearchParams,
  options?: { fetchFn?: typeof fetch },
): Promise<DiscoverySearchResult> {
  const query = params.query.trim();
  if (!query) {
    return { items: [] };
  }

  const provider = params.provider ?? "ALL";
  const limit = params.limit ?? 20;

  const tasks: Array<{
    name: string;
    promise: Promise<DiscoveredImage[]>;
  }> = [];

  if (provider === "ALL" || provider === "OPENVERSE") {
    tasks.push({
      name: "Openverse",
      promise: searchOpenverse(query, { limit, fetchFn: options?.fetchFn }),
    });
  }

  if (provider === "ALL" || provider === "WIKIMEDIA") {
    tasks.push({
      name: "Wikimedia Commons",
      promise: searchWikimedia(query, { limit, fetchFn: options?.fetchFn }),
    });
  }

  if (provider === "ALL" || provider === "OPEN_FOOD_FACTS") {
    tasks.push({
      name: "Open Food Facts",
      promise: searchOpenFoodFacts(query, { limit, fetchFn: options?.fetchFn }),
    });
  }

  const results = await Promise.allSettled(tasks.map((t) => t.promise));
  const items: DiscoveredImage[] = [];
  const errors: Record<string, string> = {};

  for (let i = 0; i < results.length; i++) {
    const outcome = results[i]!;
    const name = tasks[i]!.name;

    if (outcome.status === "fulfilled") {
      items.push(...outcome.value);
    } else {
      errors[name] =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
    }
  }

  // Interleave or sort results for balanced multi-provider viewing
  return {
    items: items.slice(0, limit * tasks.length),
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}
