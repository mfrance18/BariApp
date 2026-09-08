import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton } from '../../../src/components/ui/AppButton';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { listFoods } from '../../../src/db/repositories/foodsRepo';
import { listRecipes } from '../../../src/db/repositories/recipesRepo';
import { colors, radius, spacing } from '../../../src/theme/theme';

type LibraryTab = 'foods' | 'recipes';

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('foods');
  const [query, setQuery] = useState('');

  const foodsQuery = useQuery({
    queryKey: ['foods', 'list', query],
    queryFn: () => listFoods(query),
    enabled: activeTab === 'foods',
  });

  const recipesQuery = useQuery({
    queryKey: ['recipes', 'list', query],
    queryFn: () => listRecipes(query),
    enabled: activeTab === 'recipes',
  });

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'foods') {
        foodsQuery.refetch();
      } else {
        recipesQuery.refetch();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]),
  );

  return (
    <View style={styles.container}>
      <SegmentedControl
        options={[
          { label: 'Foods', value: 'foods' },
          { label: 'Recipes', value: 'recipes' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab}…`}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.actionsRow}>
        {activeTab === 'foods' ? (
          <>
            <AppButton
              title="+ New Food"
              variant="secondary"
              style={styles.actionButton}
              onPress={() => router.push('/food/new')}
            />
            <AppButton
              title="Scan Barcode"
              variant="secondary"
              style={styles.actionButton}
              onPress={() => router.push({ pathname: '/scan-barcode', params: { returnTo: '/food/new' } })}
            />
          </>
        ) : (
          <AppButton title="+ New Recipe" variant="secondary" onPress={() => router.push('/library/recipe/new')} />
        )}
      </View>

      {activeTab === 'foods' ? (
        <FlatList
          data={foodsQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/food/${item.id}`)}>
              <View style={styles.rowIcon}>
                <Ionicons name="fast-food-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.calories} kcal / {item.servingAmount} {item.servingUnit}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No foods yet.</Text>}
        />
      ) : (
        <FlatList
          data={recipesQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/library/recipe/${item.id}`)}>
              <View style={styles.rowIcon}>
                <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.cachedCaloriesPerServing} kcal/serving · {item.servings} servings
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes yet.</Text>}
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
