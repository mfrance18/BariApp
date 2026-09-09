import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { FoodForm, type FoodFormValues, type ParsedFoodValues } from '../../src/components/FoodForm';
import { deleteFood, getFoodById, updateFood, type Food } from '../../src/db/repositories/foodsRepo';
import { colors } from '../../src/theme/theme';
import { gramsToServing } from '../../src/utils/servingUnits';

function foodToFormValues(food: Food): FoodFormValues {
  // Only grams are persisted, but the weight equivalent is always shown (and
  // editable) in oz by default — matches the rest of the app defaulting to
  // oz for food weights, while still accepting any other unit on input.
  const weightOz = food.servingWeightG != null ? gramsToServing(food.servingWeightG, 'oz') : null;
  return {
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    servingAmount: String(food.servingAmount),
    servingUnit: food.servingUnit,
    servingWeightAmount: weightOz != null ? String(Math.round(weightOz * 100) / 100) : '',
    servingWeightUnit: 'oz',
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

  const deleteMutation = useMutation({
    mutationFn: () => deleteFood(foodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Could not delete food', error.message);
    },
  });

  function confirmDelete() {
    Alert.alert(
      'Delete Food',
      `Permanently delete "${food?.name}" from your library? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>This food no longer exists.</Text>
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
          label: deleteMutation.isPending ? 'Deleting…' : 'Delete Food',
          onPress: confirmDelete,
          disabled: deleteMutation.isPending,
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
  notFoundText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
