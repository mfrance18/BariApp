import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { roundNutritionForDisplay } from '../services/nutrition/scaling';
import { colors, radius, spacing, typography } from '../theme/theme';
import { isWeighableUnit, servingToGrams } from '../utils/servingUnits';
import { AppButton } from './ui/AppButton';
import { Card } from './ui/Card';

export interface FoodFormValues {
  name: string;
  brand: string;
  barcode: string;
  servingAmount: string;
  servingUnit: string;
  servingWeightAmount: string;
  servingWeightUnit: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  sugarG: string;
  sodiumMg: string;
  notes: string;
}

export const EMPTY_FOOD_FORM_VALUES: FoodFormValues = {
  name: '',
  brand: '',
  barcode: '',
  servingAmount: '1',
  servingUnit: '',
  servingWeightAmount: '',
  servingWeightUnit: 'oz',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
  sugarG: '',
  sodiumMg: '',
  notes: '',
};

export interface ParsedFoodValues {
  name: string;
  brand: string | null;
  barcode: string | null;
  servingAmount: number;
  servingUnit: string;
  servingWeightG: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  notes: string | null;
}

export function parseFoodFormValues(values: FoodFormValues): ParsedFoodValues | { error: string } {
  if (!values.name.trim()) {
    return { error: 'Name is required' };
  }
  const servingAmount = Number(values.servingAmount);
  if (!servingAmount || servingAmount <= 0) {
    return { error: 'Serving amount must be greater than 0' };
  }
  if (!values.servingUnit.trim()) {
    return { error: 'Enter a serving unit (e.g. g, oz, bottle, scoop)' };
  }
  const servingUnit = values.servingUnit.trim();
  let servingWeightG: number | null = null;
  if (!isWeighableUnit(servingUnit) && values.servingWeightAmount.trim()) {
    const weightAmount = Number(values.servingWeightAmount);
    if (!weightAmount || weightAmount <= 0) {
      return { error: 'Weight equivalent amount must be greater than 0' };
    }
    const weightUnit = values.servingWeightUnit.trim() || 'g';
    const grams = servingToGrams(weightAmount, weightUnit);
    if (grams == null) {
      return { error: `"${weightUnit}" isn't a recognized weight unit (try g, oz, lb, kg, ml)` };
    }
    servingWeightG = grams;
  }
  const num = (s: string) => (s.trim() ? Number(s) : 0);
  return {
    name: values.name.trim(),
    brand: values.brand.trim() || null,
    barcode: values.barcode.trim() || null,
    servingAmount,
    servingUnit,
    servingWeightG,
    calories: num(values.calories),
    proteinG: num(values.proteinG),
    carbsG: num(values.carbsG),
    fatG: num(values.fatG),
    fiberG: num(values.fiberG),
    sugarG: num(values.sugarG),
    sodiumMg: num(values.sodiumMg),
    notes: values.notes.trim() || null,
  };
}

interface SecondaryAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

interface ExtraSubmitAction {
  label: string;
  onSubmit: (values: ParsedFoodValues) => void;
  disabled?: boolean;
}

interface FoodFormProps {
  initialValues: FoodFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: ParsedFoodValues) => void;
  onScanBarcode?: () => void;
  secondaryAction?: SecondaryAction;
  /** A second, equally-valid way to submit the same validated form (e.g. "Weigh It" alongside "Add"). */
  extraSubmitAction?: ExtraSubmitAction;
}

export function FoodForm({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
  onScanBarcode,
  secondaryAction,
  extraSubmitAction,
}: FoodFormProps) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const prevServingRef = useRef({ amount: initialValues.servingAmount, unit: initialValues.servingUnit });

  function set<K extends keyof FoodFormValues>(key: K, value: FoodFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Rescales nutrition (and, for a non-weighable unit, the weight
  // equivalent) whenever the serving amount/unit changes, so they stay
  // consistent with whatever was last entered instead of going stale.
  // Reads the current field values fresh from the updater's `current`, so a
  // manual edit to any of them is always what the next rescale starts from.
  useEffect(() => {
    const prev = prevServingRef.current;
    prevServingRef.current = { amount: values.servingAmount, unit: values.servingUnit };
    if (prev.amount === values.servingAmount && prev.unit === values.servingUnit) return;

    const prevAmount = Number(prev.amount);
    const newAmount = Number(values.servingAmount);
    if (!prevAmount || prevAmount <= 0 || !newAmount || newAmount <= 0) return;

    let ratio: number | null = null;
    if (isWeighableUnit(prev.unit) && isWeighableUnit(values.servingUnit)) {
      const prevGrams = servingToGrams(prevAmount, prev.unit);
      const newGrams = servingToGrams(newAmount, values.servingUnit);
      if (prevGrams != null && newGrams != null && prevGrams > 0) ratio = newGrams / prevGrams;
    } else if (prev.unit.trim().toLowerCase() === values.servingUnit.trim().toLowerCase()) {
      // Same (possibly non-weighable) unit, only the amount changed — scale by that alone.
      ratio = newAmount / prevAmount;
    }
    // Otherwise the unit changed to something we can't relate to the old one
    // (e.g. "bottle" to "scoop") — leave the values as entered.
    if (ratio == null) return;
    const appliedRatio = ratio;

    setValues((current) => {
      const num = (s: string) => (s.trim() ? Number(s) : 0);
      const hasNutrition = [
        current.calories,
        current.proteinG,
        current.carbsG,
        current.fatG,
        current.fiberG,
        current.sugarG,
        current.sodiumMg,
      ].some((v) => v.trim() !== '' && Number(v) !== 0);

      const scaledNutrition = hasNutrition
        ? roundNutritionForDisplay({
            calories: num(current.calories) * appliedRatio,
            proteinG: num(current.proteinG) * appliedRatio,
            carbsG: num(current.carbsG) * appliedRatio,
            fatG: num(current.fatG) * appliedRatio,
            fiberG: num(current.fiberG) * appliedRatio,
            sugarG: num(current.sugarG) * appliedRatio,
            sodiumMg: num(current.sodiumMg) * appliedRatio,
          })
        : null;

      const scaledWeightAmount =
        !isWeighableUnit(current.servingUnit) && current.servingWeightAmount.trim()
          ? String(Math.round(Number(current.servingWeightAmount) * appliedRatio * 100) / 100)
          : current.servingWeightAmount;

      if (!scaledNutrition && scaledWeightAmount === current.servingWeightAmount) return current;

      return {
        ...current,
        ...(scaledNutrition && {
          calories: String(scaledNutrition.calories),
          proteinG: String(scaledNutrition.proteinG),
          carbsG: String(scaledNutrition.carbsG),
          fatG: String(scaledNutrition.fatG),
          fiberG: String(scaledNutrition.fiberG),
          sugarG: String(scaledNutrition.sugarG),
          sodiumMg: String(scaledNutrition.sodiumMg),
        }),
        servingWeightAmount: scaledWeightAmount,
      };
    });
  }, [values.servingAmount, values.servingUnit]);

  function handleSubmit(action: (values: ParsedFoodValues) => void) {
    const parsed = parseFoodFormValues(values);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    action(parsed);
  }

  const servingDescription =
    values.servingAmount && values.servingUnit ? `${values.servingAmount} ${values.servingUnit}` : 'serving';

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={StyleSheet.flatten([styles.content, { paddingBottom: 24 + insets.bottom }])}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={120}
      keyboardOpeningTime={0}
    >
      {onScanBarcode && <AppButton title="Scan Barcode" variant="secondary" onPress={onScanBarcode} />}

      <Card style={styles.card}>
        <Field label="Name" value={values.name} onChangeText={(v) => set('name', v)} />
        <Field label="Brand" value={values.brand} onChangeText={(v) => set('brand', v)} />
        <Field
          label="Barcode"
          value={values.barcode}
          onChangeText={(v) => set('barcode', v)}
          keyboardType="number-pad"
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>SERVING SIZE</Text>
        <View style={styles.servingSizeRow}>
          <View style={styles.servingAmountField}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              value={values.servingAmount}
              onChangeText={(v) => set('servingAmount', v)}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.servingUnitField}>
            <Text style={styles.fieldLabel}>Unit</Text>
            <TextInput
              style={styles.input}
              value={values.servingUnit}
              onChangeText={(v) => set('servingUnit', v)}
              placeholder="g, oz, bottle, scoop…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>
        </View>

        {!isWeighableUnit(values.servingUnit) && (
          <View style={styles.weightEquivalent}>
            <Text style={styles.fieldLabel}>Weight equivalent (optional)</Text>
            <View style={styles.servingSizeRow}>
              <View style={styles.servingAmountField}>
                <TextInput
                  style={styles.input}
                  value={values.servingWeightAmount}
                  onChangeText={(v) => set('servingWeightAmount', v)}
                  keyboardType="decimal-pad"
                  placeholder="12"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.servingUnitField}>
                <TextInput
                  style={styles.input}
                  value={values.servingWeightUnit}
                  onChangeText={(v) => set('servingWeightUnit', v)}
                  placeholder="oz, g, ml…"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <Text style={styles.helperCaption}>
              e.g. if 1 {values.servingUnit.trim() || 'unit'} weighs 12 oz, this lets it be used in recipes and weighed
              when logging.
            </Text>
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>NUTRITION (PER {servingDescription.toUpperCase()})</Text>
        <Field label="Calories" value={values.calories} onChangeText={(v) => set('calories', v)} keyboardType="decimal-pad" />
        <Field label="Protein (g)" value={values.proteinG} onChangeText={(v) => set('proteinG', v)} keyboardType="decimal-pad" />
        <Field label="Carbs (g)" value={values.carbsG} onChangeText={(v) => set('carbsG', v)} keyboardType="decimal-pad" />
        <Field label="Fat (g)" value={values.fatG} onChangeText={(v) => set('fatG', v)} keyboardType="decimal-pad" />
        <Field label="Fiber (g)" value={values.fiberG} onChangeText={(v) => set('fiberG', v)} keyboardType="decimal-pad" />
        <Field label="Sugar (g)" value={values.sugarG} onChangeText={(v) => set('sugarG', v)} keyboardType="decimal-pad" />
        <Field label="Sodium (mg)" value={values.sodiumMg} onChangeText={(v) => set('sodiumMg', v)} keyboardType="decimal-pad" />
        <Text style={styles.helperCaption}>
          Changing the serving amount or unit above automatically rescales these values to match.
        </Text>
      </Card>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actionsRow}>
        <AppButton
          title={submitting ? 'Saving…' : submitLabel}
          onPress={() => handleSubmit(onSubmit)}
          disabled={submitting}
          style={styles.actionButton}
        />
        {extraSubmitAction && (
          <AppButton
            title={extraSubmitAction.label}
            variant="secondary"
            onPress={() => handleSubmit(extraSubmitAction.onSubmit)}
            disabled={extraSubmitAction.disabled}
            style={styles.actionButton}
          />
        )}
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
    </KeyboardAwareScrollView>
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
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
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
    gap: spacing.md,
    paddingBottom: 48,
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
  weightEquivalent: {
    gap: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  helperCaption: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
