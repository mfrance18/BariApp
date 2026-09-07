import type { MealLogEntryWithName } from '../../db/repositories/mealLogRepo';
import { addNutrition, ZERO_NUTRITION, type NutritionFields } from './scaling';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export function entryNutrition(entry: MealLogEntryWithName): NutritionFields {
  return {
    calories: entry.calories,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    fiberG: entry.fiberG,
    sugarG: entry.sugarG,
    sodiumMg: entry.sodiumMg,
  };
}

export function groupEntriesByMeal(
  entries: MealLogEntryWithName[],
): Record<MealType, MealLogEntryWithName[]> {
  const grouped: Record<MealType, MealLogEntryWithName[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const entry of entries) {
    grouped[entry.mealType].push(entry);
  }
  return grouped;
}

export function sumEntries(entries: MealLogEntryWithName[]): NutritionFields {
  return entries.reduce((total, entry) => addNutrition(total, entryNutrition(entry)), ZERO_NUTRITION);
}
