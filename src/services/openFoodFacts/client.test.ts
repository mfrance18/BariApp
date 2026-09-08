import { searchProductsByName } from './client';
import type { OffProduct } from './types';

function mockFetchOnce(products: OffProduct[]) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ products }),
  }) as unknown as typeof fetch;
}

describe('searchProductsByName', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('drops results whose displayed name/brand match none of the query words', async () => {
    mockFetchOnce([
      { code: '1', product_name: 'Simon life', brands: 'Don Simón' },
      { code: '2', product_name: 'Pulpy Orange Juice', brands: 'Minute Maid' },
    ]);

    const { products } = await searchProductsByName('Orange juice');

    expect(products.map((p) => p.code)).toEqual(['2']);
  });

  it('does not match through fields the row never displays (generic_name/categories)', async () => {
    mockFetchOnce([
      { code: '1', product_name: 'Simon life', brands: 'Don Simón', generic_name: 'Orange juice drink' },
    ]);

    const { products } = await searchProductsByName('Orange juice');

    expect(products).toEqual([]);
  });

  it('matches "Apple Sauce" against a product literally spelled "Applesauce", ignoring spacing', async () => {
    mockFetchOnce([{ code: 'motts', product_name: 'No Sugar Added Applesauce Apple', brands: "Mott's" }]);

    const { products } = await searchProductsByName('Apple Sauce');
    expect(products.map((p) => p.code)).toEqual(['motts']);
  });

  it('ranks a brand match above a name-only match', async () => {
    mockFetchOnce([
      { code: 'name-only', product_name: 'Simply Delicious Trail Mix', brands: 'Nature Valley' },
      { code: 'brand-match', product_name: 'Orange Juice', brands: 'Simply Orange' },
    ]);

    const { products } = await searchProductsByName('Simply');
    expect(products.map((p) => p.code)).toEqual(['brand-match', 'name-only']);
  });

  it('ranks an exact contiguous phrase above a match with the same words scattered apart', async () => {
    mockFetchOnce([
      { code: 'scattered', product_name: 'Orange Fanta Deliciously Good Juice' },
      { code: 'exact', product_name: 'Pulpy Orange Juice', brands: 'Minute Maid' },
    ]);

    const { products } = await searchProductsByName('Orange Juice');
    expect(products.map((p) => p.code)).toEqual(['exact', 'scattered']);
  });

  it('reports hasMore when a full page came back, and false for a partial page', async () => {
    const fullPage = Array.from({ length: 5 }, (_, i) => ({
      code: String(i),
      product_name: `Orange Juice ${i}`,
    }));
    mockFetchOnce(fullPage);
    const full = await searchProductsByName('Orange juice', 1, 5);
    expect(full.hasMore).toBe(true);

    mockFetchOnce(fullPage.slice(0, 3));
    const partial = await searchProductsByName('Orange juice', 1, 5);
    expect(partial.hasMore).toBe(false);
  });

  it('requests the given page number', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await searchProductsByName('juice', 3);

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('page=3');
  });

  it('returns an empty non-more page for a blank query without making a request', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await searchProductsByName('   ');
    expect(result).toEqual({ products: [], hasMore: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on a failed request instead of silently returning an empty page', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    await expect(searchProductsByName('juice')).rejects.toThrow();
  });
});
