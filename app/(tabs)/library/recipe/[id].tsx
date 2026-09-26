import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { RecipeForm, type ParsedRecipeValues, type RecipeFormValues } from '../../../../src/components/RecipeForm';
import {
  archiveRecipe,
  getRecipeWithIngredients,
  updateRecipe,
  type RecipeWithIngredients,
} from '../../../../src/db/repositories/recipesRepo';
import { colors } from '../../../../src/theme/theme';
import { gramsToServing } from '../../../../src/utils/servingUnits';

function recipeToFormValues(recipe: RecipeWithIngredients): RecipeFormValues {
  return {
    name: recipe.name,
    servings: String(recipe.servings),
    notes: recipe.notes ?? '',
    // Only grams are persisted, so convert back to oz for display here,
    // matching RecipeForm's own oz-by-default convention when adding an
    // ingredient (see requestAddIngredient).
    ingredients: recipe.ingredients.map((ingredient) => {
      const oz = gramsToServing(ingredient.quantityG, 'oz') ?? ingredient.quantityG;
      return {
        food: ingredient.food,
        quantityAmount: String(Math.round(oz * 100) / 100),
        quantityUnit: 'oz',
      };
    }),
  };
}

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(id);
  const queryClient = useQueryClient();

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipes', recipeId],
    queryFn: () => getRecipeWithIngredients(recipeId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ParsedRecipeValues) => updateRecipe(recipeId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Could not save changes', error.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveRecipe(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Could not delete recipe', error.message);
    },
  });

  function confirmDelete() {
    Alert.alert('Delete Recipe', `Delete "${recipe?.name}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => archiveMutation.mutate() },
    ]);
  }

  if (isLoading || !recipe) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RecipeForm
        initialValues={recipeToFormValues(recipe)}
        submitLabel="Save Changes"
        submitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
        secondaryAction={{
          label: archiveMutation.isPending ? 'Deleting…' : 'Delete Recipe',
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
