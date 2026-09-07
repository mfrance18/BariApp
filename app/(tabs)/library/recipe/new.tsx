import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { EMPTY_RECIPE_FORM_VALUES, RecipeForm, type ParsedRecipeValues } from '../../../../src/components/RecipeForm';
import { createRecipe } from '../../../../src/db/repositories/recipesRepo';

export default function NewRecipeScreen() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: ParsedRecipeValues) => createRecipe(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      router.back();
    },
  });

  return (
    <RecipeForm
      initialValues={EMPTY_RECIPE_FORM_VALUES}
      submitLabel="Save Recipe"
      submitting={mutation.isPending}
      onSubmit={(values) => mutation.mutate(values)}
    />
  );
}
