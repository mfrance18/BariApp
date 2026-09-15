import {
  listActiveVitaminsMeds,
  listSchedulesForVitaminMed,
  setScheduleNotificationIds,
  type MedSchedule,
} from '../../db/repositories/medsRepo';
import { isNotificationsSupported } from './environment';
import { MED_REMINDERS_CHANNEL_ID } from './permissions';

/** Schedules one weekly repeating notification per selected day for a med schedule. */
async function scheduleForMedSchedule(
  Notifications: typeof import('expo-notifications'),
  schedule: MedSchedule,
  title: string,
): Promise<string[]> {
  const [hour, minute] = schedule.timeOfDay.split(':').map(Number);
  const days = schedule.daysOfWeek.split(',').map(Number); // 0 (Sunday) .. 6 (Saturday)

  const ids: string[] = [];
  for (const day of days) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your vitamin/medication',
        body: title,
        // Lets a fired notification be matched back to its schedule later
        // (see dismissPresentedNotificationsForSchedule) — the presented
        // notification's own identifier is different from this request's.
        data: { medScheduleId: schedule.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day + 1, // expo-notifications: 1 = Sunday
        hour,
        minute,
        channelId: MED_REMINDERS_CHANNEL_ID,
      },
    });
    ids.push(id);
  }
  return ids;
}

/**
 * Cancels every notification this app has scheduled and re-creates them from
 * the current active med_schedule rows. Run on app startup and after any
 * vitamin/med or schedule edit, to avoid incremental add/remove diff bugs.
 *
 * No-ops in Expo Go (see ./environment.ts) — reminders require a
 * development or production build.
 */
export async function rescheduleAll(): Promise<void> {
  if (!isNotificationsSupported) return;

  const Notifications = await import('expo-notifications');
  await Notifications.cancelAllScheduledNotificationsAsync();

  const meds = await listActiveVitaminsMeds();
  for (const med of meds) {
    const schedules = await listSchedulesForVitaminMed(med.id);
    const title = med.dosageLabel ? `${med.name} — ${med.dosageLabel}` : med.name;
    for (const schedule of schedules.filter((s) => s.active)) {
      const ids = await scheduleForMedSchedule(Notifications, schedule, title);
      await setScheduleNotificationIds(schedule.id, ids.join(','));
    }
  }
}

/**
 * Clears this schedule's reminder from the system notification shade, if
 * it's currently showing there — used when the user marks a dose taken
 * from inside the app, so a reminder they've already acted on doesn't
 * linger. Best-effort: a failure here doesn't affect the taken/pending
 * status itself, which is already saved by the time this runs.
 */
export async function dismissPresentedNotificationsForSchedule(scheduleId: number): Promise<void> {
  if (!isNotificationsSupported) return;
  try {
    const Notifications = await import('expo-notifications');
    const presented = await Notifications.getPresentedNotificationsAsync();
    const matches = presented.filter((notification) => notification.request.content.data?.medScheduleId === scheduleId);
    await Promise.all(matches.map((notification) => Notifications.dismissNotificationAsync(notification.request.identifier)));
  } catch {
    // Best-effort — see doc comment above.
  }
}
