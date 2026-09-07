import { and, eq } from 'drizzle-orm';

import { db } from '../client';
import { medLog, medSchedule, vitaminsMeds } from '../schema';

export type VitaminMed = typeof vitaminsMeds.$inferSelect;
export type MedSchedule = typeof medSchedule.$inferSelect;
export type MedLog = typeof medLog.$inferSelect;

export async function listActiveVitaminsMeds(): Promise<VitaminMed[]> {
  return db.select().from(vitaminsMeds).where(eq(vitaminsMeds.active, true));
}

export async function getVitaminMedById(id: number): Promise<VitaminMed | null> {
  const rows = await db.select().from(vitaminsMeds).where(eq(vitaminsMeds.id, id));
  return rows[0] ?? null;
}

export async function createVitaminMed(input: {
  name: string;
  type: 'vitamin' | 'medication';
  dosageLabel: string | null;
  notes: string | null;
}): Promise<VitaminMed> {
  const now = new Date().toISOString();
  const rows = await db
    .insert(vitaminsMeds)
    .values({ ...input, createdAt: now, updatedAt: now })
    .returning();
  return rows[0];
}

export async function updateVitaminMed(
  id: number,
  patch: Partial<{ name: string; type: 'vitamin' | 'medication'; dosageLabel: string | null; notes: string | null }>,
): Promise<void> {
  await db
    .update(vitaminsMeds)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(vitaminsMeds.id, id));
}

export async function archiveVitaminMed(id: number): Promise<void> {
  await db
    .update(vitaminsMeds)
    .set({ active: false, updatedAt: new Date().toISOString() })
    .where(eq(vitaminsMeds.id, id));
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
  timeOfDay: string;
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
      return {
        scheduleId: row.schedule.id,
        vitaminMedId: row.med.id,
        name: row.med.name,
        type: row.med.type,
        dosageLabel: row.med.dosageLabel,
        timeOfDay: row.schedule.timeOfDay,
        status: (log?.status === 'taken' || log?.status === 'skipped' ? log.status : 'pending') as
          | 'taken'
          | 'skipped'
          | 'pending',
      };
    })
    .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
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

export async function clearStatus(scheduleId: number, scheduledDate: string): Promise<void> {
  await db
    .delete(medLog)
    .where(and(eq(medLog.medScheduleId, scheduleId), eq(medLog.scheduledDate, scheduledDate)));
}
