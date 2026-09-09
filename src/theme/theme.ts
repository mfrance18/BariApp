import { sqliteDb } from '../db/client';

export type AccentName = 'blue' | 'purple' | 'red' | 'green';

interface ThemePreset {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  card: string;
  border: string;
}

/** Full theme presets a user can pick between in Settings — both the accent and the dark base tint change together. */
export const ACCENT_PRESETS: Record<AccentName, ThemePreset> = {
  blue: {
    primary: '#3D9BFF',
    primaryDark: '#1C5FC7',
    primaryLight: '#1B3A5C',
    background: '#0A1929',
    card: '#122840',
    border: '#22405E',
  },
  purple: {
    primary: '#A374FF',
    primaryDark: '#6B3FD1',
    primaryLight: '#332457',
    background: '#170A29',
    card: '#241240',
    border: '#3D225E',
  },
  red: {
    primary: '#FF6B6B',
    primaryDark: '#D13F3F',
    primaryLight: '#4A2323',
    background: '#290A0A',
    card: '#401212',
    border: '#5E2222',
  },
  green: {
    primary: '#3ED598',
    primaryDark: '#1FA06D',
    primaryLight: '#12402F',
    background: '#0A2916',
    card: '#124028',
    border: '#225E3D',
  },
};

/**
 * Reads the saved accent preference synchronously, straight from SQLite,
 * so it's available before this module's StyleSheet.create() calls (and
 * every screen's, since they all import `colors` from here) run at import
 * time — well before the async migration/query hooks in app/_layout.tsx
 * complete. Changing the accent in Settings persists the new value then
 * calls Updates.reloadAsync() to re-run the whole JS bundle, which is what
 * actually applies it (React re-renders alone can't, since StyleSheet.create
 * objects are computed once at module load, not per-render).
 * Falls back to 'blue' if the column/table doesn't exist yet (very first
 * launch after this feature shipped, before migrations have run) or any
 * other read error.
 */
function readSavedAccent(): AccentName {
  try {
    const row = sqliteDb.getFirstSync<{ theme_accent: string }>(
      'SELECT theme_accent FROM app_settings WHERE id = 1',
    );
    const value = row?.theme_accent;
    if (value === 'blue' || value === 'purple' || value === 'red' || value === 'green') {
      return value;
    }
    return 'blue';
  } catch {
    return 'blue';
  }
}

const accent = ACCENT_PRESETS[readSavedAccent()];

export const colors = {
  primary: accent.primary,
  primaryDark: accent.primaryDark,
  primaryLight: accent.primaryLight,

  background: accent.background,
  card: accent.card,
  border: accent.border,

  textPrimary: '#EDF3FA',
  textSecondary: '#9FB6CC',
  textMuted: '#6E869C',

  success: '#3ED598',
  successLight: '#123B31',
  danger: '#FF6B6B',
  dangerLight: '#4A1F22',
  warning: '#F5B942',
  warningLight: '#4A3A16',

  protein: '#6E8FFF',
  carbs: '#F5A623',
  fat: '#F17FBE',
  fiber: '#3ED598',
  sodium: '#A78CFF',
  fluid: '#3FC1F0',
  fluidLight: '#123650',
  weight: accent.primary,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.textPrimary },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.textPrimary },
  label: { fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary, letterSpacing: 0.5 },
  body: { fontSize: 15, color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
};

export const cardStyle = {
  backgroundColor: colors.card,
  borderRadius: radius.lg,
  shadowColor: '#0B1220',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
