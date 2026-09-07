import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { listFoods, type Food } from '../db/repositories/foodsRepo';
import { computeRecipeTotals, roundNutritionForDisplay } from '../services/nutrition/scaling';

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

interface RecipeFormProps {
  initialValues: RecipeFormValues;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: ParsedRecipeValues) => void;
}

export function RecipeForm({ initialValues, submitLabel, submitting, onSubmit }: RecipeFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [servings, setServings] = useState(initialValues.servings);
  const [notes, setNotes] = useState(initialValues.notes);
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>(initialValues.ingredients);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<string | null>(null);

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
  }, [ingredients, servings]);

  function addIngredient(food: Food) {
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
      contentContainerStyle={styles.content}
      data={ingredients}
      keyExtractor={(item, index) => `${item.food.id}-${index}`}
      ListHeaderComponent={
        <View style={styles.headerFields}>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="decimal-pad" />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

          <Text style={styles.sectionLabel}>Ingredients</Text>
          <TextInput
            style={styles.input}
            placeholder="Search foods to add…"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchResults && searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((food) => (
                <TouchableOpacity key={food.id} style={styles.searchResultRow} onPress={() => addIngredient(food)}>
                  <Text>{food.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
          <Text style={styles.removeLink} onPress={() => removeIngredient(index)}>
            Remove
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No ingredients added yet</Text>}
      ListFooterComponent={
        <View style={styles.footer}>
          {preview && (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>
                Batch weight: {preview.totalWeightG.toFixed(0)} g
              </Text>
              <Text style={styles.previewText}>
                Per serving: {preview.perServing.calories} kcal · {preview.perServing.proteinG} g protein
              </Text>
            </View>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button title={submitting ? 'Saving…' : submitLabel} onPress={handleSubmit} disabled={submitting} />
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  headerFields: {
    gap: 12,
    marginBottom: 8,
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
  searchResults: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  searchResultRow: {
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  ingredientName: {
    flex: 1,
    fontSize: 15,
  },
  quantityInput: {
    width: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: 'right',
  },
  gramsLabel: {
    color: '#777',
  },
  removeLink: {
    color: '#c00',
    fontSize: 13,
  },
  emptyText: {
    color: '#888',
    paddingVertical: 12,
  },
  footer: {
    gap: 12,
    marginTop: 16,
  },
  previewBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  previewTitle: {
    fontWeight: '600',
  },
  previewText: {
    color: '#444',
  },
  errorText: {
    color: '#c00',
    fontSize: 13,
  },
});
