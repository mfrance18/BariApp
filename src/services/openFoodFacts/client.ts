import type { OffProduct, OffProductResponse } from './types';

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
