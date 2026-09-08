import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { FoodForm, type FoodFormValues, type ParsedFoodValues } from '../../src/components/FoodForm';
import { archiveFood, getFoodById, updateFood, type Food } from '../../src/db/repositories/foodsRepo';
import { colors } from '../../src/theme/theme';

function foodToFormValues(food: Food): FoodFormValues {
  return {
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    servingAmount: String(food.servingAmount),
    servingUnit: food.servingUnit,
    servingWeightAmount: food.servingWeightG != null ? String(food.servingWeightG) : '',
    servingWeightUnit: food.servingWeightG != null ? 'g' : '',
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
    onError: (error: Error) => {
      Alert.alert(
        'Could not save changes',
        error.message.includes('idx_foods_barcode')
          ? 'Another food with this barcode already exists in your library.'
          : error.message,
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveFood(foodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Could not delete food', error.message);
    },
  });

  function confirmDelete() {
    Alert.alert('Delete Food', `Delete "${food?.name}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => archiveMutation.mutate() },
    ]);
  }

  if (isLoading || !food) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
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
        secondaryAction={{
          label: archiveMutation.isPending ? 'Deleting…' : 'Delete Food',
          onPress: confirmDelete,
          disabled: archiveMutation.isPending,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
