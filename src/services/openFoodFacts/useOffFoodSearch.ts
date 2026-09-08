import { useInfiniteQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '../../utils/useDebouncedValue';
import { searchProductsByName } from './client';

/** Searches Open Food Facts by name, debounced, paginated, only while `enabled`. */
export function useOffFoodSearch(query: string, enabled: boolean) {
  const debounced = useDebouncedValue(query.trim(), 400);
  const active = enabled && debounced.length > 1;

  const offQuery = useInfiniteQuery({
    queryKey: ['off', 'search', debounced],
    queryFn: ({ pageParam }) => searchProductsByName(debounced, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length + 1 : undefined),
    enabled: active,
    // OFF's free search endpoint has short-lived blips (503s) that a retry
    // reliably clears — retry a few times automatically before surfacing
    // an error the user has to act on.
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
  });

  return {
    results: offQuery.data?.pages.flatMap((page) => page.products) ?? [],
    loading: active && offQuery.isFetching && !offQuery.isFetchingNextPage,
    loadingMore: offQuery.isFetchingNextPage,
    hasMore: offQuery.hasNextPage,
    loadMore: offQuery.fetchNextPage,
    error: active && offQuery.isError ? (offQuery.error as Error) : null,
    retry: offQuery.refetch,
  };
}
