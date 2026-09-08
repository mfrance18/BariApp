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

/**
 * Searches products by name (free-text). Returns [] only when the search
 * genuinely found nothing — network/parse failures throw instead of being
 * swallowed, so a caller (e.g. a react-query queryFn) can tell "no matches"
 * apart from "the request failed" rather than showing both identically.
 *
 * OFF's own ranking mixes in scan popularity, which can bury an exact
 * textual match behind more-popular-but-less-relevant products. Re-sort the
 * fetched page so any product whose name/brand contains the search text
 * (ignoring spacing/punctuation, e.g. "applesauce" vs "Apple Sauce") floats
 * to the top, regardless of where OFF ranked it.
 */
export async function searchProductsByName(query: string, limit = 24): Promise<OffProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: '1',
    action: 'process',
    json: '1',
    fields: FIELDS,
    page_size: String(limit),
  });
  const response = await fetch(`${DOMAIN}/cgi/search.pl?${params.toString()}`, { headers: OFF_HEADERS });
  if (!response.ok) {
    throw new Error(`Open Food Facts search failed (${response.status})`);
  }
  const data = (await response.json()) as OffSearchResponse;
  const products = (data.products ?? []).filter((p) => p.code && p.product_name);

  const normalizedQuery = normalizeForMatch(trimmed);
  return products.sort((a, b) => {
    const aScore = normalizeForMatch(`${a.product_name ?? ''} ${a.brands ?? ''}`).includes(normalizedQuery) ? 0 : 1;
    const bScore = normalizeForMatch(`${b.product_name ?? ''} ${b.brands ?? ''}`).includes(normalizedQuery) ? 0 : 1;
    return aScore - bScore;
  });
}
