import type { OffProduct, OffProductResponse, OffSearchResponse } from './types';

const DOMAIN = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
].join(',');

// OFF asks every API client to identify itself via User-Agent; unidentified
// traffic can be rate-limited or served degraded (e.g. silently truncated)
// results, which looks exactly like "this exact search randomly finds
// nothing" from the app's side.
const OFF_HEADERS = { 'User-Agent': 'BariApp - Personal bariatric tracker (single-user, non-commercial)' };

/** Looks up a product by barcode. Returns null if not found or on any network/parse error. */
export async function getProductByBarcode(barcode: string): Promise<OffProduct | null> {
  try {
    const response = await fetch(`${DOMAIN}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: OFF_HEADERS,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OffProductResponse;
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    return null;
  }
}

/** Lowercases and strips everything but letters/digits, so "Apple Sauce" and "applesauce" compare equal. */
function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The text a product is actually shown by in the UI (name + brand), normalized and joined. */
function productHaystack(product: OffProduct): string {
  return normalizeForMatch([product.product_name, product.brands].filter(Boolean).join(' '));
}

/**
 * Ranks a brand match above a name match above the words just being
 * scattered across name+brand — so searching a brand name (e.g. "Simply")
 * puts that brand's products first, while a generic multi-word search (e.g.
 * "orange juice", which rarely matches a brand field literally) falls
 * through to ranking by name.
 */
function matchTier(product: OffProduct, normalizedPhrase: string): number {
  if (normalizeForMatch(product.brands ?? '').includes(normalizedPhrase)) return 0;
  if (productHaystack(product).includes(normalizedPhrase)) return 1;
  return 2;
}

export interface OffSearchPage {
  products: OffProduct[];
  /** True if OFF's own result set for this query likely has more beyond this page. */
  hasMore: boolean;
}

/**
 * Searches products by name (free-text), one page at a time. Returns an
 * empty, non-more page only when the search genuinely found nothing —
 * network/parse failures throw instead of being swallowed, so a caller
 * (e.g. a react-query queryFn) can tell "no matches" apart from "the
 * request failed" rather than showing both identically.
 *
 * OFF's own search matches loosely (it can surface a product via a
 * category, ingredients text, or other field this app never shows, so a
 * result can look completely unrelated to what was typed). Treat OFF as a
 * candidate source only: fetch a page of candidates, then keep just the
 * products where every word of the query actually appears — as a
 * substring, ignoring spacing/punctuation — in the same text the user sees
 * (name and brand only), ranked with matchTier above.
 */
export async function searchProductsByName(query: string, page = 1, pageSize = 40): Promise<OffSearchPage> {
  const trimmed = query.trim();
  if (!trimmed) return { products: [], hasMore: false };
  const queryWords = trimmed.split(/\s+/).map(normalizeForMatch).filter(Boolean);
  if (queryWords.length === 0) return { products: [], hasMore: false };
  const normalizedPhrase = queryWords.join('');

  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: '1',
    action: 'process',
    json: '1',
    // Bias toward well-known (heavily-scanned) products — for a broad query
    // (a brand name, a generic category) OFF can have thousands of matches,
    // and without this a specific well-known product can miss the page
    // entirely before this app's own filtering below even runs.
    sort_by: 'unique_scans_n',
    fields: FIELDS,
    page_size: String(pageSize),
    page: String(page),
  });
  const response = await fetch(`${DOMAIN}/cgi/search.pl?${params.toString()}`, { headers: OFF_HEADERS });
  if (!response.ok) {
    throw new Error(`Open Food Facts search failed (${response.status})`);
  }
  const data = (await response.json()) as OffSearchResponse;
  const rawCandidates = data.products ?? [];
  const candidates = rawCandidates.filter((p) => p.code && p.product_name);

  const matches = candidates
    .map((product) => {
      const haystack = productHaystack(product);
      if (!queryWords.every((word) => haystack.includes(word))) return null;
      return { product, tier: matchTier(product, normalizedPhrase) };
    })
    .filter((entry): entry is { product: OffProduct; tier: number } => entry !== null);

  matches.sort((a, b) => a.tier - b.tier);

  return {
    products: matches.map((entry) => entry.product),
    hasMore: rawCandidates.length >= pageSize,
  };
}
