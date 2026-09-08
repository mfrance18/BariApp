import { router } from 'expo-router';
import { Alert } from 'react-native';

import { getFoodByBarcode, restoreFood } from '../../db/repositories/foodsRepo';
import { mapOffProductToFood } from './mapper';
import type { OffProduct } from './types';

export interface FoodMatchContext {
  destination: string;
  logMealType?: string;
  logDate?: string;
}

/**
 * If a food with this barcode already exists locally, navigates to it
 * (restoring it first if it was deleted) and returns true. Returns false
 * if there's no local match, so the caller can fall back to OFF data.
 */
export async function navigateToExistingFoodByBarcode(barcode: string, context: FoodMatchContext): Promise<boolean> {
  const existingFood = await getFoodByBarcode(barcode);
  if (!existingFood) return false;

  if (existingFood.archivedAt) {
    await restoreFood(existingFood.id);
    Alert.alert('Restored', `"${existingFood.name}" was previously deleted and has been restored to your library.`);
  }

  if (context.logMealType) {
    router.replace({
      pathname: '/log/[mealType]/weigh',
      params: { mealType: context.logMealType, itemType: 'food', itemId: String(existingFood.id), logDate: context.logDate },
    });
  } else {
    router.replace(`/food/${existingFood.id}`);
  }
  return true;
}

/** Navigates to the destination form, prefilled from an OFF product (or blank with just the barcode if product is null). */
export function navigateToPrefilledFoodForm(
  product: OffProduct | null,
  barcode: string,
  context: FoodMatchContext,
): void {
  if (!product) {
    router.replace({
      pathname: context.destination as never,
      params: { barcode, logMealType: context.logMealType, logDate: context.logDate },
    });
    return;
  }

  const food = mapOffProductToFood(product, barcode);
  router.replace({
    pathname: context.destination as never,
    params: {
      barcode,
      name: food.name,
      brand: food.brand ?? '',
      servingAmount: String(food.servingAmount),
      servingUnit: food.servingUnit,
      calories: String(food.calories),
      proteinG: String(food.proteinG),
      carbsG: String(food.carbsG),
      fatG: String(food.fatG),
      fiberG: String(food.fiberG),
      sugarG: String(food.sugarG),
      sodiumMg: String(food.sodiumMg),
      source: 'open_food_facts',
      logMealType: context.logMealType,
      logDate: context.logDate,
    },
  });
}
