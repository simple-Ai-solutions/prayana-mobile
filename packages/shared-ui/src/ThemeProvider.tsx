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

// Dark colors — a cool, slightly blue-violet near-black (District-style) rather
// than flat grey-black: cards sit one clear step above the page with a thin
// hairline, which is what makes photos and posters glow against it.
const darkColors = {
  background: '#0B0B10',
  backgroundSecondary: '#111118',
  surface: '#16161E',
  surfaceElevated: '#1E1E28',
  text: '#F5F5F7',
  textSecondary: '#C4C4CC',
  textTertiary: '#7A7A86',
  textInverse: '#171717',
  border: '#272731',
  borderFocused: '#06B6D4',
  overlay: 'rgba(0, 0, 0, 0.7)',
  card: '#16161E',
  cardBorder: '#262630',
  searchBar: '#1E1E28',
  searchBarBorder: '#33333F',
  tabBar: '#0B0B10',
  tabBarBorder: '#1E1E28',
  headerGradient: ['#14141C', '#0B0B10'] as const,
  inputBackground: '#1E1E28',
  // In dark mode a field lifts above the near-black background; the border adds
  // the extra definition that separates it from a static grey surface.
  field: '#16161E',
  fieldBorder: '#33333F',
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  themeColors: lightColors,
  brand: sharedColors.primary,
});

// True below the outermost ThemeProvider, so an inner one knows to inherit.
const NestedMarker = createContext(false);

export function ThemeProvider({
  children,
  brand,
  defaultDark = false,
}: {
  children: ReactNode;
  /** Theme for someone who has never picked one. Customer app opens dark. */
  defaultDark?: boolean;
  /** Optional brand ramp override. Omit for the default orange. Vendor passes blue. */
  brand?: BrandRamp;
}) {
  // Set when this provider sits inside another one.
  const isNested = useContext(NestedMarker);
  const outer = useContext(ThemeContext);
  const parent = isNested ? outer : null;
  const [isDarkMode, setIsDarkMode] = useState(defaultDark);

  useEffect(() => {
    // A saved choice always wins over the default.
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value === 'dark') setIsDarkMode(true);
      else if (value === 'light') setIsDarkMode(false);
    }).catch(() => {});
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
  };

  const themeColors = (isDarkMode ? darkColors : lightColors) as typeof lightColors;

  // Nested inside another provider (e.g. a route group re-branding to blue):
  // follow the outer one's dark/light mode instead of keeping a second copy
  // that starts light and never hears about the toggle.
  if (parent) {
    return (
      <ThemeContext.Provider value={{ ...parent, brand: brand ?? parent.brand }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <NestedMarker.Provider value>
      <ThemeContext.Provider value={{ isDarkMode, toggleTheme, themeColors, brand: brand ?? sharedColors.primary }}>
        {children}
      </ThemeContext.Provider>
    </NestedMarker.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { lightColors, darkColors };
export type ThemeColors = typeof lightColors;
