import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { listFoods } from '../../../src/db/repositories/foodsRepo';
import { listRecipes } from '../../../src/db/repositories/recipesRepo';
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
      <View style={styles.segmentRow}>
        <SegmentButton label="Foods" active={tab === 'foods'} onPress={() => setTab('foods')} />
        <SegmentButton label="Recipes" active={tab === 'recipes'} onPress={() => setTab('recipes')} />
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder={`Search ${tab}…`}
        value={query}
        onChangeText={setQuery}
      />

      {tab === 'foods' ? (
        <FlatList
          data={foodsQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => goToWeigh('foods', item.id)}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.calories} kcal / {item.basisType === 'per_100g' ? '100g' : item.servingLabel ?? 'serving'}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No foods found. Add one from the Library tab.</Text>}
        />
      ) : (
        <FlatList
          data={recipesQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => goToWeigh('recipes', item.id)}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.cachedCaloriesPerServing} kcal/serving · {item.servings} servings
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes found. Add one from the Library tab.</Text>}
        />
      )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
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
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#777',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
});
