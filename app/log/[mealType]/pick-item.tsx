import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton } from '../../../src/components/ui/AppButton';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { listFoods } from '../../../src/db/repositories/foodsRepo';
import { listRecipes } from '../../../src/db/repositories/recipesRepo';
import { colors, radius, spacing } from '../../../src/theme/theme';
import { todayLogDateKey } from '../../../src/utils/date';

type PickTab = 'foods' | 'recipes';

export default function PickItemScreen() {
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
                pathname: '/library/food/new',
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
                params: { returnTo: '/library/food/new', logMealType: mealType, logDate: effectiveLogDate },
              })
            }
          />
        </View>
      )}

      {tab === 'foods' ? (
        <FlatList
          data={foodsQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => goToWeigh('foods', item.id)}>
              <View style={styles.rowIcon}>
                <Ionicons name="fast-food-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.calories} kcal / {item.basisType === 'per_100g' ? '100g' : item.servingLabel ?? 'serving'}
                </Text>
              </View>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No foods found. Add one above.</Text>}
        />
      ) : (
        <FlatList
          data={recipesQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => goToWeigh('recipes', item.id)}>
              <View style={styles.rowIcon}>
                <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.cachedCaloriesPerServing} kcal/serving · {item.servings} servings
                </Text>
              </View>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes found. Add one from the Library tab.</Text>}
        />
      )}
    </View>
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
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
