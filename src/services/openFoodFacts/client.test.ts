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

    const results = await searchProductsByName('Orange juice');

    expect(results.map((p) => p.code)).toEqual(['2']);
  });

  it('does not match through fields the row never displays (generic_name/categories)', async () => {
    mockFetchOnce([
      { code: '1', product_name: 'Simon life', brands: 'Don Simón', generic_name: 'Orange juice drink' },
    ]);

    const results = await searchProductsByName('Orange juice');

    expect(results).toEqual([]);
  });

  it('matches "Apple Sauce" against a product literally spelled "Applesauce", ignoring spacing', async () => {
    mockFetchOnce([{ code: 'motts', product_name: 'No Sugar Added Applesauce Apple', brands: "Mott's" }]);

    const results = await searchProductsByName('Apple Sauce');
    expect(results.map((p) => p.code)).toEqual(['motts']);
  });

  it('ranks an exact contiguous phrase above a match with the same words scattered apart', async () => {
    mockFetchOnce([
      { code: 'scattered', product_name: 'Orange Fanta Deliciously Good Juice' },
      { code: 'exact', product_name: 'Pulpy Orange Juice', brands: 'Minute Maid' },
    ]);

    const results = await searchProductsByName('Orange Juice');
    expect(results.map((p) => p.code)).toEqual(['exact', 'scattered']);
  });

  it('returns [] for a blank query without making a request', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const results = await searchProductsByName('   ');
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on a failed request instead of silently returning []', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    await expect(searchProductsByName('juice')).rejects.toThrow();
  });
});
