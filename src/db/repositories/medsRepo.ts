import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '../client';
import { medLog, medSchedule, vitaminsMeds } from '../schema';

export type VitaminMed = typeof vitaminsMeds.$inferSelect;
export type MedSchedule = typeof medSchedule.$inferSelect;
export type MedLog = typeof medLog.$inferSelect;

export async function listActiveVitaminsMeds(): Promise<VitaminMed[]> {
  return db
    .select()
    .from(vitaminsMeds)
    .where(eq(vitaminsMeds.active, true))
    .orderBy(asc(vitaminsMeds.sortOrder), asc(vitaminsMeds.id));
}

/**
 * Persists a new display order after a drag-and-drop reorder — `orderedIds`
 * is the full list of vitamin/med ids in their new order. Also drives the
 * order of the dashboard's checklist card (see getTodayChecklist below).
 */
export async function reorderVitaminsMeds(orderedIds: number[]): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(vitaminsMeds).set({ sortOrder: i, updatedAt: now }).where(eq(vitaminsMeds.id, orderedIds[i]));
  }
}

export async function getVitaminMedById(id: number): Promise<VitaminMed | null> {
  const rows = await db.select().from(vitaminsMeds).where(eq(vitaminsMeds.id, id));
  return rows[0] ?? null;
}

export async function getVitaminMedByBarcode(barcode: string): Promise<VitaminMed | null> {
  const rows = await db.select().from(vitaminsMeds).where(eq(vitaminsMeds.barcode, barcode));
  return rows[0] ?? null;
}

export async function createVitaminMed(input: {
  name: string;
  type: 'vitamin' | 'medication';
  dosageLabel: string | null;
  notes: string | null;
  barcode?: string | null;
}): Promise<VitaminMed> {
  const now = new Date().toISOString();
  const [{ maxSortOrder }] = await db
    .select({ maxSortOrder: sql<number>`coalesce(max(${vitaminsMeds.sortOrder}), -1)` })
    .from(vitaminsMeds);
  const rows = await db
    .insert(vitaminsMeds)
    .values({ ...input, sortOrder: maxSortOrder + 1, createdAt: now, updatedAt: now })
    .returning();
  return rows[0];
}

export async function updateVitaminMed(
  id: number,
  patch: Partial<{
    name: string;
    type: 'vitamin' | 'medication';
    dosageLabel: string | null;
    notes: string | null;
    barcode: string | null;
  }>,
): Promise<void> {
  await db
    .update(vitaminsMeds)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(vitaminsMeds.id, id));
}

/**
 * Permanently deletes a vitamin/medication along with its schedules and
 * historical taken/skipped log — nothing else in the app references a
 * vitamin/med, so unlike foods (which recipes depend on), there's no case
 * to guard against here. Foreign keys aren't enforced at the SQLite
 * connection level, so the schedule/log rows are removed explicitly rather
 * than relying on the schema's onDelete: 'cascade' to do it.
 */
export async function deleteVitaminMed(id: number): Promise<void> {
  const schedules = await db.select({ id: medSchedule.id }).from(medSchedule).where(eq(medSchedule.vitaminMedId, id));
  for (const schedule of schedules) {
    await db.delete(medLog).where(eq(medLog.medScheduleId, schedule.id));
  }
  await db.delete(medSchedule).where(eq(medSchedule.vitaminMedId, id));
  await db.delete(vitaminsMeds).where(eq(vitaminsMeds.id, id));
}

export async function listSchedulesForVitaminMed(vitaminMedId: number): Promise<MedSchedule[]> {
  return db.select().from(medSchedule).where(eq(medSchedule.vitaminMedId, vitaminMedId));
}

export async function createSchedule(input: {
  vitaminMedId: number;
  timeOfDay: string;
  daysOfWeek: string;
}): Promise<MedSchedule> {
  const now = new Date().toISOString();
  const rows = await db
    .insert(medSchedule)
    .values({ ...input, createdAt: now, updatedAt: now })
    .returning();
  return rows[0];
}

export async function updateSchedule(
  id: number,
  patch: Partial<{ timeOfDay: string; daysOfWeek: string; active: boolean }>,
): Promise<void> {
  await db
    .update(medSchedule)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(medSchedule.id, id));
}

export async function setScheduleNotificationIds(id: number, notificationIdsCsv: string | null): Promise<void> {
  await db
    .update(medSchedule)
    .set({ notificationId: notificationIdsCsv, updatedAt: new Date().toISOString() })
    .where(eq(medSchedule.id, id));
}

export async function deleteSchedule(id: number): Promise<void> {
  await db.delete(medSchedule).where(eq(medSchedule.id, id));
}

export interface TodayChecklistItem {
  scheduleId: number;
  vitaminMedId: number;
  name: string;
  type: 'vitamin' | 'medication';
  dosageLabel: string | null;
  /** The effective time for today — the reschedule override if one is set, otherwise the schedule's normal time. */
  timeOfDay: string;
  /** The schedule's normal time, regardless of any reschedule — for showing "originally 8:00 AM" context. */
  originalTimeOfDay: string;
  /** Set only when this one day's dose was moved to a different time (see rescheduleMedForDate). */
  rescheduledTimeOfDay: string | null;
  status: 'taken' | 'skipped' | 'pending';
}

/** `daysOfWeek` uses JS `Date#getDay()` convention: 0 = Sunday .. 6 = Saturday. */
export async function getTodayChecklist(scheduledDate: string, today: Date = new Date()): Promise<TodayChecklistItem[]> {
  const todayDay = String(today.getDay());

  const rows = await db
    .select({ schedule: medSchedule, med: vitaminsMeds })
    .from(medSchedule)
    .innerJoin(vitaminsMeds, eq(medSchedule.vitaminMedId, vitaminsMeds.id))
    .where(and(eq(medSchedule.active, true), eq(vitaminsMeds.active, true)));

  const todaySchedules = rows.filter((row) => row.schedule.daysOfWeek.split(',').includes(todayDay));

  const logRows = await db.select().from(medLog).where(eq(medLog.scheduledDate, scheduledDate));
  const logByScheduleId = new Map(logRows.map((log) => [log.medScheduleId, log]));

  return todaySchedules
    .map((row) => {
      const log = logByScheduleId.get(row.schedule.id);
      const effectiveTimeOfDay = log?.rescheduledTimeOfDay ?? row.schedule.timeOfDay;
      return { row, log, effectiveTimeOfDay };
    })
    // Primarily by the EFFECTIVE time of day (today's reschedule, if any),
    // with the vitamin/med's own drag-and-drop order (see
    // reorderVitaminsMeds) as a tiebreak for same-time reminders.
    .sort((a, b) => a.effectiveTimeOfDay.localeCompare(b.effectiveTimeOfDay) || a.row.med.sortOrder - b.row.med.sortOrder)
    .map(({ row, log, effectiveTimeOfDay }) => {
      return {
        scheduleId: row.schedule.id,
        vitaminMedId: row.med.id,
        name: row.med.name,
        type: row.med.type,
        dosageLabel: row.med.dosageLabel,
        timeOfDay: effectiveTimeOfDay,
        originalTimeOfDay: row.schedule.timeOfDay,
        rescheduledTimeOfDay: log?.rescheduledTimeOfDay ?? null,
        status: (log?.status === 'taken' || log?.status === 'skipped' ? log.status : 'pending') as
          | 'taken'
          | 'skipped'
          | 'pending',
      };
    });
}

export async function setStatus(
  scheduleId: number,
  scheduledDate: string,
  status: 'taken' | 'skipped',
): Promise<void> {
  const existing = await db
    .select()
    .from(medLog)
    .where(and(eq(medLog.medScheduleId, scheduleId), eq(medLog.scheduledDate, scheduledDate)));

  const now = new Date().toISOString();
  if (existing.length > 0) {
    await db
      .update(medLog)
      .set({ status, takenAt: status === 'taken' ? now : null })
      .where(eq(medLog.id, existing[0].id));
  } else {
    await db.insert(medLog).values({
      medScheduleId: scheduleId,
      scheduledDate,
      status,
      takenAt: status === 'taken' ? now : null,
      createdAt: now,
    });
  }
}

/**
 * Clears back to "pending". If the row only exists to carry a reschedule
 * override (see rescheduleMedForDate), that override is kept and just the
 * status is cleared, rather than deleting the row.
 */
export async function clearStatus(scheduleId: number, scheduledDate: string): Promise<void> {
  const existing = await db
    .select()
    .from(medLog)
    .where(and(eq(medLog.medScheduleId, scheduleId), eq(medLog.scheduledDate, scheduledDate)));

  if (existing.length === 0) return;
  if (existing[0].rescheduledTimeOfDay != null) {
    await db.update(medLog).set({ status: null, takenAt: null }).where(eq(medLog.id, existing[0].id));
  } else {
    await db.delete(medLog).where(eq(medLog.id, existing[0].id));
  }
}

async function setRescheduleOverride(scheduleId: number, scheduledDate: string, timeOfDay: string): Promise<void> {
  const existing = await db
    .select()
    .from(medLog)
    .where(and(eq(medLog.medScheduleId, scheduleId), eq(medLog.scheduledDate, scheduledDate)));

  if (existing.length > 0) {
    await db.update(medLog).set({ rescheduledTimeOfDay: timeOfDay }).where(eq(medLog.id, existing[0].id));
  } else {
    await db.insert(medLog).values({
      medScheduleId: scheduleId,
      scheduledDate,
      status: null,
      takenAt: null,
      rescheduledTimeOfDay: timeOfDay,
      createdAt: new Date().toISOString(),
    });
  }
}

function timeOfDayToMinutes(timeOfDay: string): number {
  const [hour, minute] = timeOfDay.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTimeOfDay(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Moves just this one day's dose to a different time, without touching the
 * recurring med_schedule — call rescheduleAll() afterward to update the
 * actual system notification (see scheduler.ts).
 *
 * Also cascades the same shift to any of this vitamin/med's OTHER reminder
 * times due today that fall later than the dose being moved (by its time
 * before this edit), preserving the gap between them — e.g. pushing an
 * 11:30 dose to 1pm also pushes that day's 2pm dose of the same medication
 * to 3:30pm. A dose already taken/skipped today, or one due today but
 * scheduled earlier than the edited dose, is left alone.
 */
export async function rescheduleMedForDate(
  vitaminMedId: number,
  scheduleId: number,
  scheduledDate: string,
  timeOfDay: string,
): Promise<void> {
  const todayDay = String(new Date(`${scheduledDate}T00:00:00`).getDay());

  const dueToday = (
    await db.select().from(medSchedule).where(and(eq(medSchedule.vitaminMedId, vitaminMedId), eq(medSchedule.active, true)))
  ).filter((s) => s.daysOfWeek.split(',').includes(todayDay));

  const editedSchedule = dueToday.find((s) => s.id === scheduleId);
  if (!editedSchedule) {
    // Not due today (or inactive) — nothing to cascade to.
    await setRescheduleOverride(scheduleId, scheduledDate, timeOfDay);
    return;
  }

  const logRows = await db
    .select()
    .from(medLog)
    .where(
      and(
        eq(medLog.scheduledDate, scheduledDate),
        inArray(
          medLog.medScheduleId,
          dueToday.map((s) => s.id),
        ),
      ),
    );
  const logByScheduleId = new Map(logRows.map((log) => [log.medScheduleId, log]));

  const oldEffectiveMinutes = timeOfDayToMinutes(
    logByScheduleId.get(scheduleId)?.rescheduledTimeOfDay ?? editedSchedule.timeOfDay,
  );
  const deltaMinutes = timeOfDayToMinutes(timeOfDay) - oldEffectiveMinutes;

  await setRescheduleOverride(scheduleId, scheduledDate, timeOfDay);
  if (deltaMinutes === 0) return;

  for (const sibling of dueToday) {
    if (sibling.id === scheduleId) continue;
    const siblingLog = logByScheduleId.get(sibling.id);
    if (siblingLog?.status === 'taken' || siblingLog?.status === 'skipped') continue;
    const siblingEffectiveMinutes = timeOfDayToMinutes(siblingLog?.rescheduledTimeOfDay ?? sibling.timeOfDay);
    if (siblingEffectiveMinutes <= oldEffectiveMinutes) continue;
    const targetMinutes = siblingEffectiveMinutes + deltaMinutes;
    if (targetMinutes < 0 || targetMinutes > 23 * 60 + 59) {
      throw new Error("Can't reschedule — it would push a later dose of this medication past the end of the day.");
    }
    await setRescheduleOverride(sibling.id, scheduledDate, minutesToTimeOfDay(targetMinutes));
  }
}

/**
 * Reverts a rescheduled dose back to its normal scheduled time. If the row
 * has no taken/skipped status either, it's removed entirely rather than
 * left as an empty placeholder.
 *
 * Resetting is implemented as rescheduling back to the schedule's own
 * normal time, reusing rescheduleMedForDate's cascade — so any sibling
 * doses that were pushed forward by the reschedule being undone shift back
 * by the same amount, instead of staying stuck at their cascaded time.
 */
export async function clearRescheduleForDate(scheduleId: number, scheduledDate: string): Promise<void> {
  const scheduleRows = await db.select().from(medSchedule).where(eq(medSchedule.id, scheduleId));
  const schedule = scheduleRows[0];
  if (!schedule) return;

  await rescheduleMedForDate(schedule.vitaminMedId, scheduleId, scheduledDate, schedule.timeOfDay);

  // The call above leaves a redundant override equal to the schedule's own
  // time; clear it back to null so "no override" stays represented
  // consistently (see the medLog.rescheduledTimeOfDay schema comment).
  const existing = await db
    .select()
    .from(medLog)
    .where(and(eq(medLog.medScheduleId, scheduleId), eq(medLog.scheduledDate, scheduledDate)));

  if (existing.length === 0) return;
  if (existing[0].status != null) {
    await db.update(medLog).set({ rescheduledTimeOfDay: null }).where(eq(medLog.id, existing[0].id));
  } else {
    await db.delete(medLog).where(eq(medLog.id, existing[0].id));
  }
}

/**
 * Every active reschedule override for a given date — used by the
 * notification scheduler (see scheduler.ts). Excludes doses already marked
 * taken/skipped, so a stale override left over from before that decision
 * can't cause a phantom notification for a dose that's already handled.
 */
export async function listReschedulesForDate(scheduledDate: string): Promise<Map<number, string>> {
  const rows = await db
    .select({ medScheduleId: medLog.medScheduleId, rescheduledTimeOfDay: medLog.rescheduledTimeOfDay, status: medLog.status })
    .from(medLog)
    .where(and(eq(medLog.scheduledDate, scheduledDate), isNotNull(medLog.rescheduledTimeOfDay)));
  return new Map(
    rows
      .filter((row) => row.status !== 'taken' && row.status !== 'skipped')
      .map((row) => [row.medScheduleId, row.rescheduledTimeOfDay!]),
  );
}
