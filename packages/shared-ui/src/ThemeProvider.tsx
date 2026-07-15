import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as sharedColors } from './theme';

const THEME_KEY = 'prayana_theme';

// A brand ramp is just the primary color scale. Defaults to the shared ORANGE
// (customer + support-agent apps). The vendor app passes its BLUE ramp so every
// shared-ui component that paints the brand color (Button, Stepper, TextInput
// focus, Badge, StarRating, LoadingSpinner, Avatar) renders blue — with no
// per-component overrides.
export type BrandRamp = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  themeColors: typeof lightColors;
  brand: BrandRamp;
}

// Light colors (same as current theme.ts)
const lightColors = {
  background: '#ffffff',
  backgroundSecondary: '#f5f5f5',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  text: '#171717',
  textSecondary: '#525252',
  textTertiary: '#a3a3a3',
  textInverse: '#ffffff',
  border: '#e5e5e5',
  borderFocused: '#06B6D4',
  overlay: 'rgba(0, 0, 0, 0.5)',
  card: '#ffffff',
  cardBorder: '#e5e5e5',
  searchBar: '#ffffff',
  searchBarBorder: '#e5e5e5',
  tabBar: '#ffffff',
  tabBarBorder: '#e5e5e5',
  headerGradient: ['#f0fdfc', '#ffffff'] as const,
  inputBackground: '#f5f5f5',
  // Text-entry fields: a white fill with a clearly-visible border reads as an
  // editable outlined control. (inputBackground stays a muted grey — it also
  // backs non-editable surfaces like segmented tracks, tags, and placeholders.)
  field: '#ffffff',
  fieldBorder: '#d4d4d4',
};

// Dark colors
const darkColors = {
  background: '#0a0a0a',
  backgroundSecondary: '#171717',
  surface: '#1a1a1a',
  surfaceElevated: '#262626',
  text: '#fafafa',
  textSecondary: '#d4d4d4',
  textTertiary: '#737373',
  textInverse: '#171717',
  border: '#333333',
  borderFocused: '#06B6D4',
  overlay: 'rgba(0, 0, 0, 0.7)',
  card: '#1a1a1a',
  cardBorder: '#333333',
  searchBar: '#262626',
  searchBarBorder: '#404040',
  tabBar: '#0a0a0a',
  tabBarBorder: '#262626',
  headerGradient: ['#171717', '#0a0a0a'] as const,
  inputBackground: '#262626',
  // In dark mode a field lifts above the near-black background; the border adds
  // the extra definition that separates it from a static grey surface.
  field: '#1a1a1a',
  fieldBorder: '#404040',
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  themeColors: lightColors,
  brand: sharedColors.primary,
});

export function ThemeProvider({
  children,
  brand,
}: {
  children: ReactNode;
  /** Optional brand ramp override. Omit for the default orange. Vendor passes blue. */
  brand?: BrandRamp;
}) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value === 'dark') setIsDarkMode(true);
      // default: light — no state change needed
    }).catch(() => {});
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
  };

  const themeColors = (isDarkMode ? darkColors : lightColors) as typeof lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, themeColors, brand: brand ?? sharedColors.primary }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { lightColors, darkColors };
export type ThemeColors = typeof lightColors;
