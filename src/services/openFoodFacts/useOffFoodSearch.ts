import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '../../utils/useDebouncedValue';
import { searchProductsByName } from './client';

/** Searches Open Food Facts by name, debounced, only while `enabled`. */
export function useOffFoodSearch(query: string, enabled: boolean) {
  const debounced = useDebouncedValue(query.trim(), 400);
  const active = enabled && debounced.length > 1;

  const offQuery = useQuery({
    queryKey: ['off', 'search', debounced],
    queryFn: () => searchProductsByName(debounced),
    enabled: active,
    // OFF's free search endpoint has short-lived blips (503s) that a retry
    // reliably clears — retry a few times automatically before surfacing
    // an error the user has to act on.
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
  });

  return {
    results: offQuery.data ?? [],
    loading: active && offQuery.isFetching,
    error: active && offQuery.isError ? (offQuery.error as Error) : null,
    retry: offQuery.refetch,
  };
}
