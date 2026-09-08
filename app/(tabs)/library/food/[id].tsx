import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, StyleSheet, View } from 'react-native';

import { FoodForm, type FoodFormValues, type ParsedFoodValues } from '../../../../src/components/FoodForm';
import { archiveFood, getFoodById, updateFood, type Food } from '../../../../src/db/repositories/foodsRepo';
import { mlToOz } from '../../../../src/utils/units';

function foodToFormValues(food: Food): FoodFormValues {
  const servingSize =
    food.servingSizeG == null
      ? ''
      : String(food.servingSizeUnit === 'oz' ? mlToOz(food.servingSizeG) : food.servingSizeG);
  return {
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    basisType: food.basisType,
    servingSize,
    servingSizeUnit: food.servingSizeUnit,
    servingLabel: food.servingLabel ?? '',
    calories: String(food.calories),
    proteinG: String(food.proteinG),
    carbsG: String(food.carbsG),
    fatG: String(food.fatG),
    fiberG: String(food.fiberG),
    sugarG: String(food.sugarG),
    sodiumMg: String(food.sodiumMg),
    notes: food.notes ?? '',
  };
}

export default function EditFoodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const foodId = Number(id);
  const queryClient = useQueryClient();

  const { data: food, isLoading } = useQuery({
    queryKey: ['foods', foodId],
    queryFn: () => getFoodById(foodId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ParsedFoodValues) => updateFood(foodId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      router.back();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveFood(foodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      router.back();
    },
  });

  if (isLoading || !food) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FoodForm
        initialValues={foodToFormValues(food)}
        submitLabel="Save Changes"
        submitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
      />
      <View style={styles.deleteRow}>
        <Button title="Delete Food" color="#c00" onPress={() => archiveMutation.mutate()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRow: {
    padding: 16,
  },
});
