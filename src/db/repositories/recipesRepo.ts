import { and, desc, eq, isNull, like } from 'drizzle-orm';

import { computeRecipeTotals, roundNutritionForDisplay } from '../../services/nutrition/scaling';
import { db } from '../client';
import { foods, recipeIngredients, recipes } from '../schema';

export type Recipe = typeof recipes.$inferSelect;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type Food = typeof foods.$inferSelect;

export interface RecipeIngredientInput {
  foodId: number;
  quantityG: number;
}

export interface RecipeInput {
  name: string;
  servings: number;
  notes?: string | null;
  ingredients: RecipeIngredientInput[];
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: (RecipeIngredient & { food: Food })[];
}

async function computeCachedPerServing(
  ingredients: RecipeIngredientInput[],
  servings: number,
): Promise<{ cachedCaloriesPerServing: number; cachedProteinGPerServing: number }> {
  if (ingredients.length === 0 || servings <= 0) {
    return { cachedCaloriesPerServing: 0, cachedProteinGPerServing: 0 };
  }
  const foodRows = await Promise.all(
    ingredients.map(async (ingredient) => {
      const rows = await db.select().from(foods).where(eq(foods.id, ingredient.foodId));
      const food = rows[0];
      if (!food) throw new Error(`Food ${ingredient.foodId} not found`);
      return { food, quantityG: ingredient.quantityG };
    }),
  );
  const { totals } = computeRecipeTotals(foodRows);
  const perServing = roundNutritionForDisplay({
    calories: totals.calories / servings,
    proteinG: totals.proteinG / servings,
    carbsG: totals.carbsG / servings,
    fatG: totals.fatG / servings,
    fiberG: totals.fiberG / servings,
    sugarG: totals.sugarG / servings,
    sodiumMg: totals.sodiumMg / servings,
  });
  return {
    cachedCaloriesPerServing: perServing.calories,
    cachedProteinGPerServing: perServing.proteinG,
  };
}

export async function listRecipes(searchQuery?: string): Promise<Recipe[]> {
  const conditions = [isNull(recipes.archivedAt)];
  if (searchQuery && searchQuery.trim().length > 0) {
    conditions.push(like(recipes.name, `%${searchQuery.trim()}%`));
  }
  return db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .orderBy(desc(recipes.updatedAt));
}

export async function getRecipeWithIngredients(id: number): Promise<RecipeWithIngredients | null> {
  const recipeRows = await db.select().from(recipes).where(eq(recipes.id, id));
  const recipe = recipeRows[0];
  if (!recipe) return null;

  const ingredientRows = await db
    .select({ ingredient: recipeIngredients, food: foods })
    .from(recipeIngredients)
    .innerJoin(foods, eq(recipeIngredients.foodId, foods.id))
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(recipeIngredients.sortOrder);

  return {
    ...recipe,
    ingredients: ingredientRows.map((row) => ({ ...row.ingredient, food: row.food })),
  };
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const now = new Date().toISOString();
  const cached = await computeCachedPerServing(input.ingredients, input.servings);

  const recipeRows = await db
    .insert(recipes)
    .values({
      name: input.name,
      servings: input.servings,
      notes: input.notes ?? null,
      ...cached,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const recipe = recipeRows[0];

  if (input.ingredients.length > 0) {
    await db.insert(recipeIngredients).values(
      input.ingredients.map((ingredient, index) => ({
        recipeId: recipe.id,
        foodId: ingredient.foodId,
        quantityG: ingredient.quantityG,
        sortOrder: index,
      })),
    );
  }

  return recipe;
}

export async function updateRecipe(id: number, input: RecipeInput): Promise<void> {
  const cached = await computeCachedPerServing(input.ingredients, input.servings);

  await db
    .update(recipes)
    .set({
      name: input.name,
      servings: input.servings,
      notes: input.notes ?? null,
      ...cached,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(recipes.id, id));

  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
  if (input.ingredients.length > 0) {
    await db.insert(recipeIngredients).values(
      input.ingredients.map((ingredient, index) => ({
        recipeId: id,
        foodId: ingredient.foodId,
        quantityG: ingredient.quantityG,
        sortOrder: index,
      })),
    );
  }
}

export async function archiveRecipe(id: number): Promise<void> {
  await db
    .update(recipes)
    .set({ archivedAt: new Date().toISOString() })
    .where(eq(recipes.id, id));
}
