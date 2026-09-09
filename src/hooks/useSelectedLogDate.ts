import { useQuery, useQueryClient } from '@tanstack/react-query';

import { todayLogDateKey } from '../utils/date';

/**
 * The log date currently selected on the Dashboard's date nav, shared
 * across tabs via the React Query cache (no navigation params/context
 * needed) so e.g. the Fluids tab shows the same day the Dashboard is on.
 */
const SELECTED_LOG_DATE_KEY = ['selectedLogDate'];

export function useSelectedLogDate() {
  const queryClient = useQueryClient();
  const { data: logDate = todayLogDateKey() } = useQuery({
    queryKey: SELECTED_LOG_DATE_KEY,
    queryFn: () => todayLogDateKey(),
    staleTime: Infinity,
  });

  function setLogDate(updater: string | ((prev: string) => string)) {
    queryClient.setQueryData(SELECTED_LOG_DATE_KEY, (prev: string | undefined) => {
      const base = prev ?? todayLogDateKey();
      return typeof updater === 'function' ? (updater as (p: string) => string)(base) : updater;
    });
  }

  return { logDate, setLogDate };
}
