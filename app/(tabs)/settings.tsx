import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { AppButton } from '../../src/components/ui/AppButton';
import { Card } from '../../src/components/ui/Card';
import { getSettings } from '../../src/db/repositories/settingsRepo';
import { login, logout, syncWeightHistoryToDb } from '../../src/services/vesync/adapter';
import { colors, radius, spacing, typography } from '../../src/theme/theme';
import { mlToOz } from '../../src/utils/units';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: getSettings,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const loginMutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: (result) => {
      if (result.ok) {
        setPassword('');
        queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app_settings'] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncWeightHistoryToDb(30),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weightLog'] }),
  });

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
      <Section title="VeSync Scale">
        {settings.vesyncConnected ? (
          <>
            <Text style={styles.rowText}>Connected as {settings.vesyncEmail}</Text>
            <View style={styles.buttonRow}>
              <AppButton
                title={syncMutation.isPending ? 'Syncing…' : 'Sync Now'}
                variant="secondary"
                style={styles.flexButton}
                onPress={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              />
              <AppButton
                title="Disconnect"
                variant="danger"
                style={styles.flexButton}
                onPress={() => logoutMutation.mutate()}
              />
            </View>
            {syncMutation.data && (
              <Text style={styles.helperText}>Synced {syncMutation.data.synced} new reading(s).</Text>
            )}
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="VeSync email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (email && password && !loginMutation.isPending) loginMutation.mutate();
                }}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <AppButton
              title={loginMutation.isPending ? 'Connecting…' : 'Connect'}
              onPress={() => loginMutation.mutate()}
              disabled={loginMutation.isPending || !email || !password}
            />
            {loginMutation.data && !loginMutation.data.ok && (
              <Text style={styles.errorText}>{loginMutation.data.error}</Text>
            )}
          </>
        )}
      </Section>
      <Section title="Daily Goals">
        <SettingsRow label="Calories" value={`${settings.dailyCalorieGoal}`} />
        <SettingsRow label="Protein" value={`${settings.dailyProteinGoalG} g`} />
        <SettingsRow label="Fluid" value={`${mlToOz(settings.dailyFluidGoalMl).toFixed(0)} oz`} />
      </Section>
      <Section title="Units">
        <SettingsRow label="Weight unit" value={settings.weightUnit} />
      </Section>
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

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: spacing.xl + spacing.md,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
});
