import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { EMPTY_FOOD_FORM_VALUES, FoodForm, type FoodFormValues, type ParsedFoodValues } from '../../src/components/FoodForm';
import { createFood, type Food } from '../../src/db/repositories/foodsRepo';
import { createEntry } from '../../src/db/repositories/mealLogRepo';
import { getReferenceWeightG } from '../../src/services/nutrition/scaling';
import type { MealType } from '../../src/services/nutrition/totals';
import { todayLogDateKey } from '../../src/utils/date';
import { isWeighableUnit } from '../../src/utils/servingUnits';

export default function NewFoodScreen() {
  const params = useLocalSearchParams<
    Partial<Record<keyof FoodFormValues | 'source' | 'servingWeightG', string>> & {
      logMealType?: string;
      logDate?: string;
    }
  >();
  const queryClient = useQueryClient();
  const isLogging = !!params.logMealType;
  const effectiveLogDate = params.logDate ?? todayLogDateKey();

  const initialValues: FoodFormValues = {
    ...EMPTY_FOOD_FORM_VALUES,
    barcode: params.barcode ?? '',
    name: params.name ?? '',
    brand: params.brand ?? '',
    servingAmount: params.servingAmount ?? EMPTY_FOOD_FORM_VALUES.servingAmount,
    servingUnit: params.servingUnit ?? EMPTY_FOOD_FORM_VALUES.servingUnit,
    servingWeightAmount: params.servingWeightG ?? '',
    servingWeightUnit: params.servingWeightG ? 'g' : '',
    calories: params.calories ?? '',
    proteinG: params.proteinG ?? '',
    carbsG: params.carbsG ?? '',
    fatG: params.fatG ?? '',
    fiberG: params.fiberG ?? '',
    sugarG: params.sugarG ?? '',
    sodiumMg: params.sodiumMg ?? '',
  };

  function saveFood(values: ParsedFoodValues): Promise<Food> {
    return createFood({ ...values, source: params.source === 'open_food_facts' ? 'open_food_facts' : 'manual' });
  }

  function handleSaveError(error: Error) {
    Alert.alert(
      'Could not save food',
      error.message.includes('idx_foods_barcode')
        ? 'A food with this barcode already exists in your library.'
        : error.message,
    );
  }

  // "Add" — saves the food and, if we're logging a meal, logs it right away
  // at its own default serving (no separate weigh step needed, e.g. for a
  // fixed-serving item like a protein shake).
  const addMutation = useMutation({
    mutationFn: async (values: ParsedFoodValues) => {
      const food = await saveFood(values);
      if (isLogging) {
        const weighable = isWeighableUnit(food.servingUnit);
        const amountFields = weighable
          ? { weightG: getReferenceWeightG(food), quantityAmount: null, quantityUnit: null }
          : { weightG: null, quantityAmount: food.servingAmount, quantityUnit: food.servingUnit };
        await createEntry({
          logDate: effectiveLogDate,
          mealType: params.logMealType! as MealType,
          itemType: 'food',
          foodId: food.id,
          recipeId: null,
          ...amountFields,
          weightSource: 'manual',
          calories: food.calories,
          proteinG: food.proteinG,
          carbsG: food.carbsG,
          fatG: food.fatG,
          fiberG: food.fiberG,
          sugarG: food.sugarG,
          sodiumMg: food.sodiumMg,
          loggedAt: new Date().toISOString(),
          notes: null,
        });
      }
      return food;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      queryClient.setQueryData(['foods', 'justAdded'], true);
      if (isLogging) {
        queryClient.invalidateQueries({ queryKey: ['mealLogEntries', effectiveLogDate] });
        router.dismissAll();
      } else {
        router.back();
      }
    },
    onError: handleSaveError,
  });

  // "Weigh It" — saves the food, then goes to the weigh screen to log a
  // precise measured amount instead of the default serving.
  const weighMutation = useMutation({
    mutationFn: saveFood,
    onSuccess: (food) => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      queryClient.setQueryData(['foods', 'justAdded'], true);
      router.replace({
        pathname: '/log/[mealType]/weigh',
        params: { mealType: params.logMealType!, itemType: 'food', itemId: String(food.id), logDate: params.logDate },
      });
    },
    onError: handleSaveError,
  });

  return (
    <FoodForm
      initialValues={initialValues}
      submitLabel={isLogging ? 'Add' : 'Save Food'}
      submitting={addMutation.isPending}
      onSubmit={(values) => addMutation.mutate(values)}
      extraSubmitAction={
        isLogging
          ? { label: 'Weigh It', onSubmit: (values) => weighMutation.mutate(values), disabled: weighMutation.isPending }
          : undefined
      }
      onScanBarcode={() =>
        router.replace({
          pathname: '/scan-barcode',
          params: { returnTo: '/food/new', logMealType: params.logMealType, logDate: params.logDate },
        })
      }
    />
  );
}
