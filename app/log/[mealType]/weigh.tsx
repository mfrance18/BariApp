import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../src/components/ui/AppButton';
import { Card } from '../../../src/components/ui/Card';
import { getFoodById } from '../../../src/db/repositories/foodsRepo';
import { createEntry, getEntryById, updateEntry, type NewMealLogEntry } from '../../../src/db/repositories/mealLogRepo';
import { getRecipeWithIngredients } from '../../../src/db/repositories/recipesRepo';
import { getSettings } from '../../../src/db/repositories/settingsRepo';
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
import { getLatestWeight } from '../../../src/services/vesync/adapter';
import { colors, radius, spacing, typography } from '../../../src/theme/theme';
import { todayLogDateKey } from '../../../src/utils/date';
import { isWeighableUnit } from '../../../src/utils/servingUnits';

const NUTRIENT_COLORS: Record<string, string> = {
  Calories: colors.primary,
  Protein: colors.protein,
  Carbs: colors.carbs,
  Fat: colors.fat,
  Fiber: colors.fiber,
  Sugar: colors.carbs,
  Sodium: colors.sodium,
};

export default function WeighScreen() {
  const { mealType, itemType, itemId, logDate, entryId } = useLocalSearchParams<{
    mealType: MealType;
    itemType: 'food' | 'recipe';
    itemId: string;
    logDate?: string;
    entryId?: string;
  }>();
  const queryClient = useQueryClient();
  const [weightG, setWeightG] = useState('');
  const [servingsInput, setServingsInput] = useState('1');
  const [weightSource, setWeightSource] = useState<'manual' | 'vesync_scale'>('manual');
  const [scaleError, setScaleError] = useState<string | null>(null);

  const id = Number(itemId);
  const effectiveLogDate = logDate ?? todayLogDateKey();
  const isEditing = entryId != null;

  const existingEntryQuery = useQuery({
    queryKey: ['mealLogEntry', entryId],
    queryFn: () => getEntryById(Number(entryId)),
    enabled: isEditing,
  });

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

  const isCountBased = itemType === 'food' && !!foodQuery.data && !isWeighableUnit(foodQuery.data.servingUnit);

  useEffect(() => {
    if (!existingEntryQuery.data) return;
    setWeightSource(existingEntryQuery.data.weightSource);
    if (existingEntryQuery.data.quantityAmount != null) {
      setServingsInput(String(existingEntryQuery.data.quantityAmount));
    } else if (existingEntryQuery.data.weightG != null) {
      setWeightG(String(existingEntryQuery.data.weightG));
    }
  }, [existingEntryQuery.data]);

  const itemName = itemType === 'food' ? foodQuery.data?.name : recipeQuery.data?.name;
  const isLoading =
    (itemType === 'food' ? foodQuery.isLoading : recipeQuery.isLoading) ||
    (isEditing && existingEntryQuery.isLoading);
  const itemNotFound =
    !isLoading && (itemType === 'food' ? foodQuery.data === null : recipeQuery.data === null);

  // For count-based foods there's no gram amount at all — nutrition is
  // simply the food's per-serving values times how many servings, using
  // scaleNutrition with a reference of "1 serving".
  const measuredAmount = isCountBased ? Number(servingsInput) : Number(weightG);

  const preview: NutritionFields | null = useMemo(() => {
    if (!measuredAmount || measuredAmount <= 0) return null;

    try {
      if (itemType === 'food' && foodQuery.data) {
        const referenceAmount = isCountBased ? 1 : getReferenceWeightG(foodQuery.data);
        return roundNutritionForDisplay(scaleNutrition(foodQuery.data, referenceAmount, measuredAmount));
      }
      if (itemType === 'recipe' && recipeQuery.data) {
        const recipeTotals = computeRecipeTotals(
          recipeQuery.data.ingredients.map((ingredient) => ({
            food: ingredient.food,
            quantityG: ingredient.quantityG,
          })),
        );
        return roundNutritionForDisplay(scaleRecipePortion(recipeTotals, measuredAmount));
      }
    } catch {
      return null;
    }
    return null;
  }, [measuredAmount, isCountBased, itemType, foodQuery.data, recipeQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const amount = measuredAmount;
      if (!amount || amount <= 0) throw new Error(isCountBased ? 'Enter how many servings' : 'Enter a weight greater than 0');
      const nutrition = preview;
      if (!nutrition) throw new Error('Unable to compute nutrition for this amount');

      const amountFields = isCountBased
        ? { weightG: null, quantityAmount: amount, quantityUnit: foodQuery.data!.servingUnit }
        : { weightG: amount, quantityAmount: null, quantityUnit: null };

      if (isEditing) {
        return updateEntry(Number(entryId), { ...amountFields, weightSource, ...nutrition });
      }

      const entry: Omit<NewMealLogEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        logDate: effectiveLogDate,
        mealType,
        itemType,
        foodId: itemType === 'food' ? id : null,
        recipeId: itemType === 'recipe' ? id : null,
        ...amountFields,
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

  if (itemNotFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>This food or recipe no longer exists.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.itemName}>{itemName}</Text>
      <Text style={styles.mealLabel}>Logging to {mealType}</Text>

      {isCountBased ? (
        <Card style={styles.field}>
          <Text style={styles.fieldLabel}>
            Servings {foodQuery.data ? `(1 = ${foodQuery.data.servingAmount} ${foodQuery.data.servingUnit})` : ''}
          </Text>
          <TextInput
            style={styles.input}
            value={servingsInput}
            onChangeText={setServingsInput}
            keyboardType="decimal-pad"
            placeholder="e.g. 1"
            autoFocus
            selectTextOnFocus
          />
        </Card>
      ) : (
        <Card style={styles.field}>
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
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          {settingsQuery.data?.vesyncConnected && (
            <AppButton
              title={pullFromScaleMutation.isPending ? 'Reading scale…' : 'Pull from Scale'}
              variant="secondary"
              onPress={() => pullFromScaleMutation.mutate()}
              disabled={pullFromScaleMutation.isPending}
            />
          )}
          {weightSource === 'vesync_scale' && <Text style={styles.helperText}>Weight pulled from VeSync scale</Text>}
          {scaleError && <Text style={styles.errorText}>{scaleError}</Text>}
        </Card>
      )}

      <Card style={styles.previewBox}>
        <Text style={styles.previewHeading}>NUTRITION</Text>
        <NutritionRow label="Calories" value={(preview ?? ZERO_NUTRITION).calories} unit="kcal" />
        <NutritionRow label="Protein" value={(preview ?? ZERO_NUTRITION).proteinG} unit="g" />
        <NutritionRow label="Carbs" value={(preview ?? ZERO_NUTRITION).carbsG} unit="g" />
        <NutritionRow label="Fat" value={(preview ?? ZERO_NUTRITION).fatG} unit="g" />
        <NutritionRow label="Fiber" value={(preview ?? ZERO_NUTRITION).fiberG} unit="g" />
        <NutritionRow label="Sugar" value={(preview ?? ZERO_NUTRITION).sugarG} unit="g" />
        <NutritionRow label="Sodium" value={(preview ?? ZERO_NUTRITION).sodiumMg} unit="mg" />
      </Card>

      {mutation.error && <Text style={styles.errorText}>{(mutation.error as Error).message}</Text>}

      <AppButton
        title={mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Log It'}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending || !preview}
      />
    </ScrollView>
  );
}

function NutritionRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.nutritionRow}>
      <View style={styles.nutritionLabelRow}>
        <View style={[styles.nutritionDot, { backgroundColor: NUTRIENT_COLORS[label] ?? colors.textMuted }]} />
        <Text style={styles.nutritionLabel}>{label}</Text>
      </View>
      <Text style={styles.nutritionValue}>
        {value} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  itemName: {
    ...typography.title,
  },
  mealLabel: {
    ...typography.caption,
    marginTop: -spacing.sm,
    textTransform: 'capitalize',
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 20,
    color: colors.textPrimary,
  },
  previewBox: {
    gap: spacing.sm,
  },
  previewHeading: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nutritionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nutritionLabel: {
    color: colors.textPrimary,
  },
  nutritionValue: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  helperText: {
    color: colors.primary,
    fontSize: 13,
  },
});
