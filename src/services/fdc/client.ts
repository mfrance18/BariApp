import type { FdcFood, FdcSearchResponse } from './types';

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

export interface FdcSearchPage {
  foods: FdcFood[];
  /** True if FDC reports more pages beyond this one (via totalPages). */
  hasMore: boolean;
}

/**
 * Searches USDA FoodData Central by name, one page at a time. Throws on any
 * non-2xx response (including a distinguishable message for a missing/bad
 * key or a rate limit) so a caller (e.g. a react-query queryFn) can tell
 * "the request failed" apart from "no matches" rather than showing both
 * identically — mirrors openFoodFacts/client.ts's searchProductsByName
 * contract.
 *
 * No `dataType` filter is sent — the mapper branches on each result's own
 * `dataType` field instead, since FDC's documented array-param encoding for
 * a GET request (vs. the POST-only examples commonly shown) isn't confirmed.
 */
export async function searchFoods(query: string, apiKey: string, page = 1, pageSize = 40): Promise<FdcSearchPage> {
  const trimmed = query.trim();
  if (!trimmed) return { foods: [], hasMore: false };

  const params = new URLSearchParams({
    api_key: apiKey,
    query: trimmed,
    pageSize: String(pageSize),
    pageNumber: String(page),
  });
  const response = await fetch(`${SEARCH_URL}?${params.toString()}`);

  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid USDA FoodData Central API key — check it in Settings.');
  }
  if (response.status === 429) {
    throw new Error('USDA FoodData Central rate limit reached — try again in a bit.');
  }
  if (!response.ok) {
    throw new Error(`USDA FoodData Central search failed (${response.status})`);
  }

  const data = (await response.json()) as FdcSearchResponse;
  const foods = data.foods ?? [];
  const totalPages = data.totalPages ?? 1;

  return { foods, hasMore: page < totalPages };
}
