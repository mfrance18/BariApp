import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFoodById } from '../../../src/db/repositories/foodsRepo';
import { createEntry, type NewMealLogEntry } from '../../../src/db/repositories/mealLogRepo';
import { getRecipeWithIngredients } from '../../../src/db/repositories/recipesRepo';
import { getSettings } from '../../../src/db/repositories/settingsRepo';
import { getLatestWeight } from '../../../src/services/vesync/adapter';
import {
  computeRecipeTotals,
  getReferenceWeightG,
  roundNutritionForDisplay,
  scaleNutrition,
  scaleRecipePortion,
  ZERO_NUTRITION,
  type NutritionFields,
} from '../../../src/services/nutrition/scaling';
import type { MealType } from '../../../src/services/nutrition/totals';
import { todayLogDateKey } from '../../../src/utils/date';

export default function WeighScreen() {
  const { mealType, itemType, itemId, logDate } = useLocalSearchParams<{
    mealType: MealType;
    itemType: 'food' | 'recipe';
    itemId: string;
    logDate?: string;
  }>();
  const queryClient = useQueryClient();
  const [weightG, setWeightG] = useState('');
  const [weightSource, setWeightSource] = useState<'manual' | 'vesync_scale'>('manual');
  const [scaleError, setScaleError] = useState<string | null>(null);

  const id = Number(itemId);
  const effectiveLogDate = logDate ?? todayLogDateKey();

  const settingsQuery = useQuery({ queryKey: ['app_settings'], queryFn: getSettings });

  const pullFromScaleMutation = useMutation({
    mutationFn: () => getLatestWeight(),
    onSuccess: (reading) => {
      if (!reading) {
        setScaleError("Couldn't read the scale — enter weight manually.");
        return;
      }
      setScaleError(null);
      setWeightG(String(Math.round(reading.weightKg * 1000)));
      setWeightSource('vesync_scale');
    },
  });

  const foodQuery = useQuery({
    queryKey: ['foods', id],
    queryFn: () => getFoodById(id),
    enabled: itemType === 'food',
  });

  const recipeQuery = useQuery({
    queryKey: ['recipes', id],
    queryFn: () => getRecipeWithIngredients(id),
    enabled: itemType === 'recipe',
  });

  const itemName = itemType === 'food' ? foodQuery.data?.name : recipeQuery.data?.name;
  const isLoading = itemType === 'food' ? foodQuery.isLoading : recipeQuery.isLoading;

  const preview: NutritionFields | null = useMemo(() => {
    const weight = Number(weightG);
    if (!weight || weight <= 0) return null;

    try {
      if (itemType === 'food' && foodQuery.data) {
        const referenceWeightG = getReferenceWeightG(foodQuery.data);
        return roundNutritionForDisplay(scaleNutrition(foodQuery.data, referenceWeightG, weight));
      }
      if (itemType === 'recipe' && recipeQuery.data) {
        const recipeTotals = computeRecipeTotals(
          recipeQuery.data.ingredients.map((ingredient) => ({
            food: ingredient.food,
            quantityG: ingredient.quantityG,
          })),
        );
        return roundNutritionForDisplay(scaleRecipePortion(recipeTotals, weight));
      }
    } catch {
      return null;
    }
    return null;
  }, [weightG, itemType, foodQuery.data, recipeQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const weight = Number(weightG);
      if (!weight || weight <= 0) throw new Error('Enter a weight greater than 0');
      const nutrition = preview;
      if (!nutrition) throw new Error('Unable to compute nutrition for this weight');

      const entry: Omit<NewMealLogEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        logDate: effectiveLogDate,
        mealType,
        itemType,
        foodId: itemType === 'food' ? id : null,
        recipeId: itemType === 'recipe' ? id : null,
        weightG: weight,
        weightSource,
        loggedAt: new Date().toISOString(),
        notes: null,
        ...nutrition,
      };
      return createEntry(entry);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealLogEntries', effectiveLogDate] });
      router.dismissAll();
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.itemName}>{itemName}</Text>
      <Text style={styles.mealLabel}>Logging to {mealType}</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Weight (g)</Text>
        <TextInput
          style={styles.input}
          value={weightG}
          onChangeText={(v) => {
            setWeightG(v);
            setWeightSource('manual');
          }}
          keyboardType="decimal-pad"
          placeholder="e.g. 120"
          autoFocus
        />
        {settingsQuery.data?.vesyncConnected && (
          <Button
            title={pullFromScaleMutation.isPending ? 'Reading scale…' : 'Pull from Scale'}
            onPress={() => pullFromScaleMutation.mutate()}
            disabled={pullFromScaleMutation.isPending}
          />
        )}
        {weightSource === 'vesync_scale' && <Text style={styles.helperText}>Weight pulled from VeSync scale</Text>}
        {scaleError && <Text style={styles.errorText}>{scaleError}</Text>}
      </View>

      <View style={styles.previewBox}>
        <NutritionRow label="Calories" value={(preview ?? ZERO_NUTRITION).calories} unit="kcal" />
        <NutritionRow label="Protein" value={(preview ?? ZERO_NUTRITION).proteinG} unit="g" />
        <NutritionRow label="Carbs" value={(preview ?? ZERO_NUTRITION).carbsG} unit="g" />
        <NutritionRow label="Fat" value={(preview ?? ZERO_NUTRITION).fatG} unit="g" />
        <NutritionRow label="Fiber" value={(preview ?? ZERO_NUTRITION).fiberG} unit="g" />
        <NutritionRow label="Sugar" value={(preview ?? ZERO_NUTRITION).sugarG} unit="g" />
        <NutritionRow label="Sodium" value={(preview ?? ZERO_NUTRITION).sodiumMg} unit="mg" />
      </View>

      {mutation.error && <Text style={styles.errorText}>{(mutation.error as Error).message}</Text>}

      <Button
        title={mutation.isPending ? 'Logging…' : 'Log It'}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending || !preview}
      />
    </View>
  );
}

function NutritionRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.nutritionRow}>
      <Text style={styles.nutritionLabel}>{label}</Text>
      <Text style={styles.nutritionValue}>
        {value} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 20,
    fontWeight: '700',
  },
  mealLabel: {
    color: '#777',
    marginTop: -12,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#555',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
  },
  previewBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionLabel: {
    color: '#444',
  },
  nutritionValue: {
    fontWeight: '600',
  },
  errorText: {
    color: '#c00',
    fontSize: 13,
  },
  helperText: {
    color: '#2563eb',
    fontSize: 13,
  },
});
