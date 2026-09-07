import { format } from 'date-fns';

/** Canonical YYYY-MM-DD key used for log_date columns, derived from a local timestamp. */
export function toLogDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function todayLogDateKey(): string {
  return toLogDateKey(new Date());
}

export function formatDisplayDate(dateKey: string): string {
  return format(new Date(`${dateKey}T00:00:00`), 'EEEE, MMM d');
}
