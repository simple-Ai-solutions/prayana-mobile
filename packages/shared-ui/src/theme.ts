// Design tokens for Prayana AI mobile apps
// Brand: Klook-style orange (#f97316) — synced with web (Phase 7 Teal removal)
// Single source of truth: change tokens here, all 411 component refs auto-update.

export const colors = {
  // Primary - Orange (Prayana brand, matches web --tab-accommodation-start)
  primary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316', // Main brand color (Tailwind orange-500)
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },

  // Accent - keep a complementary blue for info / CTAs that aren't primary
  accent: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
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
  borderFocused: '#f97316',

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

// Animation timing (matches iOS spring + Material motion guidelines)
export const motion = {
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },
  easing: {
    standard: 'ease-in-out' as const,
    decelerate: 'ease-out' as const,
    accelerate: 'ease-in' as const,
  },
  spring: {
    gentle: { damping: 18, stiffness: 150 },
    bouncy: { damping: 12, stiffness: 180 },
    stiff: { damping: 22, stiffness: 220 },
  },
} as const;

// Z-index scale — prevents stacking-order chaos
export const zIndex = {
  base: 0,
  raised: 1,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  tooltip: 60,
} as const;

// Layout constants
export const layout = {
  screenPadding: 16,
  cardPadding: 16,
  tabBarHeight: 60,
  headerHeight: 56,
  buttonHeight: { sm: 36, md: 44, lg: 52 },
  inputHeight: 48,
  minTouchTarget: 44, // Apple HIG + Material accessibility minimum
} as const;

export const theme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
  motion,
  zIndex,
  layout,
} as const;

export type Theme = typeof theme;
export default theme;
