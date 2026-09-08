import { servingToGrams } from '../../utils/servingUnits';

export interface NutritionFields {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

export const ZERO_NUTRITION: NutritionFields = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
};

const NUTRITION_KEYS = Object.keys(ZERO_NUTRITION) as (keyof NutritionFields)[];

export interface FoodBasis {
  servingAmount: number;
  servingUnit: string;
  /**
   * Optional manual weight equivalent (in grams) for one servingAmount of
   * servingUnit, e.g. "1 bottle" = 355g. Used as a fallback reference weight
   * when servingUnit itself isn't a recognized weight/volume unit, so a food
   * logged as a discrete count can still be used in recipes / scale logging.
   */
  servingWeightG?: number | null;
}

/**
 * The weight (in grams) that a food's stored nutrition values are relative
 * to — either servingUnit resolving to a weight/volume unit (see
 * src/utils/servingUnits.ts), or a manually captured servingWeightG for a
 * discrete unit (e.g. "bottle", "scoop"). Throws if neither is available.
 */
export function getReferenceWeightG(food: FoodBasis): number {
  const grams = servingToGrams(food.servingAmount, food.servingUnit);
  if (grams != null && grams > 0) {
    return grams;
  }
  if (food.servingWeightG != null && food.servingWeightG > 0) {
    return food.servingWeightG;
  }
  throw new Error(`"${food.servingUnit}" isn't a weighable unit`);
}

/** Scales a nutrition basis (per referenceWeightG) to the measured weight. */
export function scaleNutrition(
  basis: NutritionFields,
  referenceWeightG: number,
  measuredWeightG: number,
): NutritionFields {
  if (referenceWeightG <= 0) {
    throw new Error('referenceWeightG must be positive');
  }
  const ratio = measuredWeightG / referenceWeightG;
  const result = {} as NutritionFields;
  for (const key of NUTRITION_KEYS) {
    result[key] = basis[key] * ratio;
  }
  return result;
}

export function addNutrition(a: NutritionFields, b: NutritionFields): NutritionFields {
  const result = {} as NutritionFields;
  for (const key of NUTRITION_KEYS) {
    result[key] = a[key] + b[key];
  }
  return result;
}

export interface RecipeIngredientLine {
  food: FoodBasis & NutritionFields;
  quantityG: number;
}

export interface RecipeTotals {
  totals: NutritionFields;
  totalWeightG: number;
}

/**
 * A recipe's reference weight is the sum of its ingredient quantities (the
 * full cooked batch), not its `servings` count — that field only drives the
 * library's "per serving" display.
 */
export function computeRecipeTotals(ingredients: RecipeIngredientLine[]): RecipeTotals {
  let totals = ZERO_NUTRITION;
  let totalWeightG = 0;
  for (const { food, quantityG } of ingredients) {
    const referenceWeightG = getReferenceWeightG(food);
    totals = addNutrition(totals, scaleNutrition(food, referenceWeightG, quantityG));
    totalWeightG += quantityG;
  }
  return { totals, totalWeightG };
}

/** Scales a recipe's full-batch totals down to a measured portion weight. */
export function scaleRecipePortion(recipeTotals: RecipeTotals, measuredWeightG: number): NutritionFields {
  if (recipeTotals.totalWeightG <= 0) {
    throw new Error('recipe has no ingredient weight to scale from');
  }
  return scaleNutrition(recipeTotals.totals, recipeTotals.totalWeightG, measuredWeightG);
}

export function roundNutritionForDisplay(n: NutritionFields): NutritionFields {
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    calories: Math.round(n.calories),
    proteinG: round1(n.proteinG),
    carbsG: round1(n.carbsG),
    fatG: round1(n.fatG),
    fiberG: round1(n.fiberG),
    sugarG: round1(n.sugarG),
    sodiumMg: Math.round(n.sodiumMg),
  };
}
