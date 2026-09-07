import { desc, eq, gte } from 'drizzle-orm';

import type { WeightReading } from '../../services/vesync/types';
import { db } from '../client';
import { weightLog } from '../schema';

export type WeightLogEntry = typeof weightLog.$inferSelect;

export async function listWeightLog(sinceDate?: Date): Promise<WeightLogEntry[]> {
  const query = db.select().from(weightLog).orderBy(desc(weightLog.recordedAt));
  if (sinceDate) {
    return query.where(gte(weightLog.recordedAt, sinceDate.toISOString()));
  }
  return query;
}

export async function getLatestWeightLogEntry(): Promise<WeightLogEntry | null> {
  const rows = await db.select().from(weightLog).orderBy(desc(weightLog.recordedAt)).limit(1);
  return rows[0] ?? null;
}

export async function addManualWeight(weightKg: number, recordedAt: Date = new Date()): Promise<WeightLogEntry> {
  const now = new Date().toISOString();
  const rows = await db
    .insert(weightLog)
    .values({
      weightKg,
      recordedAt: recordedAt.toISOString(),
      source: 'manual',
      createdAt: now,
    })
    .returning();
  return rows[0];
}

/** Inserts a VeSync reading if it hasn't been synced before. Returns whether a new row was inserted. */
export async function upsertFromVeSync(reading: WeightReading): Promise<boolean> {
  const existing = await db
    .select()
    .from(weightLog)
    .where(eq(weightLog.vesyncReadingId, reading.externalId));
  if (existing.length > 0) return false;

  await db.insert(weightLog).values({
    weightKg: reading.weightKg,
    recordedAt: reading.timestamp.toISOString(),
    source: 'vesync_scale',
    vesyncReadingId: reading.externalId,
    bodyFatPct: reading.bodyFatPct ?? null,
    createdAt: new Date().toISOString(),
  });
  return true;
}
