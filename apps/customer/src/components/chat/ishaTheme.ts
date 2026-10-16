// Isha's colours, in one place: Ink. Mirrors the website's ishaTheme.js.
//
//   Ink     near-black on white (white on near-black in dark mode) for every
//           action and choice: Send, Plan my trip, Book, a picked option. The
//           user's own messages sit in soft grey, so photos, prices and places
//           carry the colour.
//   Flame   the red→orange of the Prayana logo, on Isha alone: her avatar ring
//           (it turns while she works) and the dot on the best months to go.
//   Stone   the neutrals: borders, secondary text, surfaces.
//
// Green, amber and red keep their meaning (saved, careful, failed).
import { useMemo } from 'react';
import { useTheme } from '@prayana/shared-ui';

const stone = {
  50: '#fafaf9',
  100: '#f5f5f4',
  200: '#e7e5e4',
  300: '#d6d3d1',
  400: '#a8a29e',
  500: '#78716c',
  600: '#57534e',
  700: '#44403c',
  800: '#292524',
  900: '#1c1917',
  950: '#0c0a09',
};

/** The logo's flame, for decoration only (never under text). */
export const FLAME = ['#EC2D28', '#FB923C', '#F9D84F', '#FB923C', '#EC2D28'] as const;

export type IshaPalette = {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceMuted: string;
  sunken: string;
  pressed: string;
  border: string;
  borderStrong: string;
  divider: string;
  text: string;
  body: string;
  muted: string;
  faint: string;
  placeholder: string;
  ink: string;
  onInk: string;
  inkDisabledBg: string;
  inkDisabledText: string;
  userBubble: string;
  userText: string;
  agentBg: string;
  agentBorder: string;
  agentBadgeBg: string;
  agentText: string;
  warnBg: string;
  warnBorder: string;
  warnText: string;
  warnIcon: string;
  danger: string;
  dangerBorder: string;
  success: string;
  star: string;
  best: string;
  online: string;
  offline: string;
  scrim: string;
  shadow: string;
};

const light: IshaPalette = {
  isDark: false,
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: stone[50],
  sunken: stone[100],
  pressed: stone[100],
  border: stone[200],
  borderStrong: stone[300],
  divider: stone[100],
  text: stone[900],
  body: stone[800],
  muted: stone[600],
  faint: stone[500],
  placeholder: stone[500],
  ink: stone[950],
  onInk: '#ffffff',
  inkDisabledBg: stone[100],
  inkDisabledText: stone[400],
  userBubble: stone[100],
  userText: stone[950],
  agentBg: '#eef2ff',
  agentBorder: '#e0e7ff',
  agentBadgeBg: '#e0e7ff',
  agentText: '#312e81',
  warnBg: '#fffbeb',
  warnBorder: '#fde68a',
  warnText: '#78350f',
  warnIcon: '#b45309',
  danger: '#b91c1c',
  dangerBorder: '#fecaca',
  success: '#047857',
  star: '#d97706',
  best: '#ea580c',
  online: '#10b981',
  offline: stone[400],
  scrim: 'rgba(12,10,9,0.45)',
  shadow: '#0c0a09',
};

const dark: IshaPalette = {
  isDark: true,
  bg: stone[950],
  surface: stone[900],
  surfaceMuted: stone[900],
  sunken: stone[800],
  pressed: stone[800],
  border: stone[800],
  borderStrong: stone[700],
  divider: stone[800],
  text: stone[50],
  body: stone[200],
  muted: stone[400],
  faint: stone[400],
  placeholder: stone[400],
  ink: stone[50],
  onInk: stone[950],
  inkDisabledBg: stone[800],
  inkDisabledText: stone[500],
  userBubble: stone[800],
  userText: stone[50],
  agentBg: 'rgba(30,27,75,0.45)',
  agentBorder: 'rgba(49,46,129,0.6)',
  agentBadgeBg: '#1e1b4b',
  agentText: '#c7d2fe',
  warnBg: 'rgba(69,26,3,0.5)',
  warnBorder: 'rgba(120,53,15,0.6)',
  warnText: '#fde68a',
  warnIcon: '#fbbf24',
  danger: '#f87171',
  dangerBorder: '#7f1d1d',
  success: '#34d399',
  star: '#fbbf24',
  best: '#fb923c',
  online: '#10b981',
  offline: stone[500],
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

export const ishaPalettes = { light, dark };

/** Isha's palette for the app's current light/dark mode. */
export function useIsha(): IshaPalette {
  const { isDarkMode } = useTheme();
  return useMemo(() => (isDarkMode ? dark : light), [isDarkMode]);
}

// Built at runtime: an engine without Unicode property escapes falls back to
// the common emoji blocks instead of failing to load the module
const EMOJI = (() => {
  try {
    return new RegExp('\\p{Extended_Pictographic}|\\uFE0F|\\u200D', 'gu');
  } catch {
    return /[☀-➿]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|️|‍/g;
  }
})();

/** Server-made chip labels carry emoji; the chat's icons are line icons. */
export const plainLabel = (text: unknown) =>
  String(text || '')
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .trim();
