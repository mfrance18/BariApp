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

function recipeToFormValues(recipe: RecipeWithIngredients): RecipeFormValues {
  return {
    name: recipe.name,
    servings: String(recipe.servings),
    notes: recipe.notes ?? '',
    ingredients: recipe.ingredients.map((ingredient) => ({
      food: ingredient.food,
      // Only grams are persisted, so an edited recipe reopens in grams even
      // if it was originally entered in another unit (e.g. oz).
      quantityAmount: String(ingredient.quantityG),
      quantityUnit: 'g',
    })),
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
