import type { OffFoodInput } from '../openFoodFacts/mapper';
import { roundNutritionForDisplay, type NutritionFields } from '../nutrition/scaling';
import type { FdcFood } from './types';

/**
 * Per-100g nutrients (Foundation / SR Legacy / Survey foods), keyed by the
 * stable USDA nutrient number rather than `name` — the name varies slightly
 * across dataTypes, the number doesn't. See FdcFoodNutrient.
 */
const NUTRIENT_NUMBER: Record<string, keyof NutritionFields> = {
  '208': 'calories',
  '203': 'proteinG',
  '204': 'fatG',
  '205': 'carbsG',
  '291': 'fiberG',
  '269': 'sugarG',
  '307': 'sodiumMg',
};

function mapFoodNutrientsPer100g(food: FdcFood): NutritionFields {
  const nutrition: NutritionFields = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };
  for (const entry of food.foodNutrients ?? []) {
    const field = entry.nutrientNumber ? NUTRIENT_NUMBER[entry.nutrientNumber] : undefined;
    if (field && entry.value != null) {
      nutrition[field] = entry.value;
    }
  }
  return nutrition;
}

/**
 * Maps a USDA FoodData Central search result into a `foods` row.
 *
 * Branded foods carry `labelNutrients`, already expressed per the declared
 * serving and already in the right units (kcal, grams, sodium in mg) — no
 * scaling or unit conversion needed, unlike Open Food Facts. Everything
 * else (Foundation, SR Legacy, Survey/FNDDS) has no label; its nutrition
 * lives in a per-100g `foodNutrients` array mapped by nutrient number.
 */
export function mapFdcFoodToFood(food: FdcFood): OffFoodInput {
  let servingAmount: number;
  let servingUnit: string;
  let nutrition: NutritionFields;

  if (food.dataType === 'Branded' && food.labelNutrients) {
    const label = food.labelNutrients;
    servingAmount = food.servingSize && food.servingSize > 0 ? food.servingSize : 1;
    servingUnit = food.servingSizeUnit?.trim() || 'serving';
    nutrition = {
      calories: label.calories?.value ?? 0,
      proteinG: label.protein?.value ?? 0,
      carbsG: label.carbohydrates?.value ?? 0,
      fatG: label.fat?.value ?? 0,
      fiberG: label.fiber?.value ?? 0,
      sugarG: label.sugars?.value ?? 0,
      sodiumMg: label.sodium?.value ?? 0,
    };
  } else {
    servingAmount = 100;
    servingUnit = 'g';
    nutrition = mapFoodNutrientsPer100g(food);
  }

  const rounded = roundNutritionForDisplay(nutrition);

  return {
    name: food.description?.trim() || 'Unknown food',
    brand: food.brandName?.trim() || food.brandOwner?.trim() || null,
    barcode: food.gtinUpc?.trim() || null,
    source: 'usda_fdc',
    servingAmount,
    servingUnit,
    // Unlike Open Food Facts, FDC has no separate measured-weight field to
    // fall back on when servingUnit isn't itself weighable.
    servingWeightG: null,
    calories: rounded.calories,
    proteinG: rounded.proteinG,
    carbsG: rounded.carbsG,
    fatG: rounded.fatG,
    fiberG: rounded.fiberG,
    sugarG: rounded.sugarG,
    sodiumMg: rounded.sodiumMg,
    notes: null,
  };
}
