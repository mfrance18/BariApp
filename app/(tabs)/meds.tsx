import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sortable, SortableItem, type SortableRenderItemProps } from 'react-native-reanimated-dnd';

import { AppButton } from '../../src/components/ui/AppButton';
import { listActiveVitaminsMeds, reorderVitaminsMeds, type VitaminMed } from '../../src/db/repositories/medsRepo';
import { colors, radius, spacing } from '../../src/theme/theme';

// Sortable requires a string `id` on each data item, distinct from our own
// numeric database id (kept as `medId`) so navigation/mutations stay clear
// about which is which.
type SortableMedItem = Omit<VitaminMed, 'id'> & { id: string; medId: number };

function toSortableItem(med: VitaminMed): SortableMedItem {
  const { id, ...rest } = med;
  return { ...rest, id: String(id), medId: id };
}

// Fixed row height Sortable positions items by — must match what each row
// actually renders at, or rows will overlap/gap incorrectly. Generous
// enough for a single-line name + meta row; text is clipped to one line
// each to keep this reliable regardless of content length.
const ITEM_HEIGHT = 88;

export default function MedsScreen() {
  const queryClient = useQueryClient();
  const { data: meds } = useQuery({ queryKey: ['vitaminsMeds'], queryFn: listActiveVitaminsMeds });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => reorderVitaminsMeds(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitaminsMeds'] });
      queryClient.invalidateQueries({ queryKey: ['medsChecklist'] });
    },
  });

  const handleDrop = useCallback(
    (_id: string, _position: number, allPositions?: { [id: string]: number }) => {
      if (!allPositions) return;
      const orderedIds = Object.entries(allPositions)
        .sort((a, b) => a[1] - b[1])
        .map(([medId]) => Number(medId));
      reorderMutation.mutate(orderedIds);
    },
    [reorderMutation],
  );

  const renderItem = useCallback(
    ({ item, id, ...rest }: SortableRenderItemProps<SortableMedItem>) => (
      <SortableItem key={id} id={id} data={item} {...rest} onDrop={handleDrop}>
        <View style={styles.itemSlot}>
          <View style={styles.row}>
            <SortableItem.Handle>
              <View style={styles.dragHandle} hitSlop={8}>
                <Ionicons name="reorder-three-outline" size={22} color={colors.textMuted} />
              </View>
            </SortableItem.Handle>
            <TouchableOpacity
              style={styles.rowContent}
              onPress={() => router.push(`/meds/${item.medId}/edit`)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>
                <Ionicons
                  name={item.type === 'vitamin' ? 'nutrition-outline' : 'medkit-outline'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.type === 'vitamin' ? 'Vitamin' : 'Medication'}
                  {item.dosageLabel ? ` · ${item.dosageLabel}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </SortableItem>
    ),
    [handleDrop],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppButton title="+ Add Vitamin or Medication" onPress={() => router.push('/meds/new/edit')} />
        {meds && meds.length > 1 && <Text style={styles.hint}>Hold the grip icon to drag and reorder.</Text>}
      </View>
      {meds && meds.length > 0 ? (
        <Sortable
          data={meds.map(toSortableItem)}
          renderItem={renderItem}
          itemHeight={ITEM_HEIGHT}
          style={styles.list}
        />
      ) : (
        <Text style={styles.emptyText}>No vitamins or medications yet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: 0,
    gap: spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  itemSlot: {
    height: ITEM_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  dragHandle: {
    padding: spacing.xs,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
