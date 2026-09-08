import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton } from '../../src/components/ui/AppButton';
import { listActiveVitaminsMeds } from '../../src/db/repositories/medsRepo';
import { colors, radius, spacing } from '../../src/theme/theme';

export default function ManageMedsScreen() {
  const { data: meds } = useQuery({ queryKey: ['vitaminsMeds'], queryFn: listActiveVitaminsMeds });

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={meds ?? []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <AppButton title="+ Add Vitamin or Medication" onPress={() => router.push('/meds/new/edit')} />
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => router.push(`/meds/${item.id}/edit`)}>
          <View style={styles.rowIcon}>
            <Ionicons
              name={item.type === 'vitamin' ? 'nutrition-outline' : 'medkit-outline'}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.rowTextGroup}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.type === 'vitamin' ? 'Vitamin' : 'Medication'}
              {item.dosageLabel ? ` · ${item.dosageLabel}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No vitamins or medications yet</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
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
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
