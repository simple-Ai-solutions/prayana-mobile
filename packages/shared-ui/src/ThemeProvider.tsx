import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'prayana_theme';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  themeColors: typeof lightColors;
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
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  themeColors: lightColors,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value === 'dark') setIsDarkMode(true);
      else if (value === 'light') setIsDarkMode(false);
      // default: light for mobile
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
  };

  const themeColors = isDarkMode ? darkColors : lightColors;

  if (!isLoaded) return null; // prevent flash

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { lightColors, darkColors };
export type ThemeColors = typeof lightColors;
