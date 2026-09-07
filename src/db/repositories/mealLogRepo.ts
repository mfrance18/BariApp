import { desc, eq, inArray } from 'drizzle-orm';

import { db } from '../client';
import { foods, mealLogEntries, recipes } from '../schema';

export type MealLogEntry = typeof mealLogEntries.$inferSelect;
export type NewMealLogEntry = typeof mealLogEntries.$inferInsert;

export interface MealLogEntryWithName extends MealLogEntry {
  itemName: string;
}

export async function listEntriesForDate(logDate: string): Promise<MealLogEntryWithName[]> {
  const entries = await db
    .select()
    .from(mealLogEntries)
    .where(eq(mealLogEntries.logDate, logDate))
    .orderBy(desc(mealLogEntries.loggedAt));

  const foodIds = [...new Set(entries.filter((e) => e.foodId != null).map((e) => e.foodId!))];
  const recipeIds = [...new Set(entries.filter((e) => e.recipeId != null).map((e) => e.recipeId!))];

  const foodRows = foodIds.length > 0 ? await db.select().from(foods).where(inArray(foods.id, foodIds)) : [];
  const recipeRows =
    recipeIds.length > 0 ? await db.select().from(recipes).where(inArray(recipes.id, recipeIds)) : [];

  const foodNameById = new Map(foodRows.map((f) => [f.id, f.name]));
  const recipeNameById = new Map(recipeRows.map((r) => [r.id, r.name]));

  return entries.map((entry) => ({
    ...entry,
    itemName:
      entry.itemType === 'food'
        ? foodNameById.get(entry.foodId!) ?? 'Unknown food'
        : recipeNameById.get(entry.recipeId!) ?? 'Unknown recipe',
  }));
}

export async function createEntry(
  input: Omit<NewMealLogEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<MealLogEntry> {
  const now = new Date().toISOString();
  const rows = await db
    .insert(mealLogEntries)
    .values({ ...input, createdAt: now, updatedAt: now })
    .returning();
  return rows[0];
}

export async function deleteEntry(id: number): Promise<void> {
  await db.delete(mealLogEntries).where(eq(mealLogEntries.id, id));
}
