// Design tokens for Prayana AI mobile apps
// Cyan-based theme (#06B6D4)

export const colors = {
  // Primary - Cyan (Prayana brand)
  primary: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06B6D4', // Main brand color
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },

  // Neutral / Gray
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Semantic colors
  success: '#22c55e',
  successLight: '#dcfce7',
  warning: '#eab308',
  warningLight: '#fef9c3',
  error: '#ef4444',
  errorLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',

  // Background
  background: '#ffffff',
  backgroundSecondary: '#f5f5f5',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',

  // Text
  text: '#171717',
  textSecondary: '#525252',
  textTertiary: '#a3a3a3',
  textInverse: '#ffffff',

  // Border
  border: '#e5e5e5',
  borderFocused: '#06B6D4',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Status colors for bookings
  statusPending: '#eab308',
  statusConfirmed: '#22c55e',
  statusCompleted: '#3b82f6',
  statusCancelled: '#ef4444',

  // Quality tier colors
  tierPlatinum: '#94a3b8',
  tierGold: '#eab308',
  tierSilver: '#9ca3af',
  tierBronze: '#d97706',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

export const theme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
} as const;

export type Theme = typeof theme;
export default theme;
