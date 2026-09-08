import { useState } from 'react';
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
  servingWeightUnit: '',
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

interface FoodFormProps {
  initialValues: FoodFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: ParsedFoodValues) => void;
  onScanBarcode?: () => void;
  secondaryAction?: SecondaryAction;
}

export function FoodForm({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
  onScanBarcode,
  secondaryAction,
}: FoodFormProps) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  function set<K extends keyof FoodFormValues>(key: K, value: FoodFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const parsed = parseFoodFormValues(values);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onSubmit(parsed);
  }

  function scaleValuesToServing() {
    const amount = Number(values.servingAmount);
    if (!amount || amount <= 0) return;
    const grams = servingToGrams(amount, values.servingUnit);
    if (grams == null) return;
    const factor = grams / 100;
    const num = (s: string) => (s.trim() ? Number(s) : 0);
    const scaled = roundNutritionForDisplay({
      calories: num(values.calories) * factor,
      proteinG: num(values.proteinG) * factor,
      carbsG: num(values.carbsG) * factor,
      fatG: num(values.fatG) * factor,
      fiberG: num(values.fiberG) * factor,
      sugarG: num(values.sugarG) * factor,
      sodiumMg: num(values.sodiumMg) * factor,
    });
    setValues((prev) => ({
      ...prev,
      calories: String(scaled.calories),
      proteinG: String(scaled.proteinG),
      carbsG: String(scaled.carbsG),
      fatG: String(scaled.fatG),
      fiberG: String(scaled.fiberG),
      sugarG: String(scaled.sugarG),
      sodiumMg: String(scaled.sodiumMg),
    }));
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

        {isWeighableUnit(values.servingUnit) && (
          <View style={styles.scaleHelper}>
            <AppButton title="Scale values above from per-100g to this serving" variant="secondary" onPress={scaleValuesToServing} />
            <Text style={styles.helperCaption}>
              If the numbers above are currently per 100g, this multiplies them by the serving size to fill in
              per-serving values instead.
            </Text>
          </View>
        )}
      </Card>

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
  scaleHelper: {
    gap: spacing.xs,
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
