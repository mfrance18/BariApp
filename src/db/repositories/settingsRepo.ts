import { eq } from 'drizzle-orm';

import { db } from '../client';
import { appSettings } from '../schema';

export type AppSettings = typeof appSettings.$inferSelect;

const SETTINGS_ID = 1;

export async function ensureSettingsSeeded(): Promise<void> {
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID));
  if (existing.length === 0) {
    await db.insert(appSettings).values({ id: SETTINGS_ID });
  }
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID));
  if (rows.length === 0) {
    throw new Error('App settings have not been seeded yet');
  }
  return rows[0];
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await db
    .update(appSettings)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(appSettings.id, SETTINGS_ID));
}
