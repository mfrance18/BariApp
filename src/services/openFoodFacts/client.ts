import type { OffProduct, OffProductResponse, OffSearchResponse } from './types';

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
].join(',');

/** Looks up a product by barcode. Returns null if not found or on any network/parse error. */
export async function getProductByBarcode(barcode: string): Promise<OffProduct | null> {
  try {
    const response = await fetch(`${BASE_URL}/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`);
    if (!response.ok) return null;
    const data = (await response.json()) as OffProductResponse;
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    return null;
  }
}

/** Searches products by name. Returns [] if nothing matches or on any network/parse error. */
export async function searchProductsByName(query: string, limit = 15): Promise<OffProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const params = new URLSearchParams({
      search_terms: trimmed,
      fields: FIELDS,
      page_size: String(limit),
    });
    const response = await fetch(`${BASE_URL}/search?${params.toString()}`);
    if (!response.ok) return [];
    const data = (await response.json()) as OffSearchResponse;
    return (data.products ?? []).filter((p) => p.code && p.product_name);
  } catch {
    return [];
  }
}
