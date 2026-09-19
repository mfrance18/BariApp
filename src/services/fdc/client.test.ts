import { searchFoods } from './client';
import type { FdcFood } from './types';

function mockFetchOnce(foods: FdcFood[], totalPages = 1) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ foods, totalHits: foods.length, totalPages }),
  }) as unknown as typeof fetch;
}

describe('searchFoods', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns foods and hasMore from totalPages, not a page-size heuristic', async () => {
    mockFetchOnce([{ fdcId: 1, description: 'Orange Juice' }], 3);
    const page1 = await searchFoods('orange juice', 'KEY', 1);
    expect(page1.hasMore).toBe(true);

    mockFetchOnce([{ fdcId: 2, description: 'Orange Juice' }], 3);
    const page3 = await searchFoods('orange juice', 'KEY', 3);
    expect(page3.hasMore).toBe(false);
  });

  it('requests the given page number and api key', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ foods: [] }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await searchFoods('juice', 'MY_KEY', 2);

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('pageNumber=2');
    expect(requestedUrl).toContain('api_key=MY_KEY');
  });

  it('returns an empty non-more page for a blank query without making a request', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await searchFoods('   ', 'KEY');
    expect(result).toEqual({ foods: [], hasMore: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a distinguishable error for an invalid/missing API key', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    await expect(searchFoods('juice', 'BAD_KEY')).rejects.toThrow(/api key/i);
  });

  it('throws a distinguishable error when rate-limited', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    await expect(searchFoods('juice', 'KEY')).rejects.toThrow(/rate limit/i);
  });

  it('throws on a generic failed request instead of silently returning an empty page', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    await expect(searchFoods('juice', 'KEY')).rejects.toThrow();
  });
});
