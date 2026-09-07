import type { NewFood } from '../../db/repositories/foodsRepo';
import type { OffProduct } from './types';

const KJ_TO_KCAL = 4.184;

export type OffFoodInput = Omit<NewFood, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>;

/** Maps an Open Food Facts product into a `foods` row, defaulting missing nutrients to 0. */
export function mapOffProductToFood(product: OffProduct, barcode: string): OffFoodInput {
  const n = product.nutriments ?? {};

  const calories =
    n['energy-kcal_100g'] ?? (n.energy_100g !== undefined ? n.energy_100g / KJ_TO_KCAL : 0);

  return {
    name: product.product_name?.trim() || 'Unknown product',
    brand: product.brands?.split(',')[0]?.trim() || null,
    barcode,
    source: 'open_food_facts',
    basisType: 'per_100g',
    servingSizeG: null,
    servingLabel: product.serving_size ?? null,
    calories: calories ?? 0,
    proteinG: n.proteins_100g ?? 0,
    carbsG: n.carbohydrates_100g ?? 0,
    fatG: n.fat_100g ?? 0,
    fiberG: n.fiber_100g ?? 0,
    sugarG: n.sugars_100g ?? 0,
    sodiumMg: (n.sodium_100g ?? 0) * 1000,
    notes: null,
  };
}
