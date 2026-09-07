import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type LibraryTab = 'foods' | 'recipes';

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('foods');

  return (
    <View style={styles.container}>
      <View style={styles.segmentRow}>
        <SegmentButton
          label="Foods"
          active={activeTab === 'foods'}
          onPress={() => setActiveTab('foods')}
        />
        <SegmentButton
          label="Recipes"
          active={activeTab === 'recipes'}
          onPress={() => setActiveTab('recipes')}
        />
      </View>
      <Text style={styles.emptyText}>
        {activeTab === 'foods' ? 'No foods yet.' : 'No recipes yet.'}
      </Text>
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
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
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
});
