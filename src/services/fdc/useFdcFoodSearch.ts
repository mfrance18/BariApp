import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '../../utils/useDebouncedValue';
import { getFdcApiKey } from './apiKey';
import { searchFoods } from './client';

/** Searches USDA FoodData Central by name, debounced, paginated, only while `enabled` and an API key is set. */
export function useFdcFoodSearch(query: string, enabled: boolean) {
  const debounced = useDebouncedValue(query.trim(), 400);

  const apiKeyQuery = useQuery({
    queryKey: ['fdc', 'apiKey'],
    queryFn: getFdcApiKey,
    enabled,
    staleTime: 0,
  });
  const apiKey = apiKeyQuery.data ?? null;
  const needsApiKey = enabled && apiKeyQuery.isFetched && !apiKey;
  const active = enabled && !!apiKey && debounced.length > 1;

  const fdcQuery = useInfiniteQuery({
    queryKey: ['fdc', 'search', debounced],
    queryFn: ({ pageParam }) => searchFoods(debounced, apiKey as string, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length + 1 : undefined),
    enabled: active,
  });

  return {
    results: fdcQuery.data?.pages.flatMap((page) => page.foods) ?? [],
    loading: active && fdcQuery.isFetching && !fdcQuery.isFetchingNextPage,
    loadingMore: fdcQuery.isFetchingNextPage,
    hasMore: fdcQuery.hasNextPage,
    loadMore: fdcQuery.fetchNextPage,
    error: active && fdcQuery.isError ? (fdcQuery.error as Error) : null,
    retry: fdcQuery.refetch,
    needsApiKey,
  };
}
