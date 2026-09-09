import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { LiveScaleWeight } from '../../hooks/useLiveScaleWeight';
import { colors, spacing } from '../../theme/theme';
import { AppButton } from './AppButton';

/** Shows the state of a live scale connection (connecting/live/error) below a weight field, in place of a "Pull from Scale" button. */
export function ScaleStatusRow({
  scale,
  paused,
  onReconnect,
}: {
  scale: LiveScaleWeight;
  paused: boolean;
  onReconnect: () => void;
}) {
  if (scale.status === 'connecting') {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={styles.helperText}>Connecting to scale…</Text>
      </View>
    );
  }
  if (scale.status === 'error') {
    return (
      <View style={styles.row}>
        <Text style={styles.errorText}>{scale.error ?? 'Could not connect to scale.'}</Text>
        <AppButton title="Retry" variant="text" onPress={onReconnect} />
      </View>
    );
  }
  if (scale.status === 'live') {
    const text = paused
      ? 'Scale connected — clear the amount for a live reading'
      : scale.settled
        ? 'Live weight from scale'
        : 'Reading… (settling)';
    return <Text style={styles.helperText}>{text}</Text>;
  }
  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  helperText: {
    color: colors.primary,
    fontSize: 13,
  },
});
