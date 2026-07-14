// Vendor-scoped color tokens — INDIGO brand, matching the web Business Portal
// (components/business/BusinessLayout.jsx uses #4F46E5 as its primary).
//
// The shared theme (@prayana/shared-ui) is ORANGE and is used by the customer +
// support-agent apps, so we must NOT mutate it. Instead we re-export every shared
// token and override only the brand ramp (primary) + focus border to indigo.
// Vendor screens import `colors` (and the rest) from HERE instead of shared-ui.
//
// Source of truth for indigo ramp: Tailwind `indigo` (600 = #4F46E5, the PWA brand).

import {
  colors as sharedColors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
  motion,
  zIndex,
  layout,
} from '@prayana/shared-ui';

// Tailwind indigo ramp — 600 (#4F46E5) is the PWA's brand color.
// Tailwind blue ramp — 600 (#2563eb) is the web Partner Portal's brand
// (app/business/page.js uses blue-600 buttons, blue-300 accents, and a
// slate-950 -> blue-950 dark hero).
const blue = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb', // web Partner Portal brand
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
} as const;

export const colors = {
  ...sharedColors,
  // Override the brand ramp with blue. Keep the [500]-as-main convention the
  // screens use, but map it to blue-600 so `colors.primary[500]` == #2563eb
  // (the exact web brand). The rest of the ramp shifts one step for depth.
  primary: {
    50: blue[50],
    100: blue[100],
    200: blue[200],
    300: blue[300],
    400: blue[500],
    500: blue[600], // main = #2563eb, the web Partner Portal brand
    600: blue[700],
    700: blue[800],
    800: blue[900],
    900: '#172554',
  },
  borderFocused: blue[600],
} as const;

// Re-export the untouched shared tokens so vendor screens can import everything
// design-related from this one module.
export { spacing, borderRadius, fontSize, fontWeight, shadow, motion, zIndex, layout };

export const vendorTheme = {
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

export default vendorTheme;
