export const colors = {
  primary: '#0B57D0',
  primaryDark: '#073E96',
  primaryLight: '#E8F0FE',

  background: '#F2F4F7',
  card: '#FFFFFF',
  border: '#E5E9F0',

  textPrimary: '#1C2530',
  textSecondary: '#6B7684',
  textMuted: '#9AA3AF',

  success: '#2E9E5B',
  successLight: '#E7F7EE',
  danger: '#E0433D',
  dangerLight: '#FCEAE9',

  protein: '#4C6EF5',
  carbs: '#F5A623',
  fat: '#EC6BAA',
  fiber: '#2E9E5B',
  sodium: '#7C6CF0',
  fluid: '#1CA7EC',
  fluidLight: '#E4F6FE',
  weight: '#0B57D0',
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
