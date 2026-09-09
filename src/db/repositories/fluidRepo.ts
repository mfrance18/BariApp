import { desc, eq } from 'drizzle-orm';

import { db } from '../client';
import { fluidLog } from '../schema';
import { toLogDateKey } from '../../utils/date';

export type FluidLogEntry = typeof fluidLog.$inferSelect;

export async function listEntriesForDate(logDate: string): Promise<FluidLogEntry[]> {
  return db
    .select()
    .from(fluidLog)
    .where(eq(fluidLog.logDate, logDate))
    .orderBy(desc(fluidLog.loggedAt));
}

export async function createEntry(amountMl: number, sourceLabel?: string): Promise<FluidLogEntry> {
  const now = new Date();
  const rows = await db
    .insert(fluidLog)
    .values({
      amountMl,
      loggedAt: now.toISOString(),
      logDate: toLogDateKey(now),
      sourceLabel: sourceLabel ?? null,
      createdAt: now.toISOString(),
    })
    .returning();
  return rows[0];
}

export async function updateEntry(
  id: number,
  patch: Partial<Pick<FluidLogEntry, 'amountMl' | 'loggedAt' | 'sourceLabel'>>,
): Promise<void> {
  await db.update(fluidLog).set(patch).where(eq(fluidLog.id, id));
}

export async function deleteEntry(id: number): Promise<void> {
  await db.delete(fluidLog).where(eq(fluidLog.id, id));
}
