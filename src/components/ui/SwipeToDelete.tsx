import { Ionicons } from '@expo/vector-icons';
import { useRef, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { colors, radius, spacing } from '../../theme/theme';

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: ReactNode;
}

/** Wraps a list row so swiping it to the right reveals a Delete action. */
export function SwipeToDelete({ onDelete, children }: SwipeToDeleteProps) {
  const ref = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={ref}
      leftThreshold={40}
      overshootLeft={false}
      renderLeftActions={() => (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
