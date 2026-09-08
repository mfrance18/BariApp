import type { NewFood } from '../../db/repositories/foodsRepo';
import { roundNutritionForDisplay, type NutritionFields } from '../nutrition/scaling';
import { isWeighableUnit } from '../../utils/servingUnits';
import type { OffProduct } from './types';

const KJ_TO_KCAL = 4.184;

export type OffFoodInput = Omit<NewFood, 'id' | 'createdAt' | 'updatedAt'>;

interface ServingLabel {
  amount: number;
  unit: string;
}

/**
 * Parses OFF's free-text serving_size (e.g. "591 ml", "1 bottle (591ml)",
 * "30g") into a leading amount + unit label. Drops a trailing gram/ml
 * equivalent in parentheses so "1 bottle (591ml)" becomes "1 bottle", not
 * "1 bottle (591ml)" — matching the product's label rather than its raw
 * volume, so the food isn't treated as something to weigh.
 */
function parseServingLabel(servingSize: string | undefined): ServingLabel | null {
  if (!servingSize) return null;
  const match = servingSize.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  if (!amount || amount <= 0) return null;
  const unit = match[2].replace(/\(.*\)\s*$/, '').trim();
  if (!unit) return null;
  return { amount, unit };
}

/** Maps an Open Food Facts product into a `foods` row, defaulting missing nutrients to 0. */
export function mapOffProductToFood(product: OffProduct, barcode: string): OffFoodInput {
  const n = product.nutriments ?? {};
  const servingLabel = parseServingLabel(product.serving_size);
  const hasServingNutrients = n['energy-kcal_serving'] != null || n.energy_serving != null;

  let servingAmount: number;
  let servingUnit: string;
  let nutrition: NutritionFields;

  if (hasServingNutrients) {
    // OFF already computed per-serving values for us — use them directly.
    servingAmount = servingLabel?.amount ?? 1;
    servingUnit = servingLabel?.unit ?? 'serving';
    nutrition = {
      calories: n['energy-kcal_serving'] ?? (n.energy_serving !== undefined ? n.energy_serving / KJ_TO_KCAL : 0),
      proteinG: n.proteins_serving ?? 0,
      carbsG: n.carbohydrates_serving ?? 0,
      fatG: n.fat_serving ?? 0,
      fiberG: n.fiber_serving ?? 0,
      sugarG: n.sugars_serving ?? 0,
      sodiumMg: (n.sodium_serving ?? 0) * 1000,
    };
  } else if (servingLabel && product.serving_quantity) {
    // No pre-computed per-serving values, but we know the serving's weight —
    // scale the per-100g values down to it ourselves.
    const factor = product.serving_quantity / 100;
    servingAmount = servingLabel.amount;
    servingUnit = servingLabel.unit;
    const calories100 = n['energy-kcal_100g'] ?? (n.energy_100g !== undefined ? n.energy_100g / KJ_TO_KCAL : 0);
    nutrition = {
      calories: calories100 * factor,
      proteinG: (n.proteins_100g ?? 0) * factor,
      carbsG: (n.carbohydrates_100g ?? 0) * factor,
      fatG: (n.fat_100g ?? 0) * factor,
      fiberG: (n.fiber_100g ?? 0) * factor,
      sugarG: (n.sugars_100g ?? 0) * factor,
      sodiumMg: (n.sodium_100g ?? 0) * 1000 * factor,
    };
  } else {
    // No usable serving info at all — fall back to per-100g, as before.
    servingAmount = 100;
    servingUnit = 'g';
    nutrition = {
      calories: n['energy-kcal_100g'] ?? (n.energy_100g !== undefined ? n.energy_100g / KJ_TO_KCAL : 0),
      proteinG: n.proteins_100g ?? 0,
      carbsG: n.carbohydrates_100g ?? 0,
      fatG: n.fat_100g ?? 0,
      fiberG: n.fiber_100g ?? 0,
      sugarG: n.sugars_100g ?? 0,
      sodiumMg: (n.sodium_100g ?? 0) * 1000,
    };
  }

  const rounded = roundNutritionForDisplay(nutrition);

  // Capture OFF's known serving weight as a fallback reference even when the
  // label itself is a discrete unit (e.g. "1 bottle") — lets the food still
  // be used in recipes / weighed when logging. See getReferenceWeightG.
  const servingWeightG =
    !isWeighableUnit(servingUnit) && product.serving_quantity && product.serving_quantity > 0
      ? product.serving_quantity
      : null;

  return {
    name: product.product_name?.trim() || 'Unknown product',
    brand: product.brands?.split(',')[0]?.trim() || null,
    barcode,
    source: 'open_food_facts',
    servingAmount,
    servingUnit,
    servingWeightG,
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
