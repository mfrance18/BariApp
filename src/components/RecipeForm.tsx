import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listFoods, type Food } from '../db/repositories/foodsRepo';
import { computeRecipeTotals, roundNutritionForDisplay } from '../services/nutrition/scaling';
import { colors, radius, spacing, typography } from '../theme/theme';
import { isWeighableUnit } from '../utils/servingUnits';
import { AppButton } from './ui/AppButton';
import { Card } from './ui/Card';

export interface RecipeIngredientDraft {
  food: Food;
  quantityG: string;
}

export interface RecipeFormValues {
  name: string;
  servings: string;
  notes: string;
  ingredients: RecipeIngredientDraft[];
}

export const EMPTY_RECIPE_FORM_VALUES: RecipeFormValues = {
  name: '',
  servings: '1',
  notes: '',
  ingredients: [],
};

export interface ParsedRecipeValues {
  name: string;
  servings: number;
  notes: string | null;
  ingredients: { foodId: number; quantityG: number }[];
}

export function parseRecipeFormValues(values: RecipeFormValues): ParsedRecipeValues | { error: string } {
  if (!values.name.trim()) return { error: 'Name is required' };
  const servings = Number(values.servings);
  if (!servings || servings <= 0) return { error: 'Servings must be greater than 0' };
  for (const ingredient of values.ingredients) {
    const qty = Number(ingredient.quantityG);
    if (!qty || qty <= 0) {
      return { error: `Enter a valid quantity (g) for ${ingredient.food.name}` };
    }
  }
  return {
    name: values.name.trim(),
    servings,
    notes: values.notes.trim() || null,
    ingredients: values.ingredients.map((i) => ({ foodId: i.food.id, quantityG: Number(i.quantityG) })),
  };
}

interface RecipeSecondaryAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

interface RecipeFormProps {
  initialValues: RecipeFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: ParsedRecipeValues) => void;
  secondaryAction?: RecipeSecondaryAction;
}

export function RecipeForm({ initialValues, submitLabel, submitting, onSubmit, secondaryAction }: RecipeFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [servings, setServings] = useState(initialValues.servings);
  const [notes, setNotes] = useState(initialValues.notes);
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>(initialValues.ingredients);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const { data: searchResults } = useQuery({
    queryKey: ['foods', 'search', searchText],
    queryFn: () => listFoods(searchText),
    enabled: searchText.trim().length > 0,
  });

  const preview = useMemo(() => {
    const servingsNum = Number(servings) || 1;
    const validIngredients = ingredients
      .map((i) => ({ food: i.food, quantityG: Number(i.quantityG) }))
      .filter((i) => i.quantityG > 0);
    if (validIngredients.length === 0) return null;
    try {
      const { totals, totalWeightG } = computeRecipeTotals(validIngredients);
      const perServing = roundNutritionForDisplay({
        calories: totals.calories / servingsNum,
        proteinG: totals.proteinG / servingsNum,
        carbsG: totals.carbsG / servingsNum,
        fatG: totals.fatG / servingsNum,
        fiberG: totals.fiberG / servingsNum,
        sugarG: totals.sugarG / servingsNum,
        sodiumMg: totals.sodiumMg / servingsNum,
      });
      return { totalWeightG, perServing };
    } catch {
      return null;
    }
  }, [ingredients, servings]);

  function addIngredient(food: Food) {
    if (!isWeighableUnit(food.servingUnit)) {
      setError(`${food.name} is logged as "${food.servingAmount} ${food.servingUnit}", not a weight, so it can't be used in a recipe.`);
      return;
    }
    setError(null);
    setIngredients((prev) => [...prev, { food, quantityG: '100' }]);
    setSearchText('');
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function setIngredientQuantity(index: number, quantityG: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, quantityG } : ing)));
  }

  function handleSubmit() {
    const parsed = parseRecipeFormValues({ name, servings, notes, ingredients });
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onSubmit(parsed);
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      data={ingredients}
      keyExtractor={(item, index) => `${item.food.id}-${index}`}
      ListHeaderComponent={
        <View style={styles.headerFields}>
          <Card style={styles.card}>
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="decimal-pad" />
            <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
          </Card>

          <Text style={styles.sectionLabel}>INGREDIENTS</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods to add…"
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          {searchResults && searchResults.length > 0 && (
            <Card style={styles.searchResults}>
              {searchResults.map((food) => (
                <TouchableOpacity key={food.id} style={styles.searchResultRow} onPress={() => addIngredient(food)}>
                  <Text style={styles.searchResultText}>{food.name}</Text>
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </Card>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={styles.ingredientRow}>
          <Text style={styles.ingredientName}>{item.food.name}</Text>
          <TextInput
            style={styles.quantityInput}
            value={item.quantityG}
            onChangeText={(v) => setIngredientQuantity(index, v)}
            keyboardType="decimal-pad"
          />
          <Text style={styles.gramsLabel}>g</Text>
          <TouchableOpacity onPress={() => removeIngredient(index)} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No ingredients added yet</Text>}
      ListFooterComponent={
        <View style={styles.footer}>
          {preview && (
            <Card style={styles.previewBox}>
              <Text style={styles.previewTitle}>Batch weight: {preview.totalWeightG.toFixed(0)} g</Text>
              <Text style={styles.previewText}>
                Per serving: {preview.perServing.calories} kcal · {preview.perServing.proteinG} g protein
              </Text>
            </Card>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.actionsRow}>
            <AppButton
              title={submitting ? 'Saving…' : submitLabel}
              onPress={handleSubmit}
              disabled={submitting}
              style={styles.actionButton}
            />
            {secondaryAction && (
              <AppButton
                title={secondaryAction.label}
                variant="danger"
                onPress={secondaryAction.onPress}
                disabled={secondaryAction.disabled}
                style={styles.actionButton}
              />
            )}
          </View>
        </View>
      }
    />
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
      />
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
    paddingBottom: 48,
  },
  headerFields: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
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
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    ...typography.label,
    marginLeft: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
  },
  searchResults: {
    padding: 0,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchResultText: {
    color: colors.textPrimary,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  ingredientName: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  quantityInput: {
    width: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: 'right',
    color: colors.textPrimary,
  },
  gramsLabel: {
    color: colors.textMuted,
  },
  emptyText: {
    color: colors.textMuted,
    paddingVertical: 12,
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  previewBox: {
    gap: spacing.xs,
  },
  previewTitle: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  previewText: {
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
