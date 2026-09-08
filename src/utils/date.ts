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

/** Formats a "HH:MM" 24-hour time (as stored on med_schedule) as e.g. "8:00 AM". */
export function formatTimeOfDay(timeOfDay: string): string {
  const [hourStr, minuteStr] = timeOfDay.split(':');
  const hour = Number(hourStr);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteStr} ${suffix}`;
}
