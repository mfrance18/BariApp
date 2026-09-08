import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { OffFoodResults } from '../../../src/components/OffFoodResults';
import { AppButton } from '../../../src/components/ui/AppButton';
import { KeyboardAvoidingScreen } from '../../../src/components/ui/KeyboardAvoidingScreen';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { getFoodById, listFoods } from '../../../src/db/repositories/foodsRepo';
import { createEntry } from '../../../src/db/repositories/mealLogRepo';
import { getRecipeWithIngredients, listRecipes } from '../../../src/db/repositories/recipesRepo';
import {
  computeRecipeTotals,
  getReferenceWeightG,
  roundNutritionForDisplay,
  scaleRecipePortion,
} from '../../../src/services/nutrition/scaling';
import type { MealType } from '../../../src/services/nutrition/totals';
import { useOffFoodSearch } from '../../../src/services/openFoodFacts/useOffFoodSearch';
import { colors, radius, spacing } from '../../../src/theme/theme';
import { todayLogDateKey } from '../../../src/utils/date';
import { isWeighableUnit } from '../../../src/utils/servingUnits';

type PickTab = 'foods' | 'recipes';
type QuickAddTarget = { itemType: PickTab; id: number };

export default function PickItemScreen() {
  const queryClient = useQueryClient();
  const { mealType, logDate } = useLocalSearchParams<{ mealType: string; logDate?: string }>();
  const [tab, setTab] = useState<PickTab>('foods');
  const [query, setQuery] = useState('');

  const effectiveLogDate = logDate ?? todayLogDateKey();

  const foodsQuery = useQuery({
    queryKey: ['foods', 'list', query],
    queryFn: () => listFoods(query),
    enabled: tab === 'foods',
  });

  const recipesQuery = useQuery({
    queryKey: ['recipes', 'list', query],
    queryFn: () => listRecipes(query),
    enabled: tab === 'recipes',
  });

  const showOffSearch = tab === 'foods' && query.trim().length > 1;
  const offSearch = useOffFoodSearch(query, showOffSearch);

  const quickAddMutation = useMutation({
    mutationFn: async ({ itemType, id }: QuickAddTarget) => {
      if (itemType === 'foods') {
        const food = await getFoodById(id);
        if (!food) throw new Error('Food not found');
        const weighable = isWeighableUnit(food.servingUnit);
        const amountFields = weighable
          ? { weightG: getReferenceWeightG(food), quantityAmount: null, quantityUnit: null }
          : { weightG: null, quantityAmount: food.servingAmount, quantityUnit: food.servingUnit };
        return createEntry({
          logDate: effectiveLogDate,
          mealType: mealType as MealType,
          itemType: 'food',
          foodId: food.id,
          recipeId: null,
          ...amountFields,
          weightSource: 'manual',
          calories: food.calories,
          proteinG: food.proteinG,
          carbsG: food.carbsG,
          fatG: food.fatG,
          fiberG: food.fiberG,
          sugarG: food.sugarG,
          sodiumMg: food.sodiumMg,
          loggedAt: new Date().toISOString(),
          notes: null,
        });
      }

      const recipe = await getRecipeWithIngredients(id);
      if (!recipe) throw new Error('Recipe not found');
      const recipeTotals = computeRecipeTotals(
        recipe.ingredients.map((ingredient) => ({ food: ingredient.food, quantityG: ingredient.quantityG })),
      );
      const portionWeightG = recipeTotals.totalWeightG / recipe.servings;
      const nutrition = roundNutritionForDisplay(scaleRecipePortion(recipeTotals, portionWeightG));
      return createEntry({
        logDate: effectiveLogDate,
        mealType: mealType as MealType,
        itemType: 'recipe',
        foodId: null,
        recipeId: recipe.id,
        weightG: portionWeightG,
        quantityAmount: null,
        quantityUnit: null,
        weightSource: 'manual',
        ...nutrition,
        loggedAt: new Date().toISOString(),
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealLogEntries', effectiveLogDate] });
      router.back();
    },
    onError: (error: Error) => Alert.alert('Could not add', error.message),
  });

  useFocusEffect(
    useCallback(() => {
      if (queryClient.getQueryData(['foods', 'justAdded'])) {
        queryClient.setQueryData(['foods', 'justAdded'], false);
        setQuery('');
      }
      if (tab === 'foods') {
        foodsQuery.refetch();
      } else {
        recipesQuery.refetch();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]),
  );

  function goToWeigh(itemType: PickTab, itemId: number) {
    router.push({
      pathname: '/log/[mealType]/weigh',
      params: {
        mealType,
        itemType: itemType === 'foods' ? 'food' : 'recipe',
        itemId: String(itemId),
        logDate: effectiveLogDate,
      },
    });
  }

  return (
    <KeyboardAvoidingScreen>
    <View style={styles.container}>
      <SegmentedControl
        options={[
          { label: 'Foods', value: 'foods' },
          { label: 'Recipes', value: 'recipes' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${tab}…`}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {tab === 'foods' && (
        <View style={styles.actionsRow}>
          <AppButton
            title="+ New Food"
            variant="secondary"
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/food/new',
                params: { logMealType: mealType, logDate: effectiveLogDate },
              })
            }
          />
          <AppButton
            title="Scan Barcode"
            variant="secondary"
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/scan-barcode',
                params: { returnTo: '/food/new', logMealType: mealType, logDate: effectiveLogDate },
              })
            }
          />
        </View>
      )}

      {tab === 'foods' ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={foodsQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const isAdding =
              quickAddMutation.isPending &&
              quickAddMutation.variables?.itemType === 'foods' &&
              quickAddMutation.variables?.id === item.id;
            return (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="fast-food-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.rowTextGroup}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {item.calories} kcal / {item.servingAmount} {item.servingUnit}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={styles.rowActionButton}
                    onPress={() => quickAddMutation.mutate({ itemType: 'foods', id: item.id })}
                    disabled={isAdding}
                  >
                    <Text style={styles.rowActionButtonText}>{isAdding ? '…' : 'Add'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rowActionButtonSecondary}
                    onPress={() => goToWeigh('foods', item.id)}
                  >
                    <Text style={styles.rowActionButtonSecondaryText}>Weigh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            query.trim().length > 1 ? (
              <Text style={styles.emptyText}>No matches in your library.</Text>
            ) : (
              <Text style={styles.emptyText}>No foods found. Add one above.</Text>
            )
          }
          ListFooterComponent={
            showOffSearch ? (
              <View style={styles.offSection}>
                <OffFoodResults
                  results={offSearch.results}
                  loading={offSearch.loading}
                  error={offSearch.error}
                  onRetry={offSearch.retry}
                  hasMore={offSearch.hasMore}
                  loadingMore={offSearch.loadingMore}
                  onLoadMore={offSearch.loadMore}
                  context={{ destination: '/food/new', logMealType: mealType, logDate: effectiveLogDate }}
                />
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={recipesQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const isAdding =
              quickAddMutation.isPending &&
              quickAddMutation.variables?.itemType === 'recipes' &&
              quickAddMutation.variables?.id === item.id;
            return (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.rowTextGroup}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {item.cachedCaloriesPerServing} kcal/serving · {item.servings} servings
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={styles.rowActionButton}
                    onPress={() => quickAddMutation.mutate({ itemType: 'recipes', id: item.id })}
                    disabled={isAdding}
                  >
                    <Text style={styles.rowActionButtonText}>{isAdding ? '…' : 'Add'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rowActionButtonSecondary}
                    onPress={() => goToWeigh('recipes', item.id)}
                  >
                    <Text style={styles.rowActionButtonSecondaryText}>Weigh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes found. Add one from the Library tab.</Text>}
        />
      )}
    </View>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
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
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextGroup: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rowActionButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  rowActionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rowActionButtonSecondary: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
  },
  rowActionButtonSecondaryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  offSection: {
    marginTop: spacing.md,
  },
});
