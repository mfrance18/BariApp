import { sqliteDb } from '../db/client';

export type AccentColorName = 'blue' | 'purple' | 'red' | 'green' | 'yellow' | 'lightBlue' | 'orange' | 'grey';
export type BaseThemeName = 'blue' | 'purple' | 'red' | 'green' | 'black';

const ACCENT_NAMES: AccentColorName[] = ['blue', 'purple', 'red', 'green', 'yellow', 'lightBlue', 'orange', 'grey'];
const BASE_NAMES: BaseThemeName[] = ['blue', 'purple', 'red', 'green', 'black'];

/** Accent color presets — buttons, icons, active states. Independent of the base theme. */
export const ACCENT_PRESETS: Record<AccentColorName, { primary: string; primaryDark: string; primaryLight: string }> = {
  blue: { primary: '#3D9BFF', primaryDark: '#1C5FC7', primaryLight: '#1B3A5C' },
  purple: { primary: '#A374FF', primaryDark: '#6B3FD1', primaryLight: '#332457' },
  red: { primary: '#FF6B6B', primaryDark: '#D13F3F', primaryLight: '#4A2323' },
  green: { primary: '#3ED598', primaryDark: '#1FA06D', primaryLight: '#12402F' },
  yellow: { primary: '#F0C929', primaryDark: '#C7A31A', primaryLight: '#4A3F14' },
  lightBlue: { primary: '#5AC8FA', primaryDark: '#2E9FD1', primaryLight: '#1B3A4A' },
  orange: { primary: '#FF9F43', primaryDark: '#D97C1F', primaryLight: '#4A3018' },
  grey: { primary: '#9AA5B1', primaryDark: '#6B7684', primaryLight: '#2A3038' },
};

/** Base theme presets — the dark background/card/border tint. Independent of the accent. */
export const BASE_PRESETS: Record<BaseThemeName, { background: string; card: string; border: string }> = {
  blue: { background: '#0A1929', card: '#122840', border: '#22405E' },
  purple: { background: '#170A29', card: '#241240', border: '#3D225E' },
  red: { background: '#290A0A', card: '#401212', border: '#5E2222' },
  green: { background: '#0A2916', card: '#124028', border: '#225E3D' },
  black: { background: '#000000', card: '#141414', border: '#2A2A2A' },
};

/**
 * Reads the saved theme/accent preference synchronously, straight from
 * SQLite, so it's available before this module's StyleSheet.create() calls
 * (and every screen's, since they all import `colors` from here) run at
 * import time — well before the async migration/query hooks in
 * app/_layout.tsx complete. Changing either preset in Settings persists the
 * new value then calls Updates.reloadAsync() to re-run the whole JS bundle,
 * which is what actually applies it (React re-renders alone can't, since
 * StyleSheet.create objects are computed once at module load, not per-render).
 * Falls back to 'blue'/'blue' if the columns don't exist yet (very first
 * launch after this feature shipped, before migrations have run) or any
 * other read error.
 */
function readSavedTheme(): { accent: AccentColorName; base: BaseThemeName } {
  const isAccentName = (v: unknown): v is AccentColorName => ACCENT_NAMES.includes(v as AccentColorName);
  const isBaseName = (v: unknown): v is BaseThemeName => BASE_NAMES.includes(v as BaseThemeName);
  try {
    const row = sqliteDb.getFirstSync<{ theme_accent: string; theme_base: string }>(
      'SELECT theme_accent, theme_base FROM app_settings WHERE id = 1',
    );
    return {
      accent: isAccentName(row?.theme_accent) ? row.theme_accent : 'blue',
      base: isBaseName(row?.theme_base) ? row.theme_base : 'blue',
    };
  } catch {
    return { accent: 'blue', base: 'blue' };
  }
}

const saved = readSavedTheme();
const accent = ACCENT_PRESETS[saved.accent];
const base = BASE_PRESETS[saved.base];

export const colors = {
  primary: accent.primary,
  primaryDark: accent.primaryDark,
  primaryLight: accent.primaryLight,

  background: base.background,
  card: base.card,
  border: base.border,

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
