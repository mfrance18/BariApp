import { and, desc, eq, isNull, like, or } from 'drizzle-orm';

import { db } from '../client';
import { foods, recipeIngredients, recipes } from '../schema';

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;

export async function listFoods(searchQuery?: string): Promise<Food[]> {
  const conditions = [];
  if (searchQuery && searchQuery.trim().length > 0) {
    const pattern = `%${searchQuery.trim()}%`;
    conditions.push(or(like(foods.name, pattern), like(foods.brand, pattern))!);
  }
  return db
    .select()
    .from(foods)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(foods.updatedAt));
}

export async function getFoodById(id: number): Promise<Food | null> {
  const rows = await db.select().from(foods).where(eq(foods.id, id));
  return rows[0] ?? null;
}

export async function getFoodByBarcode(barcode: string): Promise<Food | null> {
  const rows = await db.select().from(foods).where(eq(foods.barcode, barcode));
  return rows[0] ?? null;
}

export async function createFood(input: Omit<NewFood, 'id' | 'createdAt' | 'updatedAt'>): Promise<Food> {
  const now = new Date().toISOString();
  const rows = await db
    .insert(foods)
    .values({ ...input, createdAt: now, updatedAt: now })
    .returning();
  return rows[0];
}

export async function updateFood(
  id: number,
  patch: Partial<Omit<NewFood, 'id' | 'createdAt'>>,
): Promise<void> {
  await db
    .update(foods)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(foods.id, id));
}

/**
 * Permanently deletes a food. Refuses (rather than leaving a dangling
 * reference) if it's still used by an active recipe, since recipes always
 * live-scale nutrition from the referenced food. A food used only in
 * historical meal log entries can still be deleted — those entries already
 * snapshot their own nutrition and fall back to "Unknown food" for display
 * (see listEntriesForDate in mealLogRepo.ts).
 */
export async function deleteFood(id: number): Promise<void> {
  const usedInRecipes = await db
    .selectDistinct({ name: recipes.name })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(and(eq(recipeIngredients.foodId, id), isNull(recipes.archivedAt)));

  if (usedInRecipes.length > 0) {
    const names = usedInRecipes.map((r) => r.name).join(', ');
    throw new Error(
      `This food is used in ${names}. Remove it from ${usedInRecipes.length === 1 ? 'that recipe' : 'those recipes'} before deleting.`,
    );
  }

  await db.delete(foods).where(eq(foods.id, id));
}
