import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { AppButton } from '../../src/components/ui/AppButton';
import { Card } from '../../src/components/ui/Card';
import { getSettings, updateSettings } from '../../src/db/repositories/settingsRepo';
import { ACCENT_PRESETS, BASE_PRESETS, colors, radius, spacing, typography, type AccentName } from '../../src/theme/theme';
import { mlToOz, ozToMl } from '../../src/utils/units';

const ACCENT_LABELS: Record<AccentName, string> = {
  blue: 'Blue',
  purple: 'Purple',
  red: 'Red',
  green: 'Green',
};

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: getSettings,
  });

  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [fluidOzInput, setFluidOzInput] = useState('');
  const goalsInitialized = useRef(false);

  useEffect(() => {
    if (settings && !goalsInitialized.current) {
      setCaloriesInput(String(settings.dailyCalorieGoal));
      setProteinInput(String(settings.dailyProteinGoalG));
      setFluidOzInput(String(Math.round(mlToOz(settings.dailyFluidGoalMl))));
      goalsInitialized.current = true;
    }
  }, [settings]);

  const saveGoalsMutation = useMutation({
    mutationFn: () =>
      updateSettings({
        dailyCalorieGoal: Number(caloriesInput),
        dailyProteinGoalG: Number(proteinInput),
        dailyFluidGoalMl: Math.round(ozToMl(Number(fluidOzInput))),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app_settings'] }),
  });

  // Colors are computed once at module load (theme.ts reads them synchronously
  // from SQLite), not per-render, so a plain re-render can't pick up a new
  // theme/accent — reloading the whole JS bundle is what actually applies it.
  const themeMutation = useMutation({
    mutationFn: async ({ field, value }: { field: 'themeAccent' | 'themeBase'; value: AccentName }) => {
      await updateSettings({ [field]: value });
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) {
        throw new Error('MANUAL_RESTART');
      }
      await Updates.reloadAsync();
    },
    onError: (error: Error) => {
      if (error.message === 'MANUAL_RESTART') {
        Alert.alert('Theme saved', 'Fully close and reopen the app to see the change.');
      } else {
        Alert.alert('Could not switch theme', error.message);
      }
    },
  });

  const goalsValid =
    Number(caloriesInput) > 0 && Number(proteinInput) > 0 && Number(fluidOzInput) > 0;
  const goalsDirty =
    !!settings &&
    (Number(caloriesInput) !== settings.dailyCalorieGoal ||
      Number(proteinInput) !== settings.dailyProteinGoalG ||
      Math.round(ozToMl(Number(fluidOzInput))) !== settings.dailyFluidGoalMl);

  if (isLoading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={StyleSheet.flatten(styles.content)}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={120}
      keyboardOpeningTime={0}
    >
      <Section title="Daily Goals">
        <GoalField label="Calories" unit="kcal" value={caloriesInput} onChangeText={setCaloriesInput} />
        <GoalField label="Protein" unit="g" value={proteinInput} onChangeText={setProteinInput} />
        <GoalField label="Fluid" unit="oz" value={fluidOzInput} onChangeText={setFluidOzInput} />
        <AppButton
          title={saveGoalsMutation.isPending ? 'Saving…' : 'Save Goals'}
          onPress={() => saveGoalsMutation.mutate()}
          disabled={!goalsValid || !goalsDirty || saveGoalsMutation.isPending}
        />
        {!goalsValid && <Text style={styles.errorText}>Goals must be greater than 0.</Text>}
        {saveGoalsMutation.isSuccess && !goalsDirty && (
          <Text style={styles.helperText}>Goals saved.</Text>
        )}
      </Section>
      <Section title="Theme">
        <SwatchPicker
          selected={settings.themeBase}
          getColor={(name) => BASE_PRESETS[name].card}
          onSelect={(value) => themeMutation.mutate({ field: 'themeBase', value })}
          disabled={themeMutation.isPending}
        />
      </Section>
      <Section title="Accent">
        <SwatchPicker
          selected={settings.themeAccent}
          getColor={(name) => ACCENT_PRESETS[name].primary}
          onSelect={(value) => themeMutation.mutate({ field: 'themeAccent', value })}
          disabled={themeMutation.isPending}
        />
      </Section>
      {themeMutation.isPending && <Text style={styles.helperText}>Applying…</Text>}
    </KeyboardAwareScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {children}
    </Card>
  );
}

function SwatchPicker({
  selected,
  getColor,
  onSelect,
  disabled,
}: {
  selected: AccentName;
  getColor: (name: AccentName) => string;
  onSelect: (value: AccentName) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.swatchRow}>
      {(Object.keys(ACCENT_LABELS) as AccentName[]).map((name) => {
        const isSelected = selected === name;
        return (
          <TouchableOpacity
            key={name}
            style={styles.swatchButton}
            onPress={() => onSelect(name)}
            disabled={disabled}
          >
            <View
              style={[styles.swatchCircle, { backgroundColor: getColor(name) }, isSelected && styles.swatchCircleSelected]}
            >
              {isSelected && <Ionicons name="checkmark" size={18} color="#fff" />}
            </View>
            <Text style={styles.swatchLabel}>{ACCENT_LABELS[name]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function GoalField({
  label,
  unit,
  value,
  onChangeText,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.goalRow}>
      <Text style={styles.rowText}>{label}</Text>
      <View style={styles.goalInputGroup}>
        <TextInput
          style={styles.goalInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text style={styles.goalUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  rowText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  goalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 15,
    color: colors.textPrimary,
    minWidth: 70,
    textAlign: 'right',
  },
  goalUnit: {
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 32,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  swatchButton: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatchCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchCircleSelected: {
    borderColor: colors.textPrimary,
  },
  swatchLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
