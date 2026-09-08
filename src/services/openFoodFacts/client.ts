import type { OffProduct, OffProductResponse, OffSearchResponse } from './types';

const DOMAIN = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'generic_name',
  'categories',
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

/** All the text a product could plausibly be found by, normalized and joined. */
function productHaystack(product: OffProduct): string {
  return normalizeForMatch(
    [product.product_name, product.brands, product.generic_name, product.categories].filter(Boolean).join(' '),
  );
}

/**
 * Searches products by name (free-text). Returns [] only when the search
 * genuinely found nothing — network/parse failures throw instead of being
 * swallowed, so a caller (e.g. a react-query queryFn) can tell "no matches"
 * apart from "the request failed" rather than showing both identically.
 *
 * OFF's own search matches loosely (it can surface a product via a
 * category, generic name, or ingredients text that never appears in what
 * this app displays, so a result can look completely unrelated). Treat OFF
 * as a candidate source only: fetch a larger pool, then keep just the
 * products where every word of the query actually appears — as a
 * substring, ignoring spacing/punctuation — somewhere across the fields
 * shown to the user (name, brand, generic name, category), and rank an
 * exact contiguous phrase match above a same-words-anywhere match.
 */
export async function searchProductsByName(query: string, limit = 24): Promise<OffProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const queryWords = trimmed.split(/\s+/).map(normalizeForMatch).filter(Boolean);
  if (queryWords.length === 0) return [];
  const normalizedPhrase = queryWords.join('');

  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: '1',
    action: 'process',
    json: '1',
    fields: FIELDS,
    page_size: '40',
  });
  const response = await fetch(`${DOMAIN}/cgi/search.pl?${params.toString()}`, { headers: OFF_HEADERS });
  if (!response.ok) {
    throw new Error(`Open Food Facts search failed (${response.status})`);
  }
  const data = (await response.json()) as OffSearchResponse;
  const candidates = (data.products ?? []).filter((p) => p.code && p.product_name);

  const matches = candidates
    .map((product) => {
      const haystack = productHaystack(product);
      if (!queryWords.every((word) => haystack.includes(word))) return null;
      return { product, exactPhrase: haystack.includes(normalizedPhrase) };
    })
    .filter((entry): entry is { product: OffProduct; exactPhrase: boolean } => entry !== null);

  matches.sort((a, b) => Number(b.exactPhrase) - Number(a.exactPhrase));

  return matches.slice(0, limit).map((entry) => entry.product);
}
