import { and, desc, eq, isNull, like, or } from 'drizzle-orm';

import { db } from '../client';
import { foods } from '../schema';

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;

export async function listFoods(searchQuery?: string): Promise<Food[]> {
  const conditions = [isNull(foods.archivedAt)];
  if (searchQuery && searchQuery.trim().length > 0) {
    const pattern = `%${searchQuery.trim()}%`;
    conditions.push(or(like(foods.name, pattern), like(foods.brand, pattern))!);
  }
  return db
    .select()
    .from(foods)
    .where(and(...conditions))
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

export async function createFood(input: Omit<NewFood, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<Food> {
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

export async function archiveFood(id: number): Promise<void> {
  await db
    .update(foods)
    .set({ archivedAt: new Date().toISOString() })
    .where(eq(foods.id, id));
}

export async function restoreFood(id: number): Promise<void> {
  await db.update(foods).set({ archivedAt: null }).where(eq(foods.id, id));
}
