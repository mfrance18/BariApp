import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { listFoods } from '../../../src/db/repositories/foodsRepo';
import { listRecipes } from '../../../src/db/repositories/recipesRepo';

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

  return (
    <View style={styles.container}>
      <View style={styles.segmentRow}>
        <SegmentButton label="Foods" active={activeTab === 'foods'} onPress={() => setActiveTab('foods')} />
        <SegmentButton label="Recipes" active={activeTab === 'recipes'} onPress={() => setActiveTab('recipes')} />
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder={`Search ${activeTab}…`}
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.actionsRow}>
        {activeTab === 'foods' ? (
          <>
            <Button title="+ New Food" onPress={() => router.push('/library/food/new')} />
            <Button
              title="Scan Barcode"
              onPress={() => router.push({ pathname: '/scan-barcode', params: { returnTo: '/library/food/new' } })}
            />
          </>
        ) : (
          <Button title="+ New Recipe" onPress={() => router.push('/library/recipe/new')} />
        )}
      </View>

      {activeTab === 'foods' ? (
        <FlatList
          data={foodsQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/library/food/${item.id}`)}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.calories} kcal / {item.basisType === 'per_100g' ? '100g' : item.servingLabel ?? 'serving'}
              </Text>
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
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.cachedCaloriesPerServing} kcal/serving · {item.servings} servings
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes yet.</Text>}
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
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
