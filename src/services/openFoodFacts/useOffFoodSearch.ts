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
    retry: 1,
  });

  return {
    results: offQuery.data ?? [],
    loading: active && offQuery.isFetching,
    error: active && offQuery.isError ? (offQuery.error as Error) : null,
    retry: offQuery.refetch,
  };
}
