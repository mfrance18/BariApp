import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { roundNutritionForDisplay } from '../services/nutrition/scaling';
import { ozToMl } from '../utils/units';

export interface FoodFormValues {
  name: string;
  brand: string;
  barcode: string;
  basisType: 'per_100g' | 'per_serving';
  servingSize: string;
  servingSizeUnit: 'g' | 'oz';
  servingLabel: string;
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
  basisType: 'per_100g',
  servingSize: '',
  servingSizeUnit: 'g',
  servingLabel: '',
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
  basisType: 'per_100g' | 'per_serving';
  servingSizeG: number | null;
  servingSizeUnit: 'g' | 'oz';
  servingLabel: string | null;
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
  const enteredServingSize = values.servingSize ? Number(values.servingSize) : null;
  if (values.basisType === 'per_serving' && (!enteredServingSize || enteredServingSize <= 0)) {
    return { error: 'Serving size must be greater than 0' };
  }
  // Serving size is always stored in grams; oz is converted using the same
  // fl-oz-to-mL factor the Fluids tab uses (water-equivalent density, fine
  // for the packaged drinks/foods this is meant for).
  const servingSizeG = enteredServingSize == null ? null : values.servingSizeUnit === 'oz' ? ozToMl(enteredServingSize) : enteredServingSize;
  const num = (s: string) => (s.trim() ? Number(s) : 0);
  return {
    name: values.name.trim(),
    brand: values.brand.trim() || null,
    barcode: values.barcode.trim() || null,
    basisType: values.basisType,
    servingSizeG,
    servingSizeUnit: values.servingSizeUnit,
    servingLabel: values.servingLabel.trim() || null,
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

interface FoodFormProps {
  initialValues: FoodFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: ParsedFoodValues) => void;
  onScanBarcode?: () => void;
}

export function FoodForm({ initialValues, submitLabel, submitting, onSubmit, onScanBarcode }: FoodFormProps) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);

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
    const entered = Number(values.servingSize);
    if (!entered || entered <= 0) return;
    const grams = values.servingSizeUnit === 'oz' ? ozToMl(entered) : entered;
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onScanBarcode && <Button title="Scan Barcode" onPress={onScanBarcode} />}

      <Field label="Name" value={values.name} onChangeText={(v) => set('name', v)} />
      <Field label="Brand" value={values.brand} onChangeText={(v) => set('brand', v)} />
      <Field
        label="Barcode"
        value={values.barcode}
        onChangeText={(v) => set('barcode', v)}
        keyboardType="number-pad"
      />

      <Text style={styles.sectionLabel}>Nutrition basis</Text>
      <View style={styles.segmentRow}>
        <SegmentButton
          label="Per 100g"
          active={values.basisType === 'per_100g'}
          onPress={() => set('basisType', 'per_100g')}
        />
        <SegmentButton
          label="Per serving"
          active={values.basisType === 'per_serving'}
          onPress={() => set('basisType', 'per_serving')}
        />
      </View>

      {values.basisType === 'per_serving' && (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Serving size</Text>
            <View style={styles.servingSizeRow}>
              <TextInput
                style={[styles.input, styles.servingSizeInput]}
                value={values.servingSize}
                onChangeText={(v) => set('servingSize', v)}
                keyboardType="decimal-pad"
              />
              <View style={styles.unitSegmentRow}>
                <UnitButton label="g" active={values.servingSizeUnit === 'g'} onPress={() => set('servingSizeUnit', 'g')} />
                <UnitButton
                  label="oz"
                  active={values.servingSizeUnit === 'oz'}
                  onPress={() => set('servingSizeUnit', 'oz')}
                />
              </View>
            </View>
          </View>
          <Field
            label="Serving label (e.g. 1 bottle)"
            value={values.servingLabel}
            onChangeText={(v) => set('servingLabel', v)}
          />
        </>
      )}

      <Text style={styles.sectionLabel}>
        Nutrition ({values.basisType === 'per_100g' ? 'per 100g' : 'per serving'})
      </Text>
      <Field label="Calories" value={values.calories} onChangeText={(v) => set('calories', v)} keyboardType="decimal-pad" />
      <Field label="Protein (g)" value={values.proteinG} onChangeText={(v) => set('proteinG', v)} keyboardType="decimal-pad" />
      <Field label="Carbs (g)" value={values.carbsG} onChangeText={(v) => set('carbsG', v)} keyboardType="decimal-pad" />
      <Field label="Fat (g)" value={values.fatG} onChangeText={(v) => set('fatG', v)} keyboardType="decimal-pad" />
      <Field label="Fiber (g)" value={values.fiberG} onChangeText={(v) => set('fiberG', v)} keyboardType="decimal-pad" />
      <Field label="Sugar (g)" value={values.sugarG} onChangeText={(v) => set('sugarG', v)} keyboardType="decimal-pad" />
      <Field label="Sodium (mg)" value={values.sodiumMg} onChangeText={(v) => set('sodiumMg', v)} keyboardType="decimal-pad" />

      {values.basisType === 'per_serving' && (
        <View style={styles.scaleHelper}>
          <Button title="Scale values above from per-100g to this serving" onPress={scaleValuesToServing} />
          <Text style={styles.helperCaption}>
            If the numbers above are currently per 100g, this multiplies them by the serving size to fill in
            per-serving values instead.
          </Text>
        </View>
      )}

      <Field label="Notes" value={values.notes} onChangeText={(v) => set('notes', v)} multiline />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Button title={submitting ? 'Saving…' : submitLabel} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
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
      />
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      {label}
    </Text>
  );
}

function UnitButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.unitButton, active && styles.segmentButtonActive]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 48,
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
    paddingVertical: 8,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    color: '#333',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  segmentButtonActive: {
    backgroundColor: '#dbeafe',
    fontWeight: '700',
  },
  servingSizeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  servingSizeInput: {
    flex: 1,
  },
  unitSegmentRow: {
    flexDirection: 'row',
    gap: 4,
  },
  unitButton: {
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  errorText: {
    color: '#c00',
    fontSize: 13,
  },
  scaleHelper: {
    gap: 4,
  },
  helperCaption: {
    fontSize: 12,
    color: '#888',
  },
});
