export const colors = {
  primary: '#3D9BFF',
  primaryDark: '#1C5FC7',
  primaryLight: '#1B3A5C',

  background: '#0A1929',
  card: '#122840',
  border: '#22405E',

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
  weight: '#3D9BFF',
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
