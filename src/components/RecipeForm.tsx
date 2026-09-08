import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createFood, getFoodByBarcode, listFoods, restoreFood, type Food } from '../db/repositories/foodsRepo';
import { getProductByBarcode } from '../services/openFoodFacts/client';
import { mapOffProductToFood } from '../services/openFoodFacts/mapper';
import type { OffProduct } from '../services/openFoodFacts/types';
import { useOffFoodSearch } from '../services/openFoodFacts/useOffFoodSearch';
import { computeRecipeTotals, roundNutritionForDisplay } from '../services/nutrition/scaling';
import { colors, radius, spacing, typography } from '../theme/theme';
import { isWeighableUnit, servingToGrams } from '../utils/servingUnits';
import { AppButton } from './ui/AppButton';
import { BarcodeScanner } from './BarcodeScanner';
import { Card } from './ui/Card';
import { OffFoodResults } from './OffFoodResults';

export interface RecipeIngredientDraft {
  food: Food;
  /** As entered by the user (e.g. "8" + "oz") — converted to grams only at parse/preview time. */
  quantityAmount: string;
  quantityUnit: string;
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
  const ingredients: { foodId: number; quantityG: number }[] = [];
  for (const ingredient of values.ingredients) {
    const amount = Number(ingredient.quantityAmount);
    if (!amount || amount <= 0) {
      return { error: `Enter a valid amount for ${ingredient.food.name}` };
    }
    const grams = servingToGrams(amount, ingredient.quantityUnit);
    if (grams == null) {
      return { error: `"${ingredient.quantityUnit}" isn't a recognized weight unit for ${ingredient.food.name}` };
    }
    ingredients.push({ foodId: ingredient.food.id, quantityG: grams });
  }
  return {
    name: values.name.trim(),
    servings,
    notes: values.notes.trim() || null,
    ingredients,
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
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [pendingIngredient, setPendingIngredient] = useState<Food | null>(null);
  const [quantityAmount, setQuantityAmount] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const { data: searchResults } = useQuery({
    queryKey: ['foods', 'search', searchText],
    queryFn: () => listFoods(searchText),
    enabled: searchText.trim().length > 0,
  });

  const showOffSearch = searchText.trim().length > 1;
  const offSearch = useOffFoodSearch(searchText, showOffSearch);

  const preview = useMemo(() => {
    const servingsNum = Number(servings) || 1;
    const validIngredients = ingredients
      .map((i) => ({ food: i.food, quantityG: servingToGrams(Number(i.quantityAmount), i.quantityUnit) }))
      .filter((i): i is { food: Food; quantityG: number } => i.quantityG != null && i.quantityG > 0);
    if (validIngredients.length === 0) return null;
    try {
      const { totals } = computeRecipeTotals(validIngredients);
      const perServing = roundNutritionForDisplay({
        calories: totals.calories / servingsNum,
        proteinG: totals.proteinG / servingsNum,
        carbsG: totals.carbsG / servingsNum,
        fatG: totals.fatG / servingsNum,
        fiberG: totals.fiberG / servingsNum,
        sugarG: totals.sugarG / servingsNum,
        sodiumMg: totals.sodiumMg / servingsNum,
      });
      return { perServing };
    } catch {
      return null;
    }
  }, [ingredients, servings]);

  /**
   * Opens the quantity-entry popup for the food, prefilled from its own
   * serving size. Returns an error message if the food can't be used at all
   * (no weighable serving unit and no captured weight equivalent), or null
   * once the popup is open.
   */
  function requestAddIngredient(food: Food): string | null {
    if (!isWeighableUnit(food.servingUnit) && food.servingWeightG == null) {
      const message = `${food.name} is logged as "${food.servingAmount} ${food.servingUnit}", not a weight, so it can't be used in a recipe.`;
      setError(message);
      return message;
    }
    setError(null);
    setQuantityError(null);
    if (isWeighableUnit(food.servingUnit)) {
      setQuantityAmount(String(food.servingAmount));
      setQuantityUnit(food.servingUnit);
    } else {
      setQuantityAmount(food.servingWeightG != null ? String(food.servingWeightG) : '');
      setQuantityUnit('g');
    }
    setPendingIngredient(food);
    return null;
  }

  function confirmAddIngredient() {
    if (!pendingIngredient) return;
    const amount = Number(quantityAmount);
    if (!amount || amount <= 0) {
      setQuantityError('Enter an amount greater than 0');
      return;
    }
    const unit = quantityUnit.trim() || 'g';
    if (servingToGrams(amount, unit) == null) {
      setQuantityError(`"${unit}" isn't a recognized weight unit (try g, oz, lb, kg, ml)`);
      return;
    }
    setIngredients((prev) => [
      ...prev,
      { food: pendingIngredient, quantityAmount: String(amount), quantityUnit: unit },
    ]);
    setSearchText('');
    setPendingIngredient(null);
    setQuantityError(null);
  }

  async function handleSelectOffProduct(product: OffProduct) {
    try {
      const existing = await getFoodByBarcode(product.code);
      if (existing) {
        if (existing.archivedAt) {
          await restoreFood(existing.id);
        }
        requestAddIngredient({ ...existing, archivedAt: null });
        return;
      }
      const created = await createFood(mapOffProductToFood(product, product.code));
      requestAddIngredient(created);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleScanIngredient(barcode: string) {
    try {
      const existing = await getFoodByBarcode(barcode);
      let food: Food;
      if (existing) {
        if (existing.archivedAt) {
          await restoreFood(existing.id);
        }
        food = { ...existing, archivedAt: null };
      } else {
        const product = await getProductByBarcode(barcode);
        if (!product) {
          setScanStatus("Barcode not found on Open Food Facts — try searching by name instead.");
          return;
        }
        food = await createFood(mapOffProductToFood(product, barcode));
      }
      const errorMessage = requestAddIngredient(food);
      if (errorMessage) {
        setScanStatus(errorMessage);
      } else {
        setScanStatus(null);
        setScannerVisible(false);
      }
    } catch (err) {
      setScanStatus((err as Error).message);
    }
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function setIngredientAmount(index: number, quantityAmount: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, quantityAmount } : ing)));
  }

  function setIngredientUnit(index: number, quantityUnit: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, quantityUnit } : ing)));
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
    <>
    <KeyboardAwareFlatList
      style={styles.container}
      contentContainerStyle={StyleSheet.flatten([styles.content, { paddingBottom: 24 + insets.bottom }])}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={120}
      keyboardOpeningTime={0}
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
          <AppButton
            title="Scan Barcode"
            variant="secondary"
            onPress={() => {
              setScanStatus(null);
              setScannerVisible(true);
            }}
          />
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
                <TouchableOpacity key={food.id} style={styles.searchResultRow} onPress={() => requestAddIngredient(food)}>
                  <Text style={styles.searchResultText}>{food.name}</Text>
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </Card>
          )}
          {showOffSearch && (
            <View style={styles.offSection}>
              <OffFoodResults
                results={offSearch.results}
                loading={offSearch.loading}
                error={offSearch.error}
                onRetry={offSearch.retry}
                hasMore={offSearch.hasMore}
                loadingMore={offSearch.loadingMore}
                onLoadMore={offSearch.loadMore}
                onSelect={handleSelectOffProduct}
              />
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={styles.ingredientRow}>
          <Text style={styles.ingredientName}>{item.food.name}</Text>
          <TextInput
            style={styles.quantityInput}
            value={item.quantityAmount}
            onChangeText={(v) => setIngredientAmount(index, v)}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={styles.unitInput}
            value={item.quantityUnit}
            onChangeText={(v) => setIngredientUnit(index, v)}
            autoCapitalize="none"
          />
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
              <Text style={styles.previewTitle}>
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
    <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
      <View style={styles.scannerModal}>
        <BarcodeScanner onScanned={handleScanIngredient} statusText={scanStatus ?? undefined} />
        <View style={[styles.scannerCloseRow, { paddingBottom: 16 + insets.bottom }]}>
          <AppButton title="Done" onPress={() => setScannerVisible(false)} />
        </View>
      </View>
    </Modal>
    <Modal
      visible={!!pendingIngredient}
      transparent
      animationType="fade"
      onRequestClose={() => setPendingIngredient(null)}
    >
      <View style={styles.quantityModalOverlay}>
        <Card style={styles.quantityModalCard}>
          <Text style={styles.quantityModalTitle}>Add {pendingIngredient?.name}</Text>
          <View style={styles.servingSizeRow}>
            <View style={styles.servingAmountField}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                value={quantityAmount}
                onChangeText={setQuantityAmount}
                keyboardType="decimal-pad"
                placeholder="12"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>
            <View style={styles.servingUnitField}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <TextInput
                style={styles.input}
                value={quantityUnit}
                onChangeText={setQuantityUnit}
                placeholder="g, oz, ml, lb…"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
          </View>
          {quantityError && <Text style={styles.errorText}>{quantityError}</Text>}
          <View style={styles.actionsRow}>
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setPendingIngredient(null)}
              style={styles.actionButton}
            />
            <AppButton title="Add to Recipe" onPress={confirmAddIngredient} style={styles.actionButton} />
          </View>
        </Card>
      </View>
    </Modal>
    </>
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
  offSection: {
    marginTop: spacing.sm,
  },
  scannerModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerCloseRow: {
    padding: spacing.lg,
    backgroundColor: colors.background,
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
    width: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: 'right',
    color: colors.textPrimary,
  },
  unitInput: {
    width: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    color: colors.textPrimary,
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
  servingSizeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  servingAmountField: {
    flex: 1,
    gap: spacing.xs,
  },
  servingUnitField: {
    flex: 2,
    gap: spacing.xs,
  },
  quantityModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.lg,
  },
  quantityModalCard: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  quantityModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
