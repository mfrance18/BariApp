import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { RecipeForm, type ParsedRecipeValues, type RecipeFormValues } from '../../../../src/components/RecipeForm';
import { AppButton } from '../../../../src/components/ui/AppButton';
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
      quantityG: String(ingredient.quantityG),
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
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveRecipe(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.back();
    },
  });

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
      />
      <View style={styles.deleteRow}>
        <AppButton title="Delete Recipe" variant="danger" onPress={() => archiveMutation.mutate()} />
      </View>
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
  deleteRow: {
    padding: 16,
  },
});
