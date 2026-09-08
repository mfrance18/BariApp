import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { EMPTY_FOOD_FORM_VALUES, FoodForm, type FoodFormValues, type ParsedFoodValues } from '../../src/components/FoodForm';
import { createFood } from '../../src/db/repositories/foodsRepo';

export default function NewFoodScreen() {
  const params = useLocalSearchParams<
    Partial<Record<keyof FoodFormValues | 'source' | 'servingWeightG', string>> & {
      logMealType?: string;
      logDate?: string;
    }
  >();
  const queryClient = useQueryClient();

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

  const mutation = useMutation({
    mutationFn: (values: ParsedFoodValues) =>
      createFood({ ...values, source: params.source === 'open_food_facts' ? 'open_food_facts' : 'manual' }),
    onSuccess: (food) => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      queryClient.setQueryData(['foods', 'justAdded'], true);
      if (params.logMealType) {
        router.replace({
          pathname: '/log/[mealType]/weigh',
          params: { mealType: params.logMealType, itemType: 'food', itemId: String(food.id), logDate: params.logDate },
        });
      } else {
        router.back();
      }
    },
    onError: (error: Error) => {
      Alert.alert(
        'Could not save food',
        error.message.includes('idx_foods_barcode')
          ? 'A food with this barcode already exists in your library.'
          : error.message,
      );
    },
  });

  return (
    <FoodForm
      initialValues={initialValues}
      submitLabel="Save Food"
      submitting={mutation.isPending}
      onSubmit={(values) => mutation.mutate(values)}
      onScanBarcode={() =>
        router.replace({
          pathname: '/scan-barcode',
          params: { returnTo: '/food/new', logMealType: params.logMealType, logDate: params.logDate },
        })
      }
    />
  );
}
