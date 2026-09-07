import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { listActiveVitaminsMeds } from '../../src/db/repositories/medsRepo';

export default function ManageMedsScreen() {
  const { data: meds } = useQuery({ queryKey: ['vitaminsMeds'], queryFn: listActiveVitaminsMeds });

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={meds ?? []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={<Button title="+ Add Vitamin or Medication" onPress={() => router.push('/meds/new/edit')} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => router.push(`/meds/${item.id}/edit`)}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowMeta}>
            {item.type === 'vitamin' ? 'Vitamin' : 'Medication'}
            {item.dosageLabel ? ` · ${item.dosageLabel}` : ''}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No vitamins or medications yet</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  row: {
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 12,
    marginTop: 12,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 13,
    color: '#777',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
});
